import { useState, useEffect, useRef, useCallback } from "react";

interface TTSStreamState {
  isSpeaking: boolean;
  currentText: string | null;
  streamConnected: boolean;
}

export function useTTSStream(sessionId: string | null) {
  const [state, setState] = useState<TTSStreamState>({
    isSpeaking: false,
    currentText: null,
    streamConnected: false,
  });
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const playAudio = useCallback(async (audioData: ArrayBuffer) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const audioBuffer = await ctx.decodeAudioData(audioData.slice(0));
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => {
        setState((s) => ({ ...s, isSpeaking: false, currentText: null }));
      };
      source.start();
      sourceRef.current = source;
    } catch (err) {
      console.error("[useTTSStream] decodeAudioData failed:", err);
      setState((s) => ({ ...s, isSpeaking: false }));
    }
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioCtxRef.current = audioCtx;

    const connect = () => {
      if (cancelled) return;
      const ws = new WebSocket(`/ws/tts/${sessionId}`);
      ws.binaryType = "arraybuffer";

      let chunks: Uint8Array[] = [];

      ws.onopen = () => {
        if (cancelled) { ws.close(); return; }
        console.log("[useTTSStream] Connected");
        setState((s) => ({ ...s, streamConnected: true }));
      };

      ws.onmessage = async (e) => {
        if (cancelled) return;
        if (e.data instanceof ArrayBuffer) {
          chunks.push(new Uint8Array(e.data));
        } else {
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === "SPEAK_START") {
              chunks = [];
              setState({ isSpeaking: true, currentText: msg.text, streamConnected: true });
              } else if (msg.type === "SPEAK_END") {
              if (chunks.length > 0) {
                const totalLen = chunks.reduce((acc, arr) => acc + arr.length, 0);
                const combined = new Uint8Array(totalLen);
                let offset = 0;
                for (const arr of chunks) {
                  combined.set(arr, offset);
                  offset += arr.length;
                }
                chunks = [];
                // Resume AudioContext if suspended (autoplay policy at mount time)
                if (audioCtx.state === "suspended") {
                  try { await audioCtx.resume(); } catch { /* proceed anyway */ }
                }
                audioCtx.decodeAudioData(combined.buffer)
                  .then((audioBuffer) => {
                    if (cancelled) return;
                    const source = audioCtx.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(audioCtx.destination);
                    source.onended = () => {
                      if (!cancelled) {
                        setState((s) => ({ ...s, isSpeaking: false, currentText: null }));
                      }
                    };
                    source.start();
                    sourceRef.current = source;
                  })
                  .catch((err) => {
                    console.error("[useTTSStream] decodeAudioData failed:", err);
                    if (!cancelled) {
                      setState((s) => ({ ...s, isSpeaking: false }));
                    }
                  });
              } else {
                setState((s) => ({ ...s, isSpeaking: false, currentText: null }));
              }
            }
          } catch {
            // ignore invalid JSON
          }
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        setState((s) => ({ ...s, streamConnected: false, isSpeaking: false, currentText: null }));
        reconnectTimer = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      sourceRef.current?.stop();
      audioCtx.close();
      audioCtxRef.current = null;
    };
  }, [sessionId, playAudio]);

  return state;
}
