import type { ParsedVoiceHireEvent } from "../types";
import { Wifi, WifiOff } from "lucide-react";
import { useState } from "react";

const SENDER_COLORS: Record<string, string> = {
  "@session-brain": "text-blue-600 bg-blue-50",
  "@evidence-chain": "text-amber-600 bg-amber-50",
  "@integrity-skeptic": "text-red-600 bg-red-50",
  "@voice-persona": "text-teal-600 bg-teal-50",
  "@hiring-committee": "text-purple-600 bg-purple-50",
  "@rubric-synthesizer": "text-indigo-600 bg-indigo-50",
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
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100">
        <h2 className="text-sm font-medium text-gray-700 flex-1">Band room · live feed</h2>
        {connected
          ? <><Wifi size={12} className="text-green-500" /><span className="text-xs text-green-500">Live</span></>
          : <><WifiOff size={12} className="text-red-400" /><span className="text-xs text-red-400">Reconnecting…</span></>
        }
      </div>
      <div className="flex flex-col divide-y divide-gray-100 max-h-72 overflow-y-auto">
        {events.map((ev) => {
          const colorClass = SENDER_COLORS[ev.sender] ?? "text-gray-500 bg-white";
          const isOpen = expanded.has(ev.bandMessageId);
          const hasDetail = ev.type === "INTEGRITY_CHALLENGE" || ev.type === "PROBE_GENERATED" || ev.type === "SPEAK";
          const payload = ev.payload as Record<string, unknown>;
          const isFiller = ev.type === "SPEAK" && (payload as { isFiller?: boolean })?.isFiller === true;

          return (
            <div
              key={ev.bandMessageId}
              className={`px-3 py-2 text-xs cursor-pointer hover:brightness-95 ${isFiller ? "text-amber-600 bg-amber-50 italic" : colorClass}`}
              onClick={() => hasDetail && toggle(ev.bandMessageId)}
            >
              <div className="flex items-start gap-2">
                <span className="font-medium shrink-0">{ev.sender}</span>
                <span className="flex-1 truncate opacity-70">{ev.type}</span>
                <span className="text-gray-400 font-mono text-[10px] shrink-0">
                  {new Date(ev.timestamp).toLocaleTimeString()}
                </span>
              </div>

              {ev.type === "PROBE_GENERATED" && (
                <div className="mt-1 truncate opacity-80">{(payload?.probeText as string)?.slice(0, 80)}…</div>
              )}
              {ev.type === "SPEAK" && (
                <div className="mt-1 truncate opacity-80">
                  {(payload as { text?: string })?.text?.slice(0, 80)}
                  {isFiller && <span className="text-amber-500 ml-1">⏳ thinking…</span>}
                </div>
              )}

              {ev.type === "INTEGRITY_CHALLENGE" && (
                <div className="mt-1 truncate text-red-500">
                  {typeof ev.payload === "string"
                    ? (ev.payload as string).slice(0, 80)
                    : (payload?.challengeReason as string)}
                </div>
              )}

              {isOpen && ev.type === "INTEGRITY_CHALLENGE" && (
                <div className="mt-2 p-2 bg-white rounded border border-red-200 font-mono text-[10px] text-gray-600 whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {typeof ev.payload === "string" ? ev.payload : (payload?.thinkingTrace as string)}
                </div>
              )}
              {isOpen && ev.type === "PROBE_GENERATED" && (
                <div className="mt-2 text-blue-700">{payload?.probeText as string}</div>
              )}
              {isOpen && ev.type === "SPEAK" && (
                <div className="mt-2">{(payload as { text?: string })?.text}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
