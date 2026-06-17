import type { ParsedVoiceHireEvent } from "../types";
import { Wifi, WifiOff, Brain, Users, Shield, Mic, Gavel, FileText } from "lucide-react";
import { useState } from "react";

const SENDER_CONFIG: Record<string, { icon: typeof Brain; color: string; bg: string; label: string }> = {
  "@session-brain": { icon: Brain, color: "text-yellow-600", bg: "bg-yellow-100", label: "Session Brain" },
  "@evidence-chain": { icon: Users, color: "text-blue-600", bg: "bg-blue-100", label: "Evidence Chain" },
  "@integrity-skeptic": { icon: Shield, color: "text-red-600", bg: "bg-red-100", label: "Integrity Skeptic" },
  "@voice-persona": { icon: Mic, color: "text-green-600", bg: "bg-green-100", label: "Voice Persona" },
  "@hiring-committee": { icon: Gavel, color: "text-purple-600", bg: "bg-purple-100", label: "Committee" },
  "@rubric-synthesizer": { icon: FileText, color: "text-blue-600", bg: "bg-blue-100", label: "Rubric Synthesizer" },
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  COMPETENCY_GRAPH_READY: "Competency Graph",
  PROBE_GENERATED: "Probe Generated",
  SPEAK: "Voice Output",
  CANDIDATE_UTTERANCE: "Candidate Response",
  EVIDENCE: "Evidence Extracted",
  INTEGRITY_CHALLENGE: "Integrity Alert",
  DELIBERATION: "Deliberation",
  COVERAGE_MAP_UPDATE: "Map Updated",
};

export default function BandEventLog({
  events,
  connected,
}: {
  events: ParsedVoiceHireEvent[];
  connected: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  return (
    <div className="flex flex-col">
      {/* Event timeline */}
      <div className="flex flex-col px-3 py-2">
        {events.length === 0 ? (
          <p className="text-xs text-gray-400 italic py-6 text-center">No events yet.</p>
        ) : (
          events.map((ev, index) => {
            const config = SENDER_CONFIG[ev.sender] ?? { icon: FileText, color: "text-gray-600", bg: "bg-gray-100", label: ev.sender };
            const Icon = config.icon;
            const isOpen = expanded.has(ev.bandMessageId);
            const hasDetail = ev.type === "INTEGRITY_CHALLENGE" || ev.type === "PROBE_GENERATED" || ev.type === "SPEAK";
            const payload = ev.payload as Record<string, unknown>;
            const isFiller = ev.type === "SPEAK" && (payload as { isFiller?: boolean })?.isFiller === true;
            const eventLabel = EVENT_TYPE_LABELS[ev.type] ?? ev.type;

            return (
              <div
                key={ev.bandMessageId}
                className={`flex gap-3 pb-3 ${index !== events.length - 1 ? "border-l-2 border-gray-200 ml-4" : ""} ${isFiller ? "opacity-60" : ""} event-enter`}
              >
                {/* Icon */}
                <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center shrink-0 -ml-[18px] ${index === events.length - 1 ? "" : ""}`}>
                  <Icon size={16} className={config.color} />
                </div>

                {/* Content */}
                <div
                  className={`flex-1 bg-surface-raised border border-border-default rounded-lg p-2.5 ${hasDetail ? "cursor-pointer hover:border-accent-gold/50 transition-colors" : ""}`}
                  onClick={() => hasDetail && toggle(ev.bandMessageId)}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-700">{config.label}</span>
                      <span className="text-xs text-gray-500">•</span>
                      <span className="text-xs text-gray-600">{eventLabel}</span>
                    </div>
                    <span className="text-xs font-mono text-gray-400">
                      {new Date(ev.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {ev.type === "PROBE_GENERATED" && !isOpen && (
                    <div className="text-xs text-gray-600 line-clamp-2">{(payload?.probeText as string)}</div>
                  )}
                  {ev.type === "SPEAK" && !isOpen && (
                    <div className="text-xs text-gray-600 line-clamp-2">
                      {(payload as { text?: string })?.text}
                      {isFiller && <span className="text-yellow-600 ml-1">⏳ thinking…</span>}
                    </div>
                  )}
                  {ev.type === "INTEGRITY_CHALLENGE" && !isOpen && (
                    <div className="text-xs text-red-600 line-clamp-2">
                      {typeof ev.payload === "string" ? (ev.payload as string) : (payload?.challengeReason as string)}
                    </div>
                  )}

                  {isOpen && ev.type === "INTEGRITY_CHALLENGE" && (
                    <div className="mt-2 p-2 bg-surface-default rounded-md border border-border-default text-xs text-gray-600 whitespace-pre-wrap max-h-40 overflow-y-auto font-mono">
                      {typeof ev.payload === "string" ? ev.payload : (payload?.thinkingTrace as string)}
                    </div>
                  )}
                  {isOpen && ev.type === "PROBE_GENERATED" && (
                    <div className="mt-2 text-xs text-yellow-700">{payload?.probeText as string}</div>
                  )}
                  {isOpen && ev.type === "SPEAK" && (
                    <div className="mt-2 text-xs text-gray-700">{(payload as { text?: string })?.text}</div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
