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

      // Cancel filler if still playing (probe arrived)
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
    <div className="flex flex-col gap-4 w-full max-w-sm">
      <div className="flex flex-col gap-2 min-h-64 max-h-96 overflow-y-auto">
        {transcript.map((turn, i) => (
          <div key={i} className={turn.role === "interviewer" ? "self-start" : "self-end"}>
            <div
              className={`rounded-xl px-3 py-2 text-sm max-w-xs ${
                turn.role === "interviewer"
                  ? turn.isFiller
                    ? "bg-amber-50 text-amber-800 italic border border-amber-200"
                    : "bg-gray-100 text-gray-900"
                  : "bg-blue-100 text-blue-900"
              }`}
            >
              {turn.text}
              {turn.isFiller && <span className="ml-2 text-[10px] opacity-60">thinking…</span>}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleMicClick}
        disabled={aiSpeaking || sessionStatus !== "active"}
        className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200 ${
          isRecording
            ? "bg-red-100 border-2 border-red-400 scale-110"
            : "bg-blue-50 border-2 border-blue-200 hover:bg-blue-100"
        } disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        {isRecording
          ? <MicOff size={32} className="text-red-500" />
          : <Mic size={32} className="text-blue-500" />}
      </button>

      <p className="text-center text-xs text-gray-400">
        {aiSpeaking ? "Interviewer speaking…" : isRecording ? "Listening…" : "Tap to speak"}
      </p>
    </div>
  );
}
