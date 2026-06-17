import { useState, useEffect, useRef } from "react";
import { useAuth } from "./AuthProvider";
import { useSidebar } from "./SidebarContext";

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  skills: string[];
  experience: Array<{ company: string; title: string; start_date: string; end_date: string | null; description: string }>;
  education: Array<{ school: string; degree: string; field: string; graduation_year: number }>;
  summary: string;
  raw_resume_text: string;
  original_filename: string;
  created_at: string;
}

function CandidateProfileModal({ candidate, onClose }: { candidate: Candidate; onClose: () => void }) {
  const { setActiveView, setPrefillResume, setNavigateToView } = useSidebar();

  const handleSchedule = () => {
    const resumeText = candidate.raw_resume_text || [
      candidate.first_name,
      candidate.last_name,
      candidate.email,
      ...candidate.skills,
      ...candidate.experience.map((e) => `${e.title} at ${e.company}: ${e.description}`),
      ...candidate.education.map((e) => `${e.degree} in ${e.field} from ${e.school}`),
      candidate.summary,
    ].filter(Boolean).join("\n");
    setPrefillResume(resumeText);
    onClose();
    setActiveView("interviews");
    setNavigateToView("setup");
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-surface-default border border-border-default rounded-radius-card w-[720px] max-w-[95vw] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-border-default">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-h3 font-semibold text-text-primary">
                {candidate.first_name} {candidate.last_name}
              </h2>
              <div className="flex items-center gap-3 mt-2 text-caption text-text-muted">
                {candidate.email && <span>{candidate.email}</span>}
                {candidate.phone && <span>{candidate.phone}</span>}
              </div>
              {(candidate.linkedin_url || candidate.github_url) && (
                <div className="flex gap-4 mt-1.5 text-[11px]">
                  {candidate.linkedin_url && (
                    <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer"
                      className="text-accent-gold hover:underline">LinkedIn</a>
                  )}
                  {candidate.github_url && (
                    <a href={candidate.github_url} target="_blank" rel="noopener noreferrer"
                      className="text-accent-gold hover:underline">GitHub</a>
                  )}
                </div>
              )}
              {candidate.original_filename && (
                <p className="text-[11px] text-text-muted mt-2">Source: {candidate.original_filename}</p>
              )}
            </div>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
              <i className="ti ti-x text-lg" />
            </button>
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Summary */}
          {candidate.summary && (
            <section>
              <h3 className="text-caption font-medium text-text-secondary uppercase tracking-wide mb-2">Summary</h3>
              <p className="text-[13px] text-text-primary leading-relaxed">{candidate.summary}</p>
            </section>
          )}

          {/* Skills */}
          {candidate.skills && candidate.skills.length > 0 && (
            <section>
              <h3 className="text-caption font-medium text-text-secondary uppercase tracking-wide mb-2">
                Skills ({candidate.skills.length})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {candidate.skills.map((s) => (
                  <span key={s} className="bg-white/[0.06] text-text-muted px-2.5 py-1 rounded-radius-pill text-[11px]">
                    {s}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Experience */}
          {candidate.experience && candidate.experience.length > 0 && (
            <section>
              <h3 className="text-caption font-medium text-text-secondary uppercase tracking-wide mb-2">Experience</h3>
              <div className="space-y-3">
                {candidate.experience.map((exp, i) => (
                  <div key={i} className="border-l-2 border-accent-gold/40 pl-4">
                    <p className="text-[13px] font-medium text-text-primary">{exp.title}</p>
                    <p className="text-[12px] text-text-muted">{exp.company}</p>
                    {exp.start_date && (
                      <p className="text-[11px] text-text-muted mt-0.5">
                        {exp.start_date} — {exp.end_date || "Present"}
                      </p>
                    )}
                    {exp.description && (
                      <p className="text-[12px] text-text-secondary mt-1 leading-relaxed">{exp.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Education */}
          {candidate.education && candidate.education.length > 0 && (
            <section>
              <h3 className="text-caption font-medium text-text-secondary uppercase tracking-wide mb-2">Education</h3>
              <div className="space-y-2">
                {candidate.education.map((edu, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-accent-gold mt-1.5 shrink-0" />
                    <div>
                      <p className="text-[13px] font-medium text-text-primary">
                        {edu.degree}{edu.field ? ` in ${edu.field}` : ""}
                      </p>
                      <p className="text-[12px] text-text-muted">{edu.school}</p>
                      {edu.graduation_year && (
                        <p className="text-[11px] text-text-muted">Class of {edu.graduation_year}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-border-default flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-radius-input text-caption text-text-muted border border-border-default hover:text-text-primary transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleSchedule}
            className="px-5 py-2 rounded-radius-input text-caption font-medium bg-accent-gold text-bg-primary hover:brightness-110 transition-all"
          >
            Schedule Interview
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CandidatesCvsView() {
  const { token } = useAuth();
  const { setActiveView, setPrefillResume, setNavigateToView } = useSidebar();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCandidates = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/candidates", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load candidates");
      const data = await res.json();
      setCandidates(data);
    } catch (e: any) {
      setError(e.message || "Failed to load candidates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, [token]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/candidate/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        await fetchCandidates();
      }
    } catch (e: any) {
      setError(e.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleScheduleInterview = (candidate: Candidate) => {
    const resumeText = candidate.raw_resume_text || [
      candidate.first_name,
      candidate.last_name,
      candidate.email,
      ...candidate.skills,
      ...candidate.experience.map((e) => `${e.title} at ${e.company}: ${e.description}`),
      ...candidate.education.map((e) => `${e.degree} in ${e.field} from ${e.school}`),
      candidate.summary,
    ].filter(Boolean).join("\n");
    setPrefillResume(resumeText);
    setActiveView("interviews");
    setNavigateToView("setup");
  };

  const filtered = candidates.filter(
    (c) =>
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      (c.email || "").toLowerCase().includes(search.toLowerCase()) ||
      c.skills.some((s) => s.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="px-8 py-4 flex items-center gap-3">
        <input
          type="text"
          placeholder="Search by name, email, skills..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-surface-default border border-border-default rounded-radius-input px-4 py-2.5 text-caption text-text-primary placeholder:text-text-muted outline-none focus:border-accent-gold transition-colors"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="bg-accent-gold text-bg-primary text-caption font-semibold px-5 py-2.5 rounded-radius-input hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          {uploading ? "Uploading…" : "+ Upload CV"}
        </button>
      </div>

      {error && (
        <div className="mx-8 mb-4 px-4 py-3 rounded-radius-card bg-status-alert/10 border border-status-alert/30 text-caption text-status-alert">
          {error}
        </div>
      )}

      <div className="px-8 pb-8 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-caption text-text-muted">Loading candidates…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-caption text-text-muted">
              {search ? "No candidates match your search." : "No candidates yet. Upload a CV to get started."}
            </p>
          </div>
        ) : (
          <div className="bg-surface-default border border-border-default rounded-radius-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-default">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Name</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Email</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Skills</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Source</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-border-default last:border-b-0 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-caption text-text-primary font-medium">
                      {c.first_name} {c.last_name}
                    </td>
                    <td className="px-4 py-3 text-caption text-text-secondary">{c.email || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {(c.skills || []).slice(0, 4).map((s) => (
                          <span key={s} className="bg-white/[0.06] text-text-muted px-2 py-0.5 rounded-radius-pill text-[11px]">
                            {s}
                          </span>
                        ))}
                        {c.skills && c.skills.length > 4 && (
                          <span className="text-[11px] text-text-muted">+{c.skills.length - 4}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-caption text-text-muted text-[11px] max-w-[120px] truncate">
                      {c.original_filename || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedCandidate(c)}
                          className="text-[11px] text-text-muted border border-border-default rounded-radius-input px-3 py-1 hover:text-text-primary transition-colors"
                        >
                          Profile
                        </button>
                        <button
                          onClick={() => handleScheduleInterview(c)}
                          className="text-[11px] text-accent-gold border border-accent-gold/40 rounded-radius-input px-3 py-1 hover:bg-accent-gold/10 transition-colors"
                        >
                          Schedule Interview
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedCandidate && (
        <CandidateProfileModal
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
        />
      )}
    </>
  );
}
