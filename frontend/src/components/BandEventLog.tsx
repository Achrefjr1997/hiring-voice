import type { ParsedVoiceHireEvent } from "../types";
import { Wifi, WifiOff } from "lucide-react";
import { useState } from "react";

const SENDER_COLORS: Record<string, string> = {
  "@session-brain": "text-accent-gold border-l-accent-gold",
  "@evidence-chain": "text-status-info border-l-status-info",
  "@integrity-skeptic": "text-status-alert border-l-status-alert",
  "@voice-persona": "text-status-live border-l-status-live",
  "@hiring-committee": "text-accent-gold border-l-accent-gold",
  "@rubric-synthesizer": "text-status-info border-l-status-info",
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
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border-default">
        <h2 className="text-caption font-medium text-text-secondary uppercase tracking-wide flex-1">Event Log</h2>
        {connected
          ? <><Wifi size={12} className="text-status-live" /><span className="text-caption text-status-live">Live</span></>
          : <><WifiOff size={12} className="text-status-alert" /><span className="text-caption text-status-alert">Reconnecting</span></>
        }
      </div>

      {/* Event list */}
      <div className="flex flex-col">
        {events.length === 0 ? (
          <p className="text-caption text-text-muted italic px-4 py-6 text-center">No events yet.</p>
        ) : (
          events.map((ev) => {
            const borderColor = SENDER_COLORS[ev.sender] ?? "border-l-border-default";
            const isOpen = expanded.has(ev.bandMessageId);
            const hasDetail = ev.type === "INTEGRITY_CHALLENGE" || ev.type === "PROBE_GENERATED" || ev.type === "SPEAK";
            const payload = ev.payload as Record<string, unknown>;
            const isFiller = ev.type === "SPEAK" && (payload as { isFiller?: boolean })?.isFiller === true;

            return (
              <div
                key={ev.bandMessageId}
                className={`px-3 py-2 text-caption border-l-2 ${borderColor} hover:bg-surface-hover transition-colors event-enter ${isFiller ? "opacity-60" : ""} ${hasDetail ? "cursor-pointer" : ""}`}
                onClick={() => hasDetail && toggle(ev.bandMessageId)}
              >
                <div className="flex items-start gap-2">
                  <span className="font-medium shrink-0 text-text-primary">{ev.sender}</span>
                  <span className="flex-1 truncate text-text-muted">{ev.type}</span>
                  <span className="text-text-muted font-mono text-caption shrink-0">
                    {new Date(ev.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                {ev.type === "PROBE_GENERATED" && (
                  <div className="mt-1 truncate text-text-secondary">{(payload?.probeText as string)?.slice(0, 80)}…</div>
                )}
                {ev.type === "SPEAK" && (
                  <div className="mt-1 truncate text-text-secondary">
                    {(payload as { text?: string })?.text?.slice(0, 80)}
                    {isFiller && <span className="text-accent-gold ml-1">⏳ thinking…</span>}
                  </div>
                )}
                {ev.type === "INTEGRITY_CHALLENGE" && (
                  <div className="mt-1 truncate text-status-alert">
                    {typeof ev.payload === "string" ? (ev.payload as string).slice(0, 80) : (payload?.challengeReason as string)}
                  </div>
                )}

                {isOpen && ev.type === "INTEGRITY_CHALLENGE" && (
                  <div className="mt-2 p-2 bg-surface-raised rounded-radius-card border border-border-default text-caption text-text-secondary whitespace-pre-wrap max-h-40 overflow-y-auto font-mono">
                    {typeof ev.payload === "string" ? ev.payload : (payload?.thinkingTrace as string)}
                  </div>
                )}
                {isOpen && ev.type === "PROBE_GENERATED" && (
                  <div className="mt-2 text-accent-gold">{payload?.probeText as string}</div>
                )}
                {isOpen && ev.type === "SPEAK" && (
                  <div className="mt-2 text-text-primary">{(payload as { text?: string })?.text}</div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
