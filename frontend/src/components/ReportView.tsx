import { useEffect, useRef, useState, useMemo } from "react";
import { Monitor, ArrowLeftRight, EyeOff, AlertTriangle, ChevronDown, ChevronRight, X, FileOff, Clock, Download, FileText, Calendar } from "lucide-react";
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

interface ReportViewProps {
  sessionId: string;
  decision: HiringDecision | null;
  deliberationFullText: { advocate: string; critic: string } | null;
  onClose: () => void;
  initialReport?: ReportData | null;
}

const SECTION_NAV = [
  { id: "executive-summary", label: "Executive summary" },
  { id: "competency-scorecard", label: "Competency scorecard" },
  { id: "evidence-timeline", label: "Evidence timeline" },
  { id: "full-transcript", label: "Full transcript" },
  { id: "committee-deliberation", label: "Committee deliberation" },
  { id: "integrity-audit", label: "Integrity audit" },
  { id: "session-metadata", label: "Session metadata" },
] as const;

type VerdictState = "PENDING" | "STRONG_NO_HIRE" | "NO_HIRE" | "HIRE" | "STRONG_HIRE";

const VERDICT_STYLES: Record<VerdictState, { bg: string; border: string; text: string }> = {
  PENDING: { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700" },
  STRONG_NO_HIRE: { bg: "bg-red-50", border: "border-red-200", text: "text-red-800" },
  NO_HIRE: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700" },
  HIRE: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700" },
  STRONG_HIRE: { bg: "bg-green-50", border: "border-green-200", text: "text-green-900" },
};

const STATUS_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  completed: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700" },
  pending: { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700" },
  failed: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700" },
  in_progress: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" },
};

const VERDICT_LABELS: Record<VerdictState, string> = {
  PENDING: "PENDING",
  STRONG_NO_HIRE: "Strong no hire",
  NO_HIRE: "No hire",
  HIRE: "Hire recommended",
  STRONG_HIRE: "Strong hire",
};

const VIOLATION_ICONS: Record<string, typeof Monitor> = {
  EXIT_FULLSCREEN: Monitor,
  TAB_SWITCH: ArrowLeftRight,
  WINDOW_BLUR: EyeOff,
};

const VIOLATION_LABELS: Record<string, string> = {
  EXIT_FULLSCREEN: "Exit fullscreen",
  TAB_SWITCH: "Tab switch",
  WINDOW_BLUR: "Window blur",
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
    <p key={i} className="text-xs text-gray-600 leading-relaxed" style={{ lineHeight: "1.55" }}>
      {p.split(/\n/).map((line, j) => (
        <span key={j}>
          {j > 0 && <br />}
          <span dangerouslySetInnerHTML={{ __html: line }} />
        </span>
      ))}
    </p>
  ));
}

export default function ReportView({ sessionId, decision, deliberationFullText, onClose, initialReport }: ReportViewProps) {
  const [report, setReport] = useState<ReportData | null>(initialReport ?? null);
  const [loading, setLoading] = useState(!initialReport);
  const [activeSection, setActiveSection] = useState("executive-summary");
  const [showAllCompetencies, setShowAllCompetencies] = useState(false);
  const [showAllEvidence, setShowAllEvidence] = useState(false);
  const [showAllViolations, setShowAllViolations] = useState(false);
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);
  const [deliberationExpanded, setDeliberationExpanded] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const barAnimated = useRef(false);

  useEffect(() => {
    if (initialReport) return;
    fetch(`/session/${sessionId}/report`)
      .then((r) => r.json())
      .then((data) => { setReport(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [sessionId, initialReport]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content || !report) return;
    const sections = content.querySelectorAll<HTMLElement>("section[id]");
    if (!sections.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let best: string | null = null;
        let bestRatio = 0;
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio;
            best = entry.target.id;
          }
        }
        if (best) setActiveSection(best);
      },
      { root: content, rootMargin: "-10% 0px -60% 0px", threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5] }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [report]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

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

  const deliberationText = deliberationFullText || decision?.deliberation_transcript || null;

  const violationIcon = (type: string) => {
    const key = Object.keys(VIOLATION_ICONS).find(
      (k) => type.toUpperCase() === k || type.toUpperCase().replace(/\s/g, "_") === k
    );
    return key ? VIOLATION_ICONS[key] : AlertTriangle;
  };

  const violationLabel = (type: string) => {
    const key = Object.keys(VIOLATION_LABELS).find(
      (k) => type.toUpperCase() === k || type.toUpperCase().replace(/\s/g, "_") === k
    );
    return key ? VIOLATION_LABELS[key] : type.replace(/_/g, " ");
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8 text-center" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm text-gray-400">Loading report…</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8 text-center" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm text-red-500">Failed to load report.</p>
          <button onClick={onClose} className="mt-3 text-sm text-gray-500 underline">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="flex flex-col max-w-[860px] w-[95vw] max-h-[90vh] bg-white rounded-lg border-[0.5px] border-gray-200 shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
          <h1 className="text-lg font-semibold text-gray-900">Interview report</h1>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={14} />
            Close
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <nav className="hidden lg:block w-[180px] flex-shrink-0 border-r border-gray-100 p-4 overflow-hidden">
            <ul className="space-y-2">
              {SECTION_NAV.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      contentRef.current?.querySelector(`#${item.id}`)?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className={`block text-xs leading-relaxed py-1 pl-3 -ml-3 border-l-2 transition-colors ${
                      activeSection === item.id
                        ? "border-[#C9A84C] text-gray-900 font-medium"
                        : "border-transparent text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Scrollable Content */}
          <div ref={contentRef} className="flex-1 overflow-y-auto px-4 lg:px-6 py-6 space-y-10">

            {/* ───── Section 1: Executive Summary ───── */}
            <section id="executive-summary">
              <div className={`rounded-lg border ${VERDICT_STYLES[verdict].border} ${VERDICT_STYLES[verdict].bg} p-5`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isPending ? (
                      <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                        <Clock size={20} className="text-yellow-600" />
                      </div>
                    ) : isPositive ? (
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-green-700 text-xl leading-none">✓</span>
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <X size={20} className="text-red-800" />
                      </div>
                    )}
                    <div>
                      <span className={`text-lg font-semibold ${VERDICT_STYLES[verdict].text}`}>
                        {VERDICT_LABELS[verdict]}
                      </span>
                      <p className="text-xs text-gray-500 mt-0.5">Interview Status: {report.status ?? "Pending"}</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {report.status?.toLowerCase() === "completed" && (
                    <div className="flex gap-2">
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                        <Download size={14} />
                        Download Report
                      </button>
                    </div>
                  )}

                  {isPending && (
                    <div className="flex items-center gap-2 text-yellow-600">
                      <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                      <span className="text-xs font-medium">Waiting for completion...</span>
                    </div>
                  )}
                </div>

                {isPending ? (
                  <div className="flex gap-6 mt-4 pt-4 border-t border-yellow-200">
                    <div>
                      <p className="text-xs text-gray-500">Must-haves covered</p>
                      <p className="text-2xl font-medium text-gray-400">—</p>
                    </div>
                    <div className="w-[0.5px] bg-gray-200" />
                    <div>
                      <p className="text-xs text-gray-500">Total competencies</p>
                      <p className="text-2xl font-medium text-gray-400">—</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-6 mt-4 pt-4 border-t border-gray-200">
                    <div>
                      <p className="text-xs text-gray-500">Must-haves covered</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {summary.must_have_covered}/{summary.must_have_total}
                      </p>
                    </div>
                    <div className="w-[0.5px] bg-gray-200" />
                    <div>
                      <p className="text-xs text-gray-500">Total competencies</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {summary.covered}/{summary.total}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ───── Section 2: Competency Scorecard ───── */}
            <section id="competency-scorecard">
              <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FileText size={18} className="text-gray-500" />
                Competency Scorecard
              </h2>
              {scores.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                  <FileOff size={32} className="text-gray-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-600 mb-1">No Competency Data Available</p>
                  <p className="text-xs text-gray-400">The competency scorecard will appear here once the interview is completed and analyzed.</p>
                </div>
              ) : (
                <div>
                  {displayScores.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 py-2.5 border-b-[0.5px] border-gray-100 last:border-b-0"
                    >
                      {c.classification === "MUST_HAVE" && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 flex-shrink-0">
                          Required
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-gray-900 truncate">{c.name}</p>
                        <p className="text-[11px] text-gray-400">{c.domain}</p>
                      </div>
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${
                          c.status === "EXHAUSTED"
                            ? "bg-red-50 text-red-700"
                            : c.status === "UNEXPLORED"
                              ? "bg-gray-50 text-gray-400"
                              : c.status === "COVERED"
                                ? "bg-green-50 text-green-700"
                                : c.status === "WEAK"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-red-50 text-red-700"
                        }`}
                      >
                        {c.status}
                      </span>
                      <div className="flex items-center gap-2 w-[100px] justify-end flex-shrink-0">
                        <span className="text-xs font-medium text-gray-900 w-8 text-right">{c.confidence}%</span>
                        <div className="w-16 h-[3px] rounded-full bg-gray-100 overflow-hidden">
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
                      className="mt-2 text-xs font-medium text-[#C9A84C] hover:text-[#b8993a] transition-colors"
                    >
                      {showAllCompetencies ? `Show less` : `Show all ${scores.length} competencies`}
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* ───── Section 3: Evidence Timeline ───── */}
            <section id="evidence-timeline">
              <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Clock size={18} className="text-gray-500" />
                Evidence Timeline
              </h2>
              {evidence.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                  <Clock size={32} className="text-gray-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-600 mb-1">No Evidence Collected Yet</p>
                  <p className="text-xs text-gray-400">Evidence from candidate responses will be extracted and displayed here during the interview.</p>
                </div>
              ) : (
                <div>
                  {displayEvidence.map((ev, i) => {
                    const tags = ev.competencies_tagged ?? [];
                    const hasTranscript = ev.raw_transcript && ev.raw_transcript.trim().length > 0;
                    return (
                      <div
                        key={ev.evidence_id ?? i}
                        className={`py-2.5 border-b-[0.5px] last:border-b-0 ${
                          hasTranscript ? "border-l-2 border-[#C9A84C] pl-3" : "border-l-2 border-gray-200 pl-3"
                        }`}
                      >
                        {hasTranscript ? (
                          <p className="text-[13px] italic text-gray-900 leading-relaxed">
                            &ldquo;{ev.raw_transcript!.trim()}&rdquo;
                          </p>
                        ) : (
                          <p className="text-[13px] text-gray-400 italic">[No verbal response recorded]</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          {ev.overall_confidence !== undefined && ev.overall_confidence < 0.5 && (
                            <span className="flex items-center gap-1 text-xs text-red-600">
                              <AlertTriangle size={12} />
                              {Math.round(ev.overall_confidence * 100)}% confidence
                            </span>
                          )}
                          {ev.overall_confidence !== undefined && ev.overall_confidence >= 0.5 && (
                            <span className="text-xs text-gray-400">
                              Confidence: {Math.round(ev.overall_confidence * 100)}%
                            </span>
                          )}
                          {tags.map((t, j) => (
                            <span
                              key={j}
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                t.polarity === "POSITIVE"
                                  ? "bg-green-50 text-green-700"
                                  : t.polarity === "NEGATIVE"
                                    ? "bg-red-50 text-red-700"
                                    : "bg-gray-50 text-gray-500"
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
                      className="mt-2 text-xs font-medium text-[#C9A84C] hover:text-[#b8993a] transition-colors"
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
                className="flex items-center justify-between w-full text-left hover:opacity-70 transition-opacity"
              >
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-gray-500" />
                  <div>
                    <h2 className="text-base font-semibold text-gray-800">
                      Full Interview Transcript
                    </h2>
                    {!transcriptExpanded && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatDuration(transcriptDuration)} &middot; {history.length} turn{history.length !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-gray-400">
                  {transcriptExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </span>
              </button>

              {transcriptExpanded && (
                <div className="mt-3 space-y-3">
                  <p className="text-[11px] text-gray-400">
                    {formatDuration(transcriptDuration)} &middot; {history.length} turn{history.length !== 1 ? "s" : ""}
                  </p>
                  {history.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">No conversation history available.</p>
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
                                <p className="text-[10px] font-medium uppercase tracking-wider text-[#C9A84C] mb-1">
                                  {entry.competency_name}
                                </p>
                              )}
                              <div className="flex items-start gap-2">
                                <span className="text-[11px] font-mono text-gray-400 flex-shrink-0 mt-0.5">
                                  {formatHHMMSS(entry.timestamp)}
                                </span>
                                <div className={`flex-1 min-w-0 ${isProbe ? "bg-gray-50 rounded-lg px-3 py-2" : "py-1"}`}>
                                  {isCandidate && !hasText ? (
                                    <p className="text-[13px] text-gray-400 italic">[No response]</p>
                                  ) : (
                                    <p className="text-[13px] text-gray-900 leading-relaxed whitespace-pre-wrap">
                                      {entry.text}
                                    </p>
                                  )}
                                  {isCandidate && entry.audio_url && (
                                    <audio controls src={entry.audio_url} className="mt-1.5 w-full h-8 max-w-full" />
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
              <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <AlertTriangle size={18} className="text-gray-500" />
                Committee Deliberation
              </h2>
              {!deliberationText ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                  <FileOff size={32} className="text-gray-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-600 mb-1">Deliberation Pending</p>
                  <p className="text-xs text-gray-400">The hiring committee will deliberate once the interview is completed. The advocate and critic arguments will appear here.</p>
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Advocate */}
                    <div className="rounded-lg border border-green-200 bg-green-50/50 p-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Advocate</span>
                      </div>
                      <p className={`text-[13px] font-medium ${isPositive ? "text-green-700" : "text-red-800"}`}>
                        {verdict === "STRONG_HIRE" || verdict === "HIRE" ? "Strong hire" : "Hire"}
                      </p>
                      <div className="mt-1.5">
                        {deliberationExpanded
                          ? renderDeliberationText(deliberationText.advocate)
                          : <p className="text-xs text-gray-600 leading-relaxed" style={{ lineHeight: "1.55" }}>{truncateSentences(deliberationText.advocate, 4)}</p>
                        }
                      </div>
                    </div>
                    {/* Critic */}
                    <div className="rounded-lg border border-red-200 bg-red-50/50 p-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Critic</span>
                      </div>
                      <p className={`text-[13px] font-medium ${!isPositive ? "text-green-700" : "text-red-800"}`}>
                        No hire
                      </p>
                      <div className="mt-1.5">
                        {deliberationExpanded
                          ? renderDeliberationText(deliberationText.critic)
                          : <p className="text-xs text-gray-600 leading-relaxed" style={{ lineHeight: "1.55" }}>{truncateSentences(deliberationText.critic, 4)}</p>
                        }
                      </div>
                    </div>
                  </div>
                  {/* Consensus strip */}
                  <div className="mt-3 bg-gray-50 rounded-lg px-3 py-2.5 flex items-center gap-3">
                    <span className="text-[11px] text-gray-400 font-medium">Consensus</span>
                    <span
                      className={`text-xs font-medium ${
                        !decision?.consensus_reached
                          ? "text-red-600"
                          : isPositive
                            ? "text-green-700"
                            : "text-red-800"
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
                    className="mt-2 text-xs font-medium text-[#C9A84C] hover:text-[#b8993a] transition-colors"
                  >
                    {deliberationExpanded ? "Show less" : "Read full deliberation"}
                  </button>
                </div>
              )}
            </section>

            {/* ───── Section 6: Integrity Audit ───── */}
            <section id="integrity-audit">
              <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Monitor size={18} className="text-gray-500" />
                Integrity Audit
              </h2>

              {/* Summary Card */}
              <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                      <span className="text-xl font-bold text-red-600">{violations.length}</span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Total Violations</p>
                      <p className="text-sm font-medium text-gray-900">
                        {violations.reduce((sum, v) => sum + v.points, 0)} integrity points
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 mb-1">Enforcement Mode</p>
                    <span className="inline-block px-2.5 py-1 rounded-md bg-white border border-gray-200 text-xs font-medium text-gray-900">
                      {enforcement?.level?.replace(/_/g, " ") ?? "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {violations.length === 0 ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                    <span className="text-green-700 text-2xl">✓</span>
                  </div>
                  <p className="text-sm font-medium text-green-700 mb-1">No Violations Detected</p>
                  <p className="text-xs text-gray-600">The candidate maintained integrity throughout the interview session.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {displayViolations.map((v, i) => {
                    const Icon = violationIcon(v.type);
                    const isHighSeverity = v.points >= 2;
                    return (
                      <div
                        key={i}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          isHighSeverity
                            ? "bg-red-50 border-red-200"
                            : "bg-gray-50 border-gray-200"
                        }`}
                      >
                        <Icon size={18} className={isHighSeverity ? "text-red-500" : "text-gray-400"} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{violationLabel(v.type)}</p>
                          <p className="text-xs text-gray-500 font-mono">
                            {new Date(v.timestamp).toLocaleTimeString("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                              hour12: false,
                            })}
                          </p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                          isHighSeverity
                            ? "bg-red-100 text-red-700 border border-red-300"
                            : "bg-gray-100 text-gray-600 border border-gray-300"
                        }`}>
                          {v.points} pt
                        </span>
                      </div>
                    );
                  })}
                  {violations.length > 3 && (
                    <button
                      onClick={() => setShowAllViolations(!showAllViolations)}
                      className="mt-3 text-sm font-medium text-[#C9A84C] hover:text-[#b8993a] transition-colors"
                    >
                      {showAllViolations
                        ? "Show less"
                        : `View all ${violations.length} violations`}
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* ───── Section 7: Session Metadata ───── */}
            <section id="session-metadata">
              <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Calendar size={18} className="text-gray-500" />
                Session Metadata
              </h2>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Session ID</p>
                    <p className="text-sm font-mono text-gray-900 break-all">{sessionId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Status</p>
                    <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium ${
                      STATUS_STYLES[report.status?.toLowerCase() ?? "pending"]?.bg ?? "bg-gray-50"
                    } ${
                      STATUS_STYLES[report.status?.toLowerCase() ?? "pending"]?.text ?? "text-gray-700"
                    } ${
                      STATUS_STYLES[report.status?.toLowerCase() ?? "pending"]?.border ?? "border-gray-200"
                    } border`}>
                      {report.status ?? "Pending"}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 mb-1">Model</p>
                    <p className="text-xs font-mono text-gray-900">
                      {decision?.model_used ?? (report as any).model_used ?? "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Consensus</p>
                    <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-medium ${
                      decision?.consensus_reached ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-600 border-gray-200"
                    } border`}>
                      {decision?.consensus_reached ? "Reached" : "Not reached"}
                    </span>
                  </div>
                </div>
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
