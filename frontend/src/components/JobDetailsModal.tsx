import { useState } from "react";
import { useAuth } from "./AuthProvider";
import TopCandidatesModal from "./TopCandidatesModal";

interface Job {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  employment_type: string;
  description: string;
  requirements: string;
  required_skills: string[];
  status: string;
  deadline: string | null;
  applicant_count: number;
  created_at: string | null;
  updated_at: string | null;
}

interface JobDetailsModalProps {
  job: Job;
  onClose: () => void;
}

const STATUS_CONFIG: Record<string, { badgeClass: string; dot: string }> = {
  active: { badgeClass: "text-status-live bg-status-live/[0.12]", dot: "🟢" },
  draft: { badgeClass: "text-status-warning bg-status-warning/[0.12]", dot: "🟡" },
  closed: { badgeClass: "text-text-muted bg-white/[0.06]", dot: "🔴" },
};

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function JobDetailsModal({ job, onClose }: JobDetailsModalProps) {
  const cfg = STATUS_CONFIG[job.status] || STATUS_CONFIG.draft;
  const [showTopCandidates, setShowTopCandidates] = useState(false);

  return (
    <>
      {showTopCandidates && (
        <TopCandidatesModal jobId={job.id} jobTitle={job.title} onClose={() => setShowTopCandidates(false)} />
      )}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-surface-default border border-border-default rounded-radius-card w-[640px] max-w-[95vw] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-border-default">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-h3 font-semibold text-text-primary">{job.title}</h2>
              <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-radius-pill ${cfg.badgeClass}`}>
                {cfg.dot} {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
              </span>
            </div>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
              <i className="ti ti-x text-lg" />
            </button>
          </div>
          <div className="flex gap-4 flex-wrap text-[12px] text-text-muted mt-3">
            {job.department && <span>🏢 {job.department}</span>}
            {job.location && <span>📍 {job.location}</span>}
            <span>💼 {job.employment_type}</span>
            <span>👥 {job.applicant_count} Applicant{job.applicant_count !== 1 ? "s" : ""}</span>
            {job.deadline && <span>📅 Deadline: {formatDate(job.deadline)}</span>}
          </div>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Description */}
          <div>
            <h3 className="text-caption font-semibold text-text-secondary uppercase tracking-wider mb-2">Description</h3>
            <p className="text-body text-text-primary leading-relaxed whitespace-pre-wrap">
              {job.description || "No description provided."}
            </p>
          </div>

          {/* Requirements */}
          <div>
            <h3 className="text-caption font-semibold text-text-secondary uppercase tracking-wider mb-2">Requirements</h3>
            <div className="text-body text-text-primary leading-relaxed whitespace-pre-wrap">
              {job.requirements ? (
                job.requirements.startsWith("- ") || job.requirements.startsWith("* ")
                  ? <ul className="list-disc pl-5 space-y-1">{job.requirements.split("\n").filter(Boolean).map((r, i) => <li key={i}>{r.replace(/^[-*]\s*/, "")}</li>)}</ul>
                  : <p>{job.requirements}</p>
              ) : (
                "No requirements specified."
              )}
            </div>
          </div>

          {/* Required Skills */}
          {job.required_skills.length > 0 && (
            <div>
              <h3 className="text-caption font-semibold text-text-secondary uppercase tracking-wider mb-2">Required Skills</h3>
              <div className="flex flex-wrap gap-2">
                {job.required_skills.map((skill, i) => (
                  <span key={i} className="text-[11px] px-2.5 py-1 rounded-radius-pill bg-accent-gold/15 text-accent-gold border border-accent-gold/20">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border-default text-[11px] text-text-muted">
            <div>Created: {formatDate(job.created_at)}</div>
            <div>Updated: {formatDate(job.updated_at)}</div>
          </div>
        </div>

        <div className="px-8 py-5 border-t border-border-default flex justify-between">
          <button
            onClick={() => setShowTopCandidates(true)}
            className="px-5 py-2 text-caption font-semibold bg-accent-gold text-bg-primary rounded-radius-input hover:brightness-110 transition-all"
          >
            🔍 Find Top 10 Candidates
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 text-caption text-text-muted border border-border-default rounded-radius-input hover:text-text-primary transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </>);
}
