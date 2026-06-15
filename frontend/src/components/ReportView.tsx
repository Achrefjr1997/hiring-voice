import { useEffect, useState } from "react";
import type { HiringDecision } from "../types";

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
}

interface ReportViewProps {
  sessionId: string;
  decision: HiringDecision | null;
  deliberationFullText: { advocate: string; critic: string } | null;
  onClose: () => void;
}

function statusColor(status: string): string {
  switch (status) {
    case "COVERED": return "bg-green-100 border-green-400 text-green-800";
    case "WEAK": return "bg-yellow-100 border-yellow-400 text-yellow-800";
    case "INSUFFICIENT": return "bg-red-100 border-red-400 text-red-800";
    case "EXHAUSTED": return "bg-orange-100 border-orange-400 text-orange-800";
    default: return "bg-gray-100 border-gray-300 text-gray-600";
  }
}

function classificationBadge(cls: string): { label: string; style: string } {
  if (cls === "MUST_HAVE") return { label: "Required", style: "bg-blue-100 text-blue-700" };
  return { label: "Nice-to-have", style: "bg-purple-100 text-purple-700" };
}

export default function ReportView({ sessionId, decision, deliberationFullText, onClose }: ReportViewProps) {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/session/${sessionId}/report`)
      .then((r) => r.json())
      .then((data) => { setReport(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center" onClick={onClose}>
        <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-8" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm text-gray-400">Loading report…</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center" onClick={onClose}>
        <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-8" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm text-red-500">Failed to load report.</p>
          <button onClick={onClose} className="mt-2 text-sm text-gray-500 underline">Close</button>
        </div>
      </div>
    );
  }

  const {
    competency_scorecard,
    coverage_summary,
    evidence_portfolio,
  } = report;

  const recommendation = decision?.final_recommendation ?? "PENDING";
  const isHire = recommendation === "STRONG_HIRE" || recommendation === "HIRE";

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-start justify-center pt-8 pb-8" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 flex items-center justify-between px-6 py-3 z-10">
          <h1 className="text-lg font-semibold text-gray-900">Interview Report</h1>
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">&times; Close</button>
        </div>

        <div className="p-6 space-y-6">
          <section>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Executive Summary</h2>
            <div className={`rounded-lg border-2 p-4 ${isHire ? "border-green-400 bg-green-50" : "border-red-400 bg-red-50"}`}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{isHire ? "✅" : "❌"}</span>
                <span className={`text-lg font-bold ${isHire ? "text-green-800" : "text-red-800"}`}>
                  {recommendation.replace(/_/g, " ")}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Must-haves covered</p>
                  <p className="font-semibold">{coverage_summary.must_have_covered}/{coverage_summary.must_have_total}</p>
                </div>
                <div>
                  <p className="text-gray-500">Total competencies</p>
                  <p className="font-semibold">{coverage_summary.covered}/{coverage_summary.total}</p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Competency Scorecard</h2>
            <div className="grid gap-2">
              {competency_scorecard.map((c) => {
                const badge = classificationBadge(c.classification);
                return (
                  <div key={c.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-200">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${badge.style}`}>{badge.label}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                      <p className="text-[11px] text-gray-400">{c.domain}</p>
                    </div>
                    <div className={`text-xs font-medium px-2 py-0.5 rounded border ${statusColor(c.status)}`}>
                      {c.status}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-800">{c.confidence}%</p>
                      <p className="text-[10px] text-gray-400">{c.evidence_count} ev</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Evidence Timeline</h2>
            {evidence_portfolio.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No evidence collected.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {[...evidence_portfolio].reverse().map((ev, i) => {
                  const tags = ev.competencies_tagged ?? [];
                  const primaryTag = tags[0];
                  return (
                    <div key={ev.evidence_id ?? i} className="flex gap-3 px-3 py-2 rounded-lg border border-gray-100">
                      <div className="flex flex-col items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${primaryTag?.polarity === "POSITIVE" ? "bg-green-400" : primaryTag?.polarity === "NEGATIVE" ? "bg-red-400" : "bg-gray-300"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        {tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-1">
                            {tags.map((t, j) => (
                              <span key={j} className={`text-[10px] font-medium px-1 py-0.5 rounded ${
                                t.polarity === "POSITIVE" ? "bg-green-50 text-green-700"
                                  : t.polarity === "NEGATIVE" ? "bg-red-50 text-red-700"
                                    : "bg-gray-50 text-gray-500"
                              }`}>
                                {t.competency_id}: {Math.round(t.confidence * 100)}%
                              </span>
                            ))}
                          </div>
                        )}
                        {ev.raw_transcript && (
                          <p className="text-xs text-gray-600 italic truncate">"{ev.raw_transcript.slice(0, 150)}…"</p>
                        )}
                        {ev.overall_confidence !== undefined && (
                          <p className="text-[11px] text-gray-400 mt-0.5">Confidence: {Math.round(ev.overall_confidence * 100)}%</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Committee Deliberation</h2>
            {deliberationFullText ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <h3 className="text-xs font-semibold text-blue-800 uppercase mb-2">Advocate</h3>
                  <p className="text-xs text-blue-900 whitespace-pre-wrap leading-relaxed">{deliberationFullText.advocate}</p>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <h3 className="text-xs font-semibold text-red-800 uppercase mb-2">Critic</h3>
                  <p className="text-xs text-red-900 whitespace-pre-wrap leading-relaxed">{deliberationFullText.critic}</p>
                </div>
              </div>
            ) : decision?.deliberation_transcript ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <h3 className="text-xs font-semibold text-blue-800 uppercase mb-2">Advocate</h3>
                  <p className="text-xs text-blue-900 whitespace-pre-wrap leading-relaxed">{decision.deliberation_transcript.advocate}</p>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <h3 className="text-xs font-semibold text-red-800 uppercase mb-2">Critic</h3>
                  <p className="text-xs text-red-900 whitespace-pre-wrap leading-relaxed">{decision.deliberation_transcript.critic}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">Deliberation text not available.</p>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Session Metadata</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="px-3 py-2 rounded bg-gray-50">
                <p className="text-gray-500">Session ID</p>
                <p className="font-mono text-xs">{sessionId}</p>
              </div>
              <div className="px-3 py-2 rounded bg-gray-50">
                <p className="text-gray-500">Status</p>
                <p className="font-medium text-gray-800">{report.status}</p>
              </div>
              <div className="px-3 py-2 rounded bg-gray-50">
                <p className="text-gray-500">Model</p>
                <p className="font-mono text-xs">{decision?.model_used ?? "N/A"}</p>
              </div>
              <div className="px-3 py-2 rounded bg-gray-50">
                <p className="text-gray-500">Consensus</p>
                <p className="font-medium text-gray-800">{decision?.consensus_reached ? "Reached" : "Not reached"}</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
