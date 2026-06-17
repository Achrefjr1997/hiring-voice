import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { useSidebar } from "./SidebarContext";

interface MatchedCandidate {
  candidate_id: string;
  score: number;
  rank: number;
  strengths: string[];
  gaps: string[];
  reasoning: string;
}

interface TopCandidatesModalProps {
  jobId: string;
  jobTitle: string;
  onClose: () => void;
}

export default function TopCandidatesModal({ jobId, jobTitle, onClose }: TopCandidatesModalProps) {
  const { token } = useAuth();
  const { setActiveView, setPrefillResume, setNavigateToView } = useSidebar();
  const [candidates, setCandidates] = useState<MatchedCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

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
      setCandidates(data.candidates || []);
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

  const scoreColor = (s: number) => {
    if (s >= 80) return "text-status-live";
    if (s >= 60) return "text-status-warning";
    return "text-status-alert";
  };

  const scoreBarColor = (s: number) => {
    if (s >= 80) return "bg-status-live";
    if (s >= 60) return "bg-status-warning";
    return "bg-status-alert";
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
                AI will analyze all candidates in your database against this job posting and return the top 10 matches ranked by skills, experience, past performance, and fit.
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
              <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-body text-text-muted">Analyzing candidates with AI…</p>
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
              {candidates.map((c) => (
                <div key={c.candidate_id} className="bg-surface-raised border border-border-default rounded-radius-card p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-accent-gold/15 text-accent-gold text-caption font-bold flex items-center justify-center">
                        #{c.rank}
                      </span>
                      <div>
                        <p className="text-body font-semibold text-text-primary">
                          Candidate {c.candidate_id.slice(0, 8)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-h3 font-bold ${scoreColor(c.score)}`}>{c.score}%</p>
                      <p className="text-[10px] text-text-muted">match</p>
                    </div>
                  </div>

                  <div className="w-full h-1.5 bg-white/[0.06] rounded-full mb-4">
                    <div className={`h-full rounded-full ${scoreBarColor(c.score)} transition-all`} style={{ width: `${c.score}%` }} />
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <p className="text-[11px] text-text-muted mb-1.5">Strengths</p>
                      <div className="flex flex-wrap gap-1.5">
                        {c.strengths.length > 0 ? c.strengths.map((s, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-radius-pill bg-status-live/15 text-status-live border border-status-live/20">
                            + {s}
                          </span>
                        )) : <span className="text-[10px] text-text-muted">None identified</span>}
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] text-text-muted mb-1.5">Gaps</p>
                      <div className="flex flex-wrap gap-1.5">
                        {c.gaps.length > 0 ? c.gaps.map((g, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-radius-pill bg-status-alert/15 text-status-alert border border-status-alert/20">
                            — {g}
                          </span>
                        )) : <span className="text-[10px] text-text-muted">No significant gaps</span>}
                      </div>
                    </div>
                  </div>

                  <p className="text-[12px] text-text-muted leading-relaxed mb-3">{c.reasoning}</p>

                  <button
                    onClick={() => handleSchedule(c)}
                    className="text-[11px] text-accent-gold hover:underline"
                  >
                    Schedule Interview →
                  </button>
                </div>
              ))}
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
