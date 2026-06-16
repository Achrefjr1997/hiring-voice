import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import type { ParsedVoiceHireEvent } from "../types";

interface Turn {
  role: "interviewer" | "candidate";
  text: string;
  isFiller?: boolean;
}

interface VoiceInterfaceProps {
  events: ParsedVoiceHireEvent[];
  onAudioReady: (blob: Blob) => Promise<string | null>;
  sessionStatus: "idle" | "ready" | "active" | "ended";
}

export default function VoiceInterface({ events, onAudioReady, sessionStatus }: VoiceInterfaceProps) {
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const fillerRef = useRef<HTMLAudioElement | null>(null);
  const recordingRef = useRef(false);

  useEffect(() => {
    const latest = events[0];
    if (!latest) return;

    if (latest.type === "SPEAK") {
      const payload = latest.payload as any;
      if (typeof payload === "string" || !payload?.audioUrl) return;
      const isFiller = payload.isFiller === true || payload.model === "kokoro";
      setTranscript((t) => [...t, { role: "interviewer" as const, text: payload.text, isFiller }]);
      setAiSpeaking(true);

      if (!isFiller && fillerRef.current) {
        fillerRef.current.pause();
        fillerRef.current.currentTime = 0;
        fillerRef.current = null;
      }

      if (payload.audioUrl) {
        const audio = new Audio(payload.audioUrl);
        audio.crossOrigin = "anonymous";
        audio.onended = () => {
          setAiSpeaking(false);
          if (!isFiller) startRecording();
        };
        audio.onerror = () => setAiSpeaking(false);
        audio.play().catch(() => setAiSpeaking(false));
        currentAudioRef.current = audio;
      } else {
        setTimeout(() => setAiSpeaking(false), 1000);
      }
    }

    if (latest.type === "CANDIDATE_UTTERANCE") {
      const text = typeof latest.payload === "string"
        ? latest.payload
        : (latest.payload as { transcript?: string }).transcript ?? "";
      setTranscript((t) => [...t, { role: "candidate" as const, text }]);
    }
  }, [events[0]?.bandMessageId]);

  const startRecording = async () => {
    if (recordingRef.current) return;
    recordingRef.current = true;
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
          if (fillerUrl) {
            const audio = new Audio(fillerUrl);
            audio.crossOrigin = "anonymous";
            audio.play().catch(() => {});
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

  return (
    <div className="flex flex-col gap-4 w-full max-w-sm items-center">
      <div className="flex flex-col gap-2 min-h-64 max-h-96 overflow-y-auto w-full px-2">
        {transcript.length === 0 && sessionStatus === "active" && (
          <p className="text-center text-text-muted text-body italic py-8">Waiting for the first question\u2026</p>
        )}
        {transcript.map((turn, i) => (
          <div key={i} className={turn.role === "interviewer" ? "self-start" : "self-end"}>
            <div
              className={`rounded-radius-card px-3 py-2 text-body max-w-xs ${
                turn.role === "interviewer"
                  ? turn.isFiller
                    ? "bg-accent-gold/10 text-accent-gold italic border border-accent-gold/20"
                    : "bg-surface-default text-text-primary border border-border-default"
                  : "bg-accent-gold/15 text-text-primary"
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
          </div>
        ))}
      </div>

      <button
        onClick={handleMicClick}
        disabled={aiSpeaking || sessionStatus !== "active"}
        className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200 ${
          isRecording
            ? "bg-status-alert/10 border-2 border-status-alert scale-110 recording-pulse"
            : "bg-accent-gold/10 border-2 border-accent-gold/30 hover:bg-accent-gold/20"
        } disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        {isRecording
          ? <MicOff size={32} className="text-status-alert" />
          : <Mic size={32} className="text-accent-gold" />}
      </button>

      <p className="text-center text-caption text-text-muted">
        {aiSpeaking ? "Interviewer speaking\u2026" : isRecording ? "Listening\u2026" : "Tap to speak"}
      </p>
    </div>
  );
}
