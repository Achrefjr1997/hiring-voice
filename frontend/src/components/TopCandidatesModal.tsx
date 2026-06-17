import { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { useSidebar } from "./SidebarContext";

interface CandidateInfo {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  skills?: string[];
}

interface MatchedCandidate {
  candidate_id: string;
  score: number;
  rank: number;
  strengths: string[];
  gaps: string[];
  reasoning: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  skills?: string[];
}

interface TopCandidatesModalProps {
  jobId: string;
  jobTitle: string;
  onClose: () => void;
}

function getInitials(first: string, last: string): string {
  return `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase() || "?";
}

function getGradient(score: number): string {
  if (score >= 71) return "linear-gradient(90deg, #facc15, #22c55e)";
  if (score >= 41) return "linear-gradient(90deg, #fb923c, #facc15)";
  return "linear-gradient(90deg, #ef4444, #fb923c)";
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Strong Match";
  if (score >= 60) return "Potential Fit";
  return "Needs Review";
}

function getScoreTextColor(score: number): string {
  if (score >= 80) return "text-status-live";
  if (score >= 60) return "text-status-warning";
  return "text-status-alert";
}

export default function TopCandidatesModal({ jobId, jobTitle, onClose }: TopCandidatesModalProps) {
  const { token } = useAuth();
  const { setActiveView, setPrefillResume, setNavigateToView } = useSidebar();
  const [candidates, setCandidates] = useState<MatchedCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [candidateMap, setCandidateMap] = useState<Map<string, CandidateInfo>>(new Map());
  const [candidateCount, setCandidateCount] = useState(0);

  useEffect(() => {
    if (!token) return;
    fetch("/candidates", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((list: CandidateInfo[]) => {
        setCandidateCount(list.length);
        const map = new Map<string, CandidateInfo>();
        list.forEach((c) => map.set(c.id, c));
        setCandidateMap(map);
      })
      .catch(() => {});
  }, [token]);

  const handleFindCandidates = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/jobs/${jobId}/top-candidates?limit=10`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to find candidates");
      const data = await res.json();
      const raw: MatchedCandidate[] = data.candidates || [];
      const enriched = raw.map((m) => {
        const info = candidateMap.get(m.candidate_id);
        return {
          ...m,
          first_name: info?.first_name || "Anonymous",
          last_name: info?.last_name || "Candidate",
          email: info?.email,
          skills: info?.skills || [],
        };
      });
      setCandidates(enriched);
      setSearched(true);
    } catch (e: any) {
      setError(e.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleSchedule = async (c: MatchedCandidate) => {
    try {
      const res = await fetch(`/candidate/${c.candidate_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const candidate = await res.json();
      const resumeText = candidate.raw_resume_text || [
        candidate.first_name, candidate.last_name, candidate.email,
        ...(candidate.skills || []),
        ...(candidate.experience || []).map((e: any) => `${e.title} at ${e.company}: ${e.description}`),
        ...(candidate.education || []).map((e: any) => `${e.degree} in ${e.field} from ${e.school}`),
        candidate.summary,
      ].filter(Boolean).join("\n");
      setPrefillResume(resumeText);
      onClose();
      setActiveView("interviews");
      setNavigateToView("setup");
    } catch {
      return;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]" onClick={onClose}>
      <div
        className="bg-surface-default border border-border-default rounded-radius-card w-[720px] max-w-[95vw] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-8 pt-8 pb-6 border-b border-border-default flex items-start justify-between">
          <div>
            <h2 className="text-h3 font-semibold text-text-primary">Top Candidates</h2>
            <p className="text-caption text-text-muted mt-1">AI-matched for: {jobTitle}</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <i className="ti ti-x text-lg" />
          </button>
        </div>

        <div className="px-8 py-6">
          {error && (
            <div className="mb-4 px-4 py-3 rounded-radius-card bg-status-alert/10 border border-status-alert/30 text-caption text-status-alert">
              {error}
            </div>
          )}

          {!searched && !loading && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-4xl mb-4">🤖</div>
              <p className="text-body text-text-muted mb-6 max-w-md">
                AI will analyze {candidateCount > 0 ? `${candidateCount} candidates` : "all candidates"} in your database against this job posting and return the top 10 matches ranked by skills, experience, past performance, and fit.
              </p>
              <button
                onClick={handleFindCandidates}
                className="px-6 py-2.5 rounded-radius-card bg-accent-gold text-bg-primary text-body font-semibold hover:brightness-110 transition-all"
              >
                🔍 Find Top 10 Candidates
              </button>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="text-5xl mb-4 animate-pulse">🤖</div>
              <p className="text-body text-text-muted">
                Analyzing {candidateCount || "all"} candidates against {jobTitle}...
              </p>
            </div>
          )}

          {searched && !loading && candidates.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-4xl mb-4">📭</div>
              <p className="text-body text-text-muted">No candidates found in your database. Upload some resumes first.</p>
            </div>
          )}

          {candidates.length > 0 && (
            <div className="space-y-4">
              <p className="text-caption text-text-muted">
                Ranked by AI match score — {candidates.length} candidate{candidates.length !== 1 ? "s" : ""} found
              </p>
              {candidates.map((c) => {
                const initials = getInitials(c.first_name || "", c.last_name || "");
                const name = c.first_name && c.first_name !== "Anonymous"
                  ? `${c.first_name} ${c.last_name}`
                  : "Anonymous Candidate";
                return (
                  <div
                    key={c.candidate_id}
                    className="bg-surface-raised border border-border-default rounded-radius-card p-5 hover:border-accent-gold/50 hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent-gold/20 flex items-center justify-center text-accent-gold font-bold text-sm">
                          {initials}
                        </div>
                        <div>
                          <h3 className="font-semibold text-text-primary text-body">{name}</h3>
                          <p className="text-[11px] text-text-muted">#{c.rank} match</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-2xl font-bold ${getScoreTextColor(c.score)}`}>{c.score}%</p>
                        <p className="text-[10px] text-text-muted">{getScoreLabel(c.score)}</p>
                      </div>
                    </div>

                    <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden mb-4">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${c.score}%`, background: getGradient(c.score) }}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-[11px] text-status-live mb-2 flex items-center gap-1">
                          <span>✅</span> Strengths
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {c.strengths.length > 0
                            ? c.strengths.slice(0, 3).map((s, i) => (
                                <span key={i} className="text-[11px] px-2 py-0.5 rounded-radius-pill bg-green-900/30 text-green-300 border border-green-800">
                                  {s}
                                </span>
                              ))
                            : <span className="text-[10px] text-text-muted">None identified</span>}
                          {c.strengths.length > 3 && (
                            <span className="text-[10px] text-text-muted">+{c.strengths.length - 3} more</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] text-status-warning mb-2 flex items-center gap-1">
                          <span>⚠️</span> Gaps
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {c.gaps.length > 0
                            ? c.gaps.slice(0, 3).map((g, i) => (
                                <span key={i} className="text-[11px] px-2 py-0.5 rounded-radius-pill bg-amber-900/30 text-amber-300 border border-amber-800">
                                  {g}
                                </span>
                              ))
                            : <span className="text-[10px] text-text-muted">No significant gaps</span>}
                          {c.gaps.length > 3 && (
                            <span className="text-[10px] text-text-muted">+{c.gaps.length - 3} more</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="border-l-2 border-accent-gold/50 pl-3 mb-4">
                      <p className="text-[13px] text-text-muted leading-relaxed italic">"{c.reasoning}"</p>
                    </div>

                    <button
                      onClick={() => handleSchedule(c)}
                      className="w-full py-2 rounded-radius-card border border-accent-gold text-accent-gold text-[13px] font-medium hover:bg-accent-gold hover:text-bg-primary transition-colors"
                    >
                      Schedule Interview
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {searched && !loading && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={handleFindCandidates}
                className="px-4 py-2 text-caption text-text-muted border border-border-default rounded-radius-input hover:text-text-primary transition-colors"
              >
                Re-run Match
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
