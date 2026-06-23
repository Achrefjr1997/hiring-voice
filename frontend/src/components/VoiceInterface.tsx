import { useEffect, useRef, useState, useCallback } from "react";
import { Mic, MicOff, Bot, User, Target } from "lucide-react";
import type { ParsedVoiceHireEvent } from "../types";
import { useTTSStream } from "../hooks/useTTSStream";

interface Turn {
  role: "interviewer" | "candidate";
  text: string;
  isFiller?: boolean;
}

interface VoiceInterfaceProps {
  events: ParsedVoiceHireEvent[];
  onAudioReady: (blob: Blob) => Promise<string | null>;
  sessionStatus: "idle" | "ready" | "active" | "ended";
  sessionId: string | null;
  currentFocus?: { name: string; domain: string } | null;
}

export default function VoiceInterface({ events, onAudioReady, sessionStatus, sessionId, currentFocus }: VoiceInterfaceProps) {
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const fillerRef = useRef<HTMLAudioElement | null>(null);
  const recordingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);

  const ttsStream = useTTSStream(sessionId);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSpeakTextRef = useRef<string | null>(null);

  // Track previous TTS speaking state to detect transition
  const prevTtsSpeakingRef = useRef(false);

  // Cancel pending fallback timer when TTS stream starts handling the audio
  useEffect(() => {
    if (ttsStream.isSpeaking && ttsStream.currentText === pendingSpeakTextRef.current) {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      pendingSpeakTextRef.current = null;
    }
    // When TTS stream finishes playing, start recording
    if (prevTtsSpeakingRef.current && !ttsStream.isSpeaking) {
      // Cancel any pending HTTP fallback before auto-starting recording
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      pendingSpeakTextRef.current = null;
      startRecording();
    }
    prevTtsSpeakingRef.current = ttsStream.isSpeaking;
  }, [ttsStream.isSpeaking, ttsStream.currentText]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const threshold = 120;
    setIsNearBottom(el.scrollHeight - el.scrollTop - el.clientHeight < threshold);
  }, []);

  useEffect(() => {
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [transcript.length, isNearBottom]);

  useEffect(() => {
    const latest = events[0];
    if (!latest) return;

    if (latest.type === "SPEAK") {
      const payload = latest.payload as any;
      if (typeof payload === "string" || !payload?.audioUrl) return;
      const isFiller = payload.isFiller === true || payload.model === "kokoro";
      setTranscript((t) => [...t, { role: "interviewer" as const, text: payload.text, isFiller }]);

      // If recording already active, TTS already finished playing — don't disrupt
      if (!isFiller && recordingRef.current) {
        return;
      }

      setAiSpeaking(true);

      // Clear pending fallback from previous SPEAK
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      pendingSpeakTextRef.current = null;

      if (!isFiller && fillerRef.current) {
        fillerRef.current.pause();
        fillerRef.current.currentTime = 0;
        fillerRef.current = null;
      }

      if (payload.audioUrl) {
        if (isFiller) {
          // Filler: play immediately via HTTP
          const audio = new Audio(payload.audioUrl);
          audio.crossOrigin = "anonymous";
          audio.play().catch(() => {});
          fillerRef.current = audio;
        } else if (ttsStream.isSpeaking && ttsStream.currentText === payload.text) {
          // TTS stream is already handling this probe — no HTTP fallback needed
        } else {
          // Debounce HTTP fallback: TTS WS may deliver first chunk momentarily
          pendingSpeakTextRef.current = payload.text;
          fallbackTimerRef.current = setTimeout(() => {
            pendingSpeakTextRef.current = null;
            const audio = new Audio(payload.audioUrl);
            audio.crossOrigin = "anonymous";
            audio.onended = () => {
              setAiSpeaking(false);
              if (!isFiller) startRecording();
            };
            audio.onerror = () => setAiSpeaking(false);
            audio.play().catch(() => setAiSpeaking(false));
            currentAudioRef.current = audio;
          }, 1000);
        }
      } else {
        // No audio to play — start recording after brief transcript display
        setTimeout(() => {
          setAiSpeaking(false);
          if (!isFiller) startRecording();
        }, 1000);
      }
    }

    if (latest.type === "CANDIDATE_UTTERANCE") {
      const text = typeof latest.payload === "string"
        ? latest.payload
        : (latest.payload as { transcript?: string }).transcript ?? "";
      setTranscript((t) => [...t, { role: "candidate" as const, text }]);
    }
  }, [events[0]?.bandMessageId]);

  // Cleanup fallback timer on unmount
  useEffect(() => {
    return () => {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
    };
  }, []);

  const startRecording = async () => {
    if (recordingRef.current) return;
    recordingRef.current = true;
    setAiSpeaking(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm;codecs=opus" });
        try {
          const fillerUrl = await onAudioReady(blob);
          // Only play filler if probe hasn't already arrived
          if (fillerUrl && !currentAudioRef.current) {
            const audio = new Audio(fillerUrl);
            audio.crossOrigin = "anonymous";
            setAiSpeaking(true);
            audio.onended = () => {
              if (!currentAudioRef.current) setAiSpeaking(false);
            };
            audio.play().catch(() => setAiSpeaking(false));
            fillerRef.current = audio;
          }
        } catch (e) {
          console.error("[VoiceInterface] Failed to send audio:", e);
        }
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      recordingRef.current = false;
      console.warn("Microphone access denied");
    }
  };

  const stopRecording = () => {
    recordingRef.current = false;
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleMicClick = () => {
    if (recordingRef.current) {
      stopRecording();
    } else {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        setAiSpeaking(false);
      }
      startRecording();
    }
  };

  const recordingTime = isRecording ? "Listening\u2026 Tap to stop" : aiSpeaking ? "Interviewer speaking\u2026" : "Tap to speak";

  return (
    <div className="flex flex-col items-center w-full max-w-xl mx-auto gap-6">
      {/* Transcript container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex flex-col gap-6 min-h-80 max-h-[60vh] overflow-y-auto w-full px-4 py-4 scroll-smooth"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-gold/10 border border-accent-gold/30 text-accent-gold font-medium mb-6 transition-all duration-300 max-w-full whitespace-nowrap overflow-hidden text-ellipsis self-start">
          <Target size={16} />
          {currentFocus ? (
            <>
              <span>Current Focus: {currentFocus.name}</span>
              <span className="text-text-muted text-sm">({currentFocus.domain})</span>
            </>
          ) : (
            <span>Getting Started…</span>
          )}
        </div>

        {transcript.length === 0 && sessionStatus === "active" && (
          <div className="bg-white rounded-xl border-2 border-gray-200 p-8 text-center shadow-lg event-enter max-w-lg">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-50 to-orange-50 flex items-center justify-center mx-auto mb-4">
              <Bot size={32} className="text-accent-gold" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3 font-serif">Welcome to your VoiceHire interview</h3>
            <p className="text-base text-gray-600 leading-relaxed">
              Speak clearly and take your time. You can pause anytime. Click the microphone below when you're ready.
            </p>
          </div>
        )}

        {transcript.length > 0 && transcript.map((turn, i) => (
          <div
            key={i}
            className={`flex items-end gap-3 ${turn.role === "interviewer" ? "justify-start" : "justify-end"} event-enter`}
          >
            {turn.role === "interviewer" && (
              <div className="w-8 h-8 rounded-full bg-accent-gold/15 flex items-center justify-center flex-shrink-0 mb-1">
                <Bot size={16} className="text-accent-gold" />
              </div>
            )}

            <div
              className={`rounded-radius-card px-4 py-3 text-[16px] leading-relaxed ${
                turn.role === "interviewer"
                  ? turn.isFiller
                    ? "bg-accent-gold/10 text-accent-gold italic border border-accent-gold/20 max-w-[70%]"
                    : "bg-surface-default text-text-primary border border-border-default shadow-sm max-w-[70%]"
                  : "bg-[#E8E4DC] text-text-inverted max-w-[70%]"
              }`}
            >
              {turn.text}
              {turn.isFiller && (
                <span className="inline-flex items-center gap-0.5 ml-2 text-caption opacity-60">
                  <span className="thinking-dot w-1 h-1 rounded-full bg-current" />
                  <span className="thinking-dot w-1 h-1 rounded-full bg-current" style={{ animationDelay: "0.2s" }} />
                  <span className="thinking-dot w-1 h-1 rounded-full bg-current" style={{ animationDelay: "0.4s" }} />
                </span>
              )}
            </div>

            {turn.role === "candidate" && (
              <div className="w-8 h-8 rounded-full bg-[#E8E4DC] flex items-center justify-center flex-shrink-0 mb-1">
                <User size={16} className="text-text-muted" />
              </div>
            )}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Microphone */}
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={handleMicClick}
          disabled={aiSpeaking || sessionStatus !== "active"}
          title={recordingTime}
          className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-200 ${
            isRecording
              ? "bg-status-alert/10 border-2 border-status-alert scale-110 recording-pulse"
              : "bg-accent-gold/10 border-2 border-accent-gold/30 hover:bg-accent-gold/20 hover:scale-105"
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {isRecording
            ? <MicOff size={36} className="text-status-alert" />
            : <Mic size={36} className="text-accent-gold" />}
        </button>

        <p className="text-[13px] text-text-muted text-center">{recordingTime}</p>
      </div>
    </div>
  );
}
