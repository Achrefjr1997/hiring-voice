import { useEffect, useRef, useState, useCallback } from "react";
import { Mic, MicOff, Bot, User } from "lucide-react";
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
  currentFocus?: { name: string; domain: string } | null;
}

export default function VoiceInterface({ events, onAudioReady, sessionStatus, currentFocus }: VoiceInterfaceProps) {
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

  const recordingTime = isRecording ? "Listening\u2026 Tap to stop" : aiSpeaking ? "Interviewer speaking\u2026" : "Tap to speak";

  return (
    <div className="flex flex-col items-center w-full max-w-xl mx-auto gap-6">
      {/* Transcript container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex flex-col gap-6 min-h-80 max-h-[60vh] overflow-y-auto w-full px-4 py-4 scroll-smooth"
      >
        {currentFocus && (
          <div className="self-start px-3 py-1.5 rounded-radius-pill bg-accent-gold/10 border border-accent-gold/30 text-[13px] text-accent-gold font-medium transition-all duration-300 max-w-full whitespace-nowrap overflow-hidden text-ellipsis">
            🎯 Current Focus: {currentFocus.name} <span className="opacity-60">({currentFocus.domain})</span>
          </div>
        )}

        {transcript.length === 0 && sessionStatus === "active" && (
          <div className="bg-surface-default rounded-radius-card border border-border-cream p-6 text-center shadow-sm event-enter">
            <Bot size={36} className="text-accent-gold mx-auto mb-3" />
            <h3 className="text-[17px] font-semibold text-text-inverted mb-1">Welcome to your VoiceHire interview</h3>
            <p className="text-[15px] text-text-muted leading-relaxed">
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
