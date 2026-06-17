import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthProvider";
import JobDetailsModal from "./JobDetailsModal";
import EditJobModal from "./EditJobModal";
import { MapPin, Users, Building2, Calendar, MoreVertical, Eye, Edit2, Send, XCircle, Trash2 } from "lucide-react";

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

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
  active: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  draft: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  closed: { bg: "bg-gray-100", text: "text-gray-600", border: "border-gray-200" },
};

function formatDeadline(d: string | null): string | null {
  if (!d) return null;
  const date = new Date(d);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function ActiveRecruitmentsView() {
  const { token } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [viewingJob, setViewingJob] = useState<Job | null>(null);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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
      <div className="flex gap-1 px-8 border-b border-border-default bg-surface-raised">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={
              "px-6 py-3 text-sm font-medium transition-all duration-200 border-b-2 " +
              (filter === tab.id
                ? "text-accent-gold border-b-accent-gold bg-surface-default"
                : "text-gray-400 border-b-transparent hover:text-text-primary hover:bg-surface-hover")
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
          <div className="grid grid-cols-2 gap-5">
            {jobs.map((job) => {
              const cfg = STATUS_CONFIG[job.status] || STATUS_CONFIG.draft;
              const deadline = formatDeadline(job.deadline);
              const isMenuOpen = openMenuId === job.id;

              return (
                <div
                  key={job.id}
                  className="bg-surface-default border border-border-default rounded-lg p-6 hover:border-border-light hover:shadow-md transition-all duration-200"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 pr-4">
                      <h3 className="text-lg font-semibold text-text-primary mb-1 leading-tight">
                        {job.title}
                      </h3>
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                        {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                      </span>
                    </div>

                    {/* Kebab Menu */}
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenuId(isMenuOpen ? null : job.id)}
                        className="p-2 rounded-lg hover:bg-surface-hover text-gray-400 hover:text-text-primary transition-colors"
                      >
                        <MoreVertical size={18} />
                      </button>

                      {isMenuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setOpenMenuId(null)}
                          />
                          <div className="absolute right-0 top-10 w-48 bg-surface-default border border-border-default rounded-lg shadow-xl z-20 py-1">
                            <button
                              onClick={() => { setEditingJob(job); setOpenMenuId(null); }}
                              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-text-primary hover:bg-surface-hover transition-colors"
                            >
                              <Edit2 size={16} className="text-gray-400" />
                              Edit Job
                            </button>
                            {job.status === "draft" && (
                              <button
                                onClick={() => { handleStatusChange(job, "active"); setOpenMenuId(null); }}
                                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-green-600 hover:bg-green-50 transition-colors"
                              >
                                <Send size={16} />
                                Publish
                              </button>
                            )}
                            {job.status === "active" && (
                              <button
                                onClick={() => { handleStatusChange(job, "closed"); setOpenMenuId(null); }}
                                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 transition-colors"
                              >
                                <XCircle size={16} />
                                Close Job
                              </button>
                            )}
                            {(job.status === "draft" || job.status === "closed") && (
                              <button
                                onClick={() => { handleDelete(job); setOpenMenuId(null); }}
                                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors border-t border-border-default"
                              >
                                <Trash2 size={16} />
                                Delete
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-400 mb-5">
                    {job.department && (
                      <div className="flex items-center gap-1.5">
                        <Building2 size={16} className="text-gray-400" />
                        <span>{job.department}</span>
                      </div>
                    )}
                    {job.location && (
                      <div className="flex items-center gap-1.5">
                        <MapPin size={16} className="text-gray-400" />
                        <span>{job.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Users size={16} className="text-gray-400" />
                      <span>{job.applicant_count} Applicant{job.applicant_count !== 1 ? "s" : ""}</span>
                    </div>
                    {deadline && (
                      <div className="flex items-center gap-1.5">
                        <Calendar size={16} className="text-gray-400" />
                        <span>{deadline}</span>
                      </div>
                    )}
                  </div>

                  {/* Primary Action */}
                  <button
                    onClick={() => setViewingJob(job)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent-gold text-bg-primary rounded-lg font-medium text-sm hover:brightness-110 transition-all"
                  >
                    <Eye size={16} />
                    View Details
                  </button>
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
