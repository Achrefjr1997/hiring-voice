import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthProvider";
import JobDetailsModal from "./JobDetailsModal";
import EditJobModal from "./EditJobModal";

type FilterTab = "all" | "active" | "draft" | "closed";

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

const TABS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "draft", label: "Draft" },
  { id: "closed", label: "Closed" },
];

const STATUS_CONFIG: Record<string, { badgeClass: string; dot: string }> = {
  active: { badgeClass: "text-status-live bg-status-live/[0.12]", dot: "🟢" },
  draft: { badgeClass: "text-status-warning bg-status-warning/[0.12]", dot: "🟡" },
  closed: { badgeClass: "text-text-muted bg-white/[0.06]", dot: "🔴" },
};

function formatDeadline(d: string | null): string {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function ActiveRecruitmentsView() {
  const { token } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [viewingJob, setViewingJob] = useState<Job | null>(null);
  const [editingJob, setEditingJob] = useState<Job | null>(null);

  const fetchJobs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("status", filter);
      const res = await fetch(`/jobs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load jobs");
      const data = await res.json();
      setJobs(data);
    } catch (e: any) {
      setError(e.message || "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleStatusChange = async (job: Job, newStatus: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/jobs/${job.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      await fetchJobs();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDelete = async (job: Job) => {
    if (!token) return;
    try {
      const res = await fetch(`/jobs/${job.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to delete job");
      await fetchJobs();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <>
      <div className="flex gap-0 px-8 border-b border-border-default">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={
              "px-5 py-3 text-caption border-b-2 transition-colors " +
              (filter === tab.id
                ? "text-accent-gold border-b-accent-gold font-medium"
                : "text-text-muted border-b-transparent hover:text-text-primary")
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mx-8 mt-4 px-4 py-3 rounded-radius-card bg-status-alert/10 border border-status-alert/30 text-caption text-status-alert">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-8">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-caption text-text-muted">Loading jobs…</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-caption text-text-muted">
              {filter !== "all" ? "No jobs match this filter." : "No jobs yet. Create a job posting to get started."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {jobs.map((job) => {
              const cfg = STATUS_CONFIG[job.status] || STATUS_CONFIG.draft;
              return (
                <div
                  key={job.id}
                  className="bg-surface-default border border-border-default rounded-radius-card p-5 hover:border-border-light hover:-translate-y-0.5 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-body font-semibold text-text-primary">{job.title}</h3>
                    <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-radius-pill ${cfg.badgeClass}`}>
                      {cfg.dot} {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                    </span>
                  </div>
                  <div className="flex gap-4 flex-wrap text-[12px] text-text-muted mb-4">
                    {job.department && <span>🏢 {job.department}</span>}
                    {job.location && <span>📍 {job.location}</span>}
                    <span>👥 {job.applicant_count} Applicant{job.applicant_count !== 1 ? "s" : ""}</span>
                    <span>📅 Deadline: {formatDeadline(job.deadline)}</span>
                  </div>
                  <div className="flex gap-2 pt-3 border-t border-border-default">
                    <button onClick={() => setViewingJob(job)} className="px-3.5 py-1.5 text-[11px] text-text-muted border border-border-default rounded-radius-input hover:border-accent-gold hover:text-accent-gold transition-colors">
                      View Details
                    </button>
                    <button onClick={() => setEditingJob(job)} className="px-3.5 py-1.5 text-[11px] text-text-muted border border-border-default rounded-radius-input hover:border-accent-gold hover:text-accent-gold transition-colors">
                      Edit
                    </button>
                    {job.status === "draft" && (
                      <button
                        onClick={() => handleStatusChange(job, "active")}
                        className="px-3.5 py-1.5 text-[11px] text-status-live border border-status-live/40 rounded-radius-input hover:bg-status-live/10 transition-colors ml-auto"
                      >
                        Publish
                      </button>
                    )}
                    {job.status === "active" && (
                      <button
                        onClick={() => handleStatusChange(job, "closed")}
                        className="px-3.5 py-1.5 text-[11px] text-text-muted border border-border-default rounded-radius-input hover:text-status-alert transition-colors ml-auto"
                      >
                        Close
                      </button>
                    )}
                    {(job.status === "draft" || job.status === "closed") && (
                      <button
                        onClick={() => handleDelete(job)}
                        className="px-3.5 py-1.5 text-[11px] text-status-alert border border-status-alert/40 rounded-radius-input hover:bg-status-alert/10 transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {viewingJob && (
        <JobDetailsModal job={viewingJob} onClose={() => setViewingJob(null)} />
      )}
      {editingJob && (
        <EditJobModal
          job={editingJob}
          onClose={() => setEditingJob(null)}
          onSaved={() => { setEditingJob(null); fetchJobs(); }}
        />
      )}
    </>
  );
}
