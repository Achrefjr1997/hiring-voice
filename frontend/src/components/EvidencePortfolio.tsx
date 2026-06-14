import { FileText, CheckCircle, AlertTriangle, TrendingUp, Download } from "lucide-react";
import type { ParsedVoiceHireEvent, HiringDecision } from "../types";

interface EvidencePayload {
  evidence_id?: string;
  raw_transcript?: string;
  competencies_tagged?: Array<{
    competency_id: string;
    confidence: number;
    polarity: string;
  }>;
  behavioral_tags?: Array<{
    tag: string;
    confidence: number;
    polarity: string;
  }>;
  ownership_score?: number;
  overall_confidence?: number;
  extracted_signals?: string[];
  missed_signals?: string[];
  demonstrated_skills?: string[];
}

function VerdictBanner({ decision }: { decision: HiringDecision }) {
  const isHire = decision.final_recommendation === "STRONG_HIRE" || decision.final_recommendation === "HIRE";
  const bg = isHire ? "bg-green-100 border-green-400" : "bg-red-100 border-red-400";
  const text = isHire ? "text-green-800" : "text-red-800";
  const icon = isHire ? "✅" : "❌";

  function handleDownload() {
    const blob = new Blob([JSON.stringify(decision, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `voicehire_decision_${decision.session_id || "unknown"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={`flex items-center gap-3 px-4 py-3 border-b ${bg}`}>
      <span className="text-xl">{icon}</span>
      <div className="flex-1">
        <span className={`font-bold text-sm ${text}`}>
          {decision.final_recommendation.replace(/_/g, " ")}
        </span>
        <span className="text-xs text-gray-500 ml-2">
          {decision.must_have_demonstrated}/{decision.must_have_total} must-haves
          {decision.consensus_reached ? " · Consensus" : " · No consensus"}
        </span>
      </div>
      <button
        onClick={handleDownload}
        className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
      >
        <Download size={12} />
        JSON
      </button>
    </div>
  );
}

export default function EvidencePortfolio({
  events,
  decision,
}: {
  events: ParsedVoiceHireEvent[];
  decision: HiringDecision | null;
}) {
  const evidenceEvents = events.filter((e) => e.type === "COVERAGE_MAP_UPDATE");
  const challengeEvents = events.filter((e) => e.type === "INTEGRITY_CHALLENGE");

  if (evidenceEvents.length === 0 && challengeEvents.length === 0 && !decision) return null;

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      {decision && <VerdictBanner decision={decision} />}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100">
        <h2 className="text-sm font-medium text-gray-700 flex-1">
          Evidence Portfolio
        </h2>
        <span className="text-xs text-gray-500">
          {evidenceEvents.length} update{evidenceEvents.length !== 1 ? "s" : ""}
          {challengeEvents.length > 0 && (
            <span className="text-red-500 ml-2">
              · {challengeEvents.length} challenge{challengeEvents.length !== 1 ? "s" : ""}
            </span>
          )}
        </span>
      </div>

      <div className="flex flex-col divide-y divide-gray-100 max-h-72 overflow-y-auto">
        {challengeEvents.map((ev) => (
          <div
            key={ev.bandMessageId}
            className="px-3 py-2 text-xs bg-red-50 border-l-2 border-l-red-400"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle size={12} className="text-red-500" />
              <span className="font-medium text-red-700">Integrity Challenge</span>
            </div>
            <p className="text-red-600">{typeof ev.payload === "string" ? ev.payload.slice(0, 120) : JSON.stringify(ev.payload).slice(0, 120)}</p>
          </div>
        ))}

        {evidenceEvents.map((ev) => {
          const payload = ev.payload as EvidencePayload;
          if (!payload || !payload.competencies_tagged) return null;

          return (
            <div key={ev.bandMessageId} className="px-3 py-2 text-xs">
              <div className="flex items-center gap-1.5 mb-1">
                <FileText size={12} className="text-amber-500" />
                <span className="font-medium text-gray-700">
                  Coverage update
                </span>
                <span className="text-gray-400 font-mono text-[10px] ml-auto">
                  {new Date(ev.timestamp).toLocaleTimeString()}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-1">
                {payload.competencies_tagged?.map((tag, i) => (
                  <span
                    key={i}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      tag.polarity === "POSITIVE"
                        ? "bg-green-50 text-green-700"
                        : tag.polarity === "NEGATIVE"
                          ? "bg-red-50 text-red-700"
                          : "bg-gray-50 text-gray-600"
                    }`}
                  >
                    {tag.polarity === "POSITIVE" ? (
                      <CheckCircle size={10} />
                    ) : tag.polarity === "NEGATIVE" ? (
                      <AlertTriangle size={10} />
                    ) : null}
                    {tag.competency_id}: {Math.round(tag.confidence * 100)}%
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-2 text-gray-500">
                {payload.ownership_score !== undefined && (
                  <span className="flex items-center gap-0.5">
                    <TrendingUp size={10} />
                    {Math.round(payload.ownership_score * 100)}%
                  </span>
                )}
                {payload.extracted_signals && payload.extracted_signals.length > 0 && (
                  <span>{payload.extracted_signals.length} signal{payload.extracted_signals.length !== 1 ? "s" : ""}</span>
                )}
                {payload.demonstrated_skills && payload.demonstrated_skills.length > 0 && (
                  <span>{payload.demonstrated_skills.length} skill{payload.demonstrated_skills.length !== 1 ? "s" : ""}</span>
                )}
              </div>

              {payload.raw_transcript && (
                <p className="mt-1 text-gray-400 italic truncate">
                  "{payload.raw_transcript.slice(0, 100)}…"
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
