import { useNavigate } from "react-router-dom";
import { FileText, CheckCircle, AlertTriangle, TrendingUp, Download, Lock } from "lucide-react";
import type { ParsedVoiceHireEvent, HiringDecision } from "../types";

interface EvidencePayload {
  evidence_id?: string;
  raw_transcript?: string;
  competencies_tagged?: Array<{ competency_id: string; confidence: number; polarity: string }>;
  behavioral_tags?: Array<{ tag: string; confidence: number; polarity: string }>;
  ownership_score?: number;
  overall_confidence?: number;
  extracted_signals?: string[];
  missed_signals?: string[];
  demonstrated_skills?: string[];
}

function VerdictBanner({ decision }: { decision: HiringDecision }) {
  const isHire = decision.final_recommendation === "STRONG_HIRE" || decision.final_recommendation === "HIRE";

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
    <div className={`flex items-center gap-3 px-4 py-3 border-b ${isHire ? "bg-status-live/10 border-status-live/30" : "bg-status-alert/10 border-status-alert/30"}`}>
      <span className="text-xl">{isHire ? "\u2705" : "\u274C"}</span>
      <div className="flex-1">
        <span className={`font-bold text-caption ${isHire ? "text-status-live" : "text-status-alert"}`}>
          {decision.final_recommendation.replace(/_/g, " ")}
        </span>
        <span className="text-caption text-text-muted ml-2">
          {decision.must_have_demonstrated}/{decision.must_have_total} must-haves
          {decision.consensus_reached ? " · Consensus" : " · No consensus"}
        </span>
      </div>
      <button onClick={handleDownload}
        className="flex items-center gap-1 px-2 py-1 text-caption font-medium rounded-radius-card border border-border-default text-text-secondary hover:bg-surface-hover transition-colors">
        <Download size={12} />
        JSON
      </button>
    </div>
  );
}

function VerdictPlaceholder() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border-default bg-surface-raised">
      <Lock size={16} className="text-text-muted" />
      <div className="flex-1">
        <span className="font-bold text-caption text-text-muted">Verdict Hidden</span>
        <span className="text-caption text-text-muted ml-2">Awaiting Committee Report</span>
      </div>
    </div>
  );
}

export default function EvidencePortfolio({
  events,
  decision,
  verdictRevealed = false,
  sessionId,
  deliberationFullText,
}: {
  events: ParsedVoiceHireEvent[];
  decision: HiringDecision | null;
  verdictRevealed?: boolean;
  sessionId?: string | null;
  deliberationFullText?: { advocate: string; critic: string } | null;
}) {
  const navigate = useNavigate();
  const evidenceEvents = events.filter((e) => e.type === "COVERAGE_MAP_UPDATE");
  const challengeEvents = events.filter((e) => e.type === "INTEGRITY_CHALLENGE");

  if (evidenceEvents.length === 0 && challengeEvents.length === 0 && !decision) return null;

  const showVerdict = decision && verdictRevealed;

  return (
    <div className="border border-border-default rounded-radius-card overflow-hidden mt-2">
      {showVerdict && (
        <>
          <VerdictBanner decision={decision} />
          <div className="px-4 py-2 border-b border-border-default">
            <button onClick={() => navigate(`/report/${sessionId}?back=history`)}
              className="text-caption font-medium px-3 py-1.5 rounded-radius-card bg-accent-gold/10 border border-accent-gold/30 text-accent-gold hover:brightness-110 transition-all">
              View Full Report
            </button>
          </div>
        </>
      )}
      {!showVerdict && decision && <VerdictPlaceholder />}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border-default">
        <h2 className="text-caption font-medium text-text-secondary uppercase tracking-wide flex-1">Evidence</h2>
        <span className="text-caption text-text-muted">
          {evidenceEvents.length} update{evidenceEvents.length !== 1 ? "s" : ""}
          {challengeEvents.length > 0 && (
            <span className="text-status-alert ml-2">
              · {challengeEvents.length} challenge{challengeEvents.length !== 1 ? "s" : ""}
            </span>
          )}
        </span>
      </div>

      <div className="flex flex-col divide-y divide-border-default max-h-72 overflow-y-auto">
        {challengeEvents.map((ev) => (
          <div key={ev.bandMessageId} className="px-3 py-2 text-caption bg-status-alert/5 border-l-2 border-l-status-alert">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle size={12} className="text-status-alert" />
              <span className="font-medium text-status-alert">Integrity Challenge</span>
            </div>
            <p className="text-status-alert/80">{typeof ev.payload === "string" ? ev.payload.slice(0, 120) : JSON.stringify(ev.payload).slice(0, 120)}</p>
          </div>
        ))}

        {evidenceEvents.map((ev) => {
          const payload = ev.payload as EvidencePayload;
          if (!payload || !payload.competencies_tagged) return null;

          return (
            <div key={ev.bandMessageId} className="px-3 py-2 text-caption">
              <div className="flex items-center gap-1.5 mb-1">
                <FileText size={12} className="text-accent-orange" />
                <span className="font-medium text-text-primary">Coverage update</span>
                <span className="text-text-muted font-mono text-caption ml-auto">
                  {new Date(ev.timestamp).toLocaleTimeString()}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-1">
                {payload.competencies_tagged?.map((tag, i) => (
                  <span key={i}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-radius-card text-caption font-medium ${
                      tag.polarity === "POSITIVE" ? "bg-status-live/10 text-status-live"
                        : tag.polarity === "NEGATIVE" ? "bg-status-alert/10 text-status-alert"
                          : "bg-surface-raised text-text-muted"
                    }`}>
                    {tag.polarity === "POSITIVE" ? <CheckCircle size={10} /> : tag.polarity === "NEGATIVE" ? <AlertTriangle size={10} /> : null}
                    {tag.competency_id}: {Math.round(tag.confidence * 100)}%
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-2 text-text-muted">
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
                <p className="mt-1 text-text-muted italic truncate">
                  &ldquo;{payload.raw_transcript.slice(0, 100)}&hellip;&rdquo;
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
