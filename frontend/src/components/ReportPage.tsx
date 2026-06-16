import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import type { HiringDecision, IntegrityViolation, EnforcementConfig } from "../types";

interface ConversationEntry {
  type: string;
  timestamp: number;
  competency_id?: string;
  competency_name?: string;
  text: string;
  audio_url?: string | null;
}

interface CompetencyScore {
  id: string;
  name: string;
  domain: string;
  classification: string;
  status: string;
  confidence: number;
  evidence_count: number;
  depth_required: string;
}

interface EvidenceNode {
  evidence_id?: string;
  raw_transcript?: string;
  competencies_tagged?: Array<{
    competency_id: string;
    confidence: number;
    polarity: string;
  }>;
  overall_confidence?: number;
  ownership_score?: number;
}

interface ReportData {
  session_id: string;
  status: string;
  competency_scorecard: CompetencyScore[];
  coverage_summary: {
    total: number;
    covered: number;
    must_have_total: number;
    must_have_covered: number;
  };
  evidence_portfolio: EvidenceNode[];
  conversation_history: ConversationEntry[];
  integrity_violations: IntegrityViolation[];
  enforcement_config: EnforcementConfig;
}

interface HistoryEvent {
  event_type: string;
  payload: Record<string, unknown>;
}

interface HistoryData {
  session: {
    id: string;
    candidate_name: string | null;
    status: string;
  };
  report: Record<string, unknown> | null;
  events?: HistoryEvent[];
}



type VerdictState = "PENDING" | "STRONG_NO_HIRE" | "NO_HIRE" | "HIRE" | "STRONG_HIRE";

const VERDICT_STYLES: Record<VerdictState, { bg: string; border: string; text: string }> = {
  PENDING: { bg: "#FEF2F2", border: "#FECACA", text: "#DC2626" },
  STRONG_NO_HIRE: { bg: "#FEF2F2", border: "#FECACA", text: "#991B1B" },
  NO_HIRE: { bg: "#FEF2F2", border: "#FECACA", text: "#B91C1C" },
  HIRE: { bg: "#F0FDF4", border: "#BBF7D0", text: "#166534" },
  STRONG_HIRE: { bg: "#F0FDF4", border: "#BBF7D0", text: "#14532D" },
};

const VERDICT_LABELS: Record<VerdictState, string> = {
  PENDING: "PENDING",
  STRONG_NO_HIRE: "Strong no hire",
  NO_HIRE: "No hire",
  HIRE: "Hire recommended",
  STRONG_HIRE: "Strong hire",
};

function getInitialVerdict(decision: HiringDecision | null): VerdictState {
  if (!decision) return "PENDING";
  const r = decision.final_recommendation;
  if (r === "STRONG_HIRE") return "STRONG_HIRE";
  if (r === "HIRE") return "HIRE";
  if (r === "NO_HIRE") return "NO_HIRE";
  if (r === "STRONG_NO_HIRE") return "STRONG_NO_HIRE";
  return "PENDING";
}

function formatHHMMSS(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatDuration(seconds: number): string {
  const totalSeconds = Math.round(seconds);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function truncateSentences(text: string, max: number): string {
  const parts = text.match(/[^.!?]*[.!?]+/g);
  if (!parts || parts.length <= max) return text;
  return parts.slice(0, max).join("") + " ...";
}

function renderDeliberationText(text: string): React.ReactNode[] {
  const sanitized = text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .trim();
  const paragraphs = sanitized.split(/\n\s*\n/);
  return paragraphs.map((p, i) => (
    <p key={i} className="text-text-secondary text-caption" style={{ lineHeight: "1.55" }}>
      {p.split(/\n/).map((line, j) => (
        <span key={j}>
          {j > 0 && <br />}
          <span dangerouslySetInnerHTML={{ __html: line }} />
        </span>
      ))}
    </p>
  ));
}

function extractDecision(events: HistoryEvent[] | undefined): {
  decision: HiringDecision | null;
  deliberationText: { advocate: string; critic: string } | null;
} {
  if (!events) return { decision: null, deliberationText: null };
  for (const ev of events) {
    if (ev.event_type === "DELIBERATION") {
      const p = ev.payload;
      if (p && typeof p === "object") {
        const decision: HiringDecision = {
          session_id: (p.session_id as string) ?? "",
          final_recommendation: (p.final_recommendation as HiringDecision["final_recommendation"]) ?? "PENDING" as any,
          competency_verdicts: (p.competency_verdicts as HiringDecision["competency_verdicts"]) ?? {},
          evidence_gaps: (p.evidence_gaps as string[]) ?? [],
          must_have_total: (p.must_have_total as number) ?? 0,
          must_have_demonstrated: (p.must_have_demonstrated as number) ?? 0,
          consensus_reached: (p.consensus_reached as boolean) ?? false,
          deliberation_transcript: (p.deliberation_transcript as { advocate: string; critic: string }) ?? { advocate: "", critic: "" },
          model_used: (p.model_used as string) ?? "",
        };
        const dt = decision.deliberation_transcript;
        const deliberationText = dt?.advocate || dt?.critic ? dt : null;
        return { decision, deliberationText };
      }
      break;
    }
  }
  return { decision: null, deliberationText: null };
}

export default function ReportPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [report, setReport] = useState<ReportData | null>(null);
  const [decision, setDecision] = useState<HiringDecision | null>(null);
  const [deliberationText, setDeliberationText] = useState<{ advocate: string; critic: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");


  const [showAllCompetencies, setShowAllCompetencies] = useState(false);
  const [showAllEvidence, setShowAllEvidence] = useState(false);
  const [showAllViolations, setShowAllViolations] = useState(false);
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);
  const [deliberationExpanded, setDeliberationExpanded] = useState(false);

  useEffect(() => {
    if (!sessionId || !token) return;
    setLoading(true);
    setError("");

    fetch(`/session/${sessionId}/history`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (r.status === 401) { setError("unauthorized"); return null; }
        if (r.status === 404) { setError("not_found"); return null; }
        if (!r.ok) { setError("failed"); return null; }
        return r.json() as Promise<HistoryData>;
      })
      .then((data) => {
        if (data) {
          if (data.report) {
            setReport(data.report as unknown as ReportData);
          } else {
            setError("no_report");
          }
          const extracted = extractDecision(data.events);
          setDecision(extracted.decision);
          setDeliberationText(extracted.deliberationText);
        }
        setLoading(false);
      })
      .catch(() => { setError("network"); setLoading(false); });
  }, [sessionId, token]);

  const verdict = useMemo(() => getInitialVerdict(decision), [decision]);
  const isPositive = verdict === "HIRE" || verdict === "STRONG_HIRE";
  const isPending = verdict === "PENDING";

  const scores = useMemo(() => report?.competency_scorecard ?? [], [report]);
  const evidence = useMemo(() => report?.evidence_portfolio ?? [], [report]);
  const history = useMemo(() => report?.conversation_history ?? [], [report]);
  const violations = useMemo(() => report?.integrity_violations ?? [], [report]);
  const enforcement = useMemo(() => report?.enforcement_config ?? null, [report]);
  const summary = useMemo(() => report?.coverage_summary ?? { total: 0, covered: 0, must_have_total: 0, must_have_covered: 0 }, [report]);

  const displayScores = useMemo(() => {
    if (scores.length > 5 && !showAllCompetencies) return scores.slice(0, 4);
    return scores;
  }, [scores, showAllCompetencies]);

  const displayEvidence = useMemo(() => {
    if (evidence.length > 3 && !showAllEvidence) return evidence.slice(0, 3);
    return evidence;
  }, [evidence, showAllEvidence]);

  const displayViolations = useMemo(() => {
    if (violations.length > 3 && !showAllViolations) return violations.slice(0, 3);
    return violations;
  }, [violations, showAllViolations]);

  const transcriptDuration = useMemo(() => {
    if (!history.length) return 0;
    const ts = history.map((e) => e.timestamp);
    return Math.max(0, Math.max(...ts) - Math.min(...ts));
  }, [history]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-caption text-text-muted">Loading report…</p>
      </div>
    );
  }

  if (error || !report) {
    const messages: Record<string, string> = {
      not_found: "Session not found.",
      unauthorized: "You don't have access to this session.",
      no_report: "This session was completed but no report data is available.",
      failed: "Failed to load report.",
      network: "Network error. Check your connection.",
    };
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <p className="text-caption text-text-muted">{messages[error] ?? "Failed to load report."}</p>
        <button onClick={() => navigate(-1)} className="mt-3 text-caption text-text-muted underline hover:text-text-primary">
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 py-8 px-8 space-y-10 overflow-y-auto">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-caption text-text-muted hover:text-text-primary transition-colors"
      >
        <i className="ti ti-arrow-left text-sm" />
        Back
      </button>

        {/* ───── Section 1: Executive Summary ───── */}
        <section id="executive-summary">
          <div
            className="rounded-lg border p-4"
            style={{ backgroundColor: VERDICT_STYLES[verdict].bg, borderColor: VERDICT_STYLES[verdict].border, borderWidth: 1 }}
          >
            <div className="flex items-center gap-3">
              {isPending ? (
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#FECACA" }}>
                  <i className="ti ti-x text-sm" style={{ color: "#DC2626" }} />
                </div>
              ) : isPositive ? (
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#BBF7D0" }}>
                  <i className="ti ti-check text-sm" style={{ color: "#166534" }} />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#FECACA" }}>
                  <i className="ti ti-x text-sm" style={{ color: "#991B1B" }} />
                </div>
              )}
              <span className="text-sm font-medium" style={{ color: VERDICT_STYLES[verdict].text }}>
                {VERDICT_LABELS[verdict]}
              </span>
            </div>
            {isPending ? (
              <div className="flex gap-6 mt-3">
                <div>
                  <p className="text-[11px] text-text-muted">Must-haves covered</p>
                  <p className="text-xl font-medium text-text-muted">—</p>
                </div>
                <div className="w-[0.5px]" style={{ backgroundColor: "#FECACA" }} />
                <div>
                  <p className="text-[11px] text-text-muted">Total competencies</p>
                  <p className="text-xl font-medium text-text-muted">—</p>
                </div>
              </div>
            ) : (
              <div className="flex gap-6 mt-3">
                <div>
                  <p className="text-[11px] text-text-muted">Must-haves covered</p>
                  <p className="text-xl font-medium" style={{ color: isPositive ? "#166534" : "#991B1B" }}>
                    {summary.must_have_covered}/{summary.must_have_total}
                  </p>
                </div>
                <div className="w-[0.5px]" style={{ backgroundColor: isPositive ? "#BBF7D0" : "#FECACA" }} />
                <div>
                  <p className="text-[11px] text-text-muted">Total competencies</p>
                  <p className="text-xl font-medium" style={{ color: isPositive ? "#166534" : "#991B1B" }}>
                    {summary.covered}/{summary.total}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ───── Section 2: Competency Scorecard ───── */}
        <section id="competency-scorecard">
          <h2 className="text-caption font-medium text-text-secondary uppercase tracking-wide mb-3">Competency Scorecard</h2>
          {scores.length === 0 ? (
            <p className="text-caption text-text-muted italic">No competency data available.</p>
          ) : (
            <div>
              {displayScores.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 py-2.5 border-b border-border-default last:border-b-0"
                  style={{ borderBottomWidth: "0.5px" }}
                >
                  {c.classification === "MUST_HAVE" && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}>
                      Required
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-text-primary truncate">{c.name}</p>
                    <p className="text-[11px] text-text-muted">{c.domain}</p>
                  </div>
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${
                      c.status === "EXHAUSTED"
                        ? "bg-status-alert/10 text-status-alert"
                        : c.status === "UNEXPLORED"
                          ? "bg-surface-raised text-text-muted"
                          : c.status === "COVERED"
                            ? "bg-status-live/10 text-status-live"
                            : c.status === "WEAK"
                              ? "text-status-warning"
                              : "bg-status-alert/10 text-status-alert"
                    }`}
                    style={c.status === "WEAK" ? { backgroundColor: "rgba(245, 158, 11, 0.1)" } : {}}
                  >
                    {c.status}
                  </span>
                  <div className="flex items-center gap-2 w-[100px] justify-end flex-shrink-0">
                    <span className="text-xs font-medium text-text-primary w-8 text-right">{c.confidence}%</span>
                    <div className="w-16 h-[3px] rounded-full overflow-hidden" style={{ backgroundColor: "var(--color-border-default)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-400 ease-out"
                        style={{
                          width: `${c.confidence}%`,
                          backgroundColor: "#C9A84C",
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
              {scores.length > 5 && (
                <button
                  onClick={() => setShowAllCompetencies(!showAllCompetencies)}
                  className="mt-2 text-xs font-medium transition-colors"
                  style={{ color: "#C9A84C" }}
                >
                  {showAllCompetencies ? "Show less" : `Show all ${scores.length} competencies`}
                </button>
              )}
            </div>
          )}
        </section>

        {/* ───── Section 3: Evidence Timeline ───── */}
        <section id="evidence-timeline">
          <h2 className="text-caption font-medium text-text-secondary uppercase tracking-wide mb-3">Evidence Timeline</h2>
          {evidence.length === 0 ? (
            <p className="text-caption text-text-muted italic">No evidence collected.</p>
          ) : (
            <div>
              {displayEvidence.map((ev, i) => {
                const tags = ev.competencies_tagged ?? [];
                const hasTranscript = ev.raw_transcript && ev.raw_transcript.trim().length > 0;
                return (
                  <div
                    key={ev.evidence_id ?? i}
                    className="py-2.5 border-b border-border-default last:border-b-0 pl-3"
                    style={{
                      borderBottomWidth: "0.5px",
                      borderLeft: hasTranscript ? "2px solid #C9A84C" : "2px solid var(--color-border-default)",
                    }}
                  >
                    {hasTranscript ? (
                      <p className="text-[13px] italic text-text-primary leading-relaxed">
                        &ldquo;{ev.raw_transcript!.trim()}&rdquo;
                      </p>
                    ) : (
                      <p className="text-[13px] text-text-muted italic">[No verbal response recorded]</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {ev.overall_confidence !== undefined && ev.overall_confidence < 0.5 && (
                        <span className="flex items-center gap-1 text-xs text-status-alert">
                          <i className="ti ti-alert-triangle text-xs" />
                          {Math.round(ev.overall_confidence * 100)}% confidence
                        </span>
                      )}
                      {ev.overall_confidence !== undefined && ev.overall_confidence >= 0.5 && (
                        <span className="text-xs text-text-muted">
                          Confidence: {Math.round(ev.overall_confidence * 100)}%
                        </span>
                      )}
                      {tags.map((t, j) => (
                        <span
                          key={j}
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            t.polarity === "POSITIVE"
                              ? "bg-status-live/10 text-status-live"
                              : t.polarity === "NEGATIVE"
                                ? "bg-status-alert/10 text-status-alert"
                                : "bg-surface-raised text-text-muted"
                          }`}
                        >
                          {t.competency_id}: {Math.round(t.confidence * 100)}%
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
              {evidence.length > 3 && (
                <button
                  onClick={() => setShowAllEvidence(!showAllEvidence)}
                  className="mt-2 text-xs font-medium transition-colors"
                  style={{ color: "#C9A84C" }}
                >
                  {showAllEvidence ? "Show less" : `Show all ${evidence.length} items`}
                </button>
              )}
            </div>
          )}
        </section>

        {/* ───── Section 4: Full Transcript ───── */}
        <section id="full-transcript">
          <button
            onClick={() => setTranscriptExpanded(!transcriptExpanded)}
            className="flex items-center justify-between w-full text-left"
          >
            <div>
              <h2 className="text-caption font-medium text-text-secondary uppercase tracking-wide">
                Full Interview Transcript
              </h2>
              {!transcriptExpanded && (
                <p className="text-[11px] text-text-muted mt-0.5">
                  {formatDuration(transcriptDuration)} &middot; {history.length} turn{history.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            <i className={`ti ${transcriptExpanded ? "ti-chevron-down" : "ti-chevron-right"} text-text-muted`} />
          </button>

          {transcriptExpanded && (
            <div className="mt-3 space-y-3">
              <p className="text-[11px] text-text-muted">
                {formatDuration(transcriptDuration)} &middot; {history.length} turn{history.length !== 1 ? "s" : ""}
              </p>
              {history.length === 0 ? (
                <p className="text-caption text-text-muted italic">No conversation history available.</p>
              ) : (
                <div>
                  {(() => {
                    let lastCompetency = "";
                    return history.map((entry, i) => {
                      const isProbe = entry.type === "probe" || entry.type === "ai";
                      const isCandidate = entry.type === "response" || entry.type === "candidate";
                      const isNewCompetency = isProbe && entry.competency_name && entry.competency_name !== lastCompetency;
                      if (isNewCompetency && entry.competency_name) {
                        lastCompetency = entry.competency_name;
                      }
                      const hasText = entry.text && entry.text.trim().length > 0;
                      return (
                        <div key={i} className="mb-2">
                          {isNewCompetency && entry.competency_name && (
                            <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: "#C9A84C" }}>
                              {entry.competency_name}
                            </p>
                          )}
                          <div className="flex items-start gap-2">
                            <span className="text-[11px] font-mono text-text-muted flex-shrink-0 mt-0.5">
                              {formatHHMMSS(entry.timestamp)}
                            </span>
                            <div className={`flex-1 min-w-0 ${isProbe ? "bg-surface-raised rounded-lg px-3 py-2" : "py-1"}`}>
                              {isCandidate && !hasText ? (
                                <p className="text-[13px] text-text-muted italic">[No response]</p>
                              ) : (
                                <p className="text-[13px] text-text-primary leading-relaxed whitespace-pre-wrap">
                                  {entry.text}
                                </p>
                              )}
                              {isCandidate && entry.audio_url && (
                                <audio controls src={entry.audio_url} className="mt-1.5 w-full h-8" />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          )}
        </section>

        {/* ───── Section 5: Committee Deliberation ───── */}
        <section id="committee-deliberation">
          <h2 className="text-caption font-medium text-text-secondary uppercase tracking-wide mb-3">Committee Deliberation</h2>
          {!deliberationText ? (
            <p className="text-caption text-text-muted italic">Deliberation text not available.</p>
          ) : (
            <div>
              <div className="grid grid-cols-2 gap-4">
                {/* Advocate */}
                <div className="rounded-lg p-3" style={{ border: "1px solid var(--color-border-default)", backgroundColor: "var(--color-surface-default)" }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="w-2 h-2 rounded-full bg-status-live" />
                    <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted">Advocate</span>
                  </div>
                  <p className={`text-[13px] font-medium ${isPositive ? "text-status-live" : "text-status-alert"}`}>
                    {verdict === "STRONG_HIRE" || verdict === "HIRE" ? "Strong hire" : "Hire"}
                  </p>
                  <div className="mt-1.5">
                    {deliberationExpanded
                      ? renderDeliberationText(deliberationText.advocate)
                      : <p className="text-text-secondary text-caption" style={{ lineHeight: "1.55" }}>{truncateSentences(deliberationText.advocate, 4)}</p>
                    }
                  </div>
                </div>
                {/* Critic */}
                <div className="rounded-lg p-3" style={{ border: "1px solid var(--color-border-default)", backgroundColor: "var(--color-surface-default)" }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="w-2 h-2 rounded-full bg-status-alert" />
                    <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted">Critic</span>
                  </div>
                  <p className={`text-[13px] font-medium ${!isPositive ? "text-status-live" : "text-status-alert"}`}>
                    No hire
                  </p>
                  <div className="mt-1.5">
                    {deliberationExpanded
                      ? renderDeliberationText(deliberationText.critic)
                      : <p className="text-text-secondary text-caption" style={{ lineHeight: "1.55" }}>{truncateSentences(deliberationText.critic, 4)}</p>
                    }
                  </div>
                </div>
              </div>
              {/* Consensus strip */}
              <div className="mt-3 rounded-lg px-3 py-2.5 flex items-center gap-3" style={{ backgroundColor: "var(--color-surface-raised)" }}>
                <span className="text-[11px] text-text-muted font-medium">Consensus</span>
                <span
                  className={`text-xs font-medium ${
                    !decision?.consensus_reached
                      ? "text-status-alert"
                      : isPositive
                        ? "text-status-live"
                        : "text-status-alert"
                  }`}
                >
                  {decision?.consensus_reached
                    ? isPositive
                      ? "Hire"
                      : "No hire"
                    : "Not reached"}
                </span>
              </div>
              {/* Read full toggle */}
              <button
                onClick={() => setDeliberationExpanded(!deliberationExpanded)}
                className="mt-2 text-xs font-medium transition-colors"
                style={{ color: "#C9A84C" }}
              >
                {deliberationExpanded ? "Show less" : "Read full deliberation"}
              </button>
            </div>
          )}
        </section>

        {/* ───── Section 6: Integrity Audit ───── */}
        <section id="integrity-audit">
          <h2 className="text-caption font-medium text-text-secondary uppercase tracking-wide mb-3">Integrity Audit</h2>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[22px] font-medium text-status-alert leading-none">{violations.length}</span>
              <span className="text-[11px] text-text-muted">
                violation{violations.length !== 1 ? "s" : ""} recorded
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-text-muted">Enforcement mode</span>
              <span className="text-[13px] font-medium text-text-primary">
                {enforcement?.level?.replace(/_/g, " ") ?? "N/A"}
              </span>
            </div>
          </div>
          {violations.length === 0 ? (
            <p className="text-caption text-text-muted italic">No integrity violations detected.</p>
          ) : (
            <div>
              {displayViolations.map((v, i) => {
                const isHighSeverity = v.points >= 2;
                const iconName = v.type === "EXIT_FULLSCREEN" ? "ti-browser"
                  : v.type === "TAB_SWITCH" ? "ti-switch-horizontal"
                    : v.type === "WINDOW_BLUR" ? "ti-eye-off"
                      : "ti-alert-circle";
                const label = v.type === "EXIT_FULLSCREEN" ? "Exit fullscreen"
                  : v.type === "TAB_SWITCH" ? "Tab switch"
                    : v.type === "WINDOW_BLUR" ? "Window blur"
                      : v.type.replace(/_/g, " ");
                return (
                  <div
                    key={i}
                    className="flex items-center gap-2 py-2 border-b border-border-default last:border-b-0"
                    style={{ borderBottomWidth: "0.5px" }}
                  >
                    <i className={`ti ${iconName} text-sm ${isHighSeverity ? "text-status-alert" : "text-text-muted"}`} />
                    <span className="text-xs text-text-primary flex-1">{label}</span>
                    <span className="text-[11px] font-mono text-text-muted">
                      {new Date(v.timestamp).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}
                    </span>
                    <span className="text-[11px] font-medium text-status-alert w-8 text-right">{v.points}pt</span>
                  </div>
                );
              })}
              {violations.length > 3 && (
                <button
                  onClick={() => setShowAllViolations(!showAllViolations)}
                  className="mt-2 text-xs font-medium transition-colors"
                  style={{ color: "#C9A84C" }}
                >
                  {showAllViolations
                    ? "Show less"
                    : `+ ${violations.length - 3} more violation${violations.length - 3 !== 1 ? "s" : ""}`}
                </button>
              )}
            </div>
          )}
        </section>

        {/* ───── Section 7: Session Metadata ───── */}
        <section id="session-metadata">
          <h2 className="text-caption font-medium text-text-secondary uppercase tracking-wide mb-3">Session Metadata</h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md px-3 py-2.5" style={{ backgroundColor: "var(--color-surface-raised)" }}>
              <p className="text-[11px] text-text-muted">Session ID</p>
              <p className="text-[13px] font-medium font-mono text-text-primary">{sessionId}</p>
            </div>
            <div className="rounded-md px-3 py-2.5" style={{ backgroundColor: "var(--color-surface-raised)" }}>
              <p className="text-[11px] text-text-muted">Status</p>
              <p className="text-[13px] font-medium font-mono text-text-primary">{report.status ?? "N/A"}</p>
            </div>
            <div className="rounded-md px-3 py-2.5 col-span-2" style={{ backgroundColor: "var(--color-surface-raised)" }}>
              <p className="text-[11px] text-text-muted">Model</p>
              <p className="text-[11px] font-medium font-mono text-text-primary leading-relaxed">
                {decision?.model_used ?? (report as any).model_used ?? "N/A"}
              </p>
            </div>
            <div className="rounded-md px-3 py-2.5" style={{ backgroundColor: "var(--color-surface-raised)" }}>
              <p className="text-[11px] text-text-muted">Consensus</p>
              <p className="text-[13px] font-medium font-mono text-text-primary">
                {decision?.consensus_reached ? "Reached" : "Not reached"}
              </p>
            </div>
          </div>
        </section>

      </div>
  );
}
