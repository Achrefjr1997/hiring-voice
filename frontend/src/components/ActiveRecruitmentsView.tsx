import { useState } from "react";

type FilterTab = "all" | "active" | "draft" | "closed";

interface Job {
  title: string;
  department: string;
  location: string;
  applicants: number;
  deadline: string;
  status: "active" | "draft" | "closed";
}

const MOCK_JOBS: Job[] = [
  { title: "Senior ML Engineer", department: "Engineering", location: "Casablanca", applicants: 12, deadline: "30 Jul", status: "active" },
  { title: "NLP Research Intern", department: "Research", location: "Remote", applicants: 8, deadline: "15 Jul", status: "active" },
  { title: "Full-Stack Developer", department: "Product", location: "Rabat", applicants: 0, deadline: "—", status: "draft" },
  { title: "Data Engineer", department: "Data", location: "Tunis", applicants: 5, deadline: "20 Aug", status: "active" },
  { title: "AI Product Manager", department: "Product", location: "Casablanca", applicants: 0, deadline: "—", status: "draft" },
  { title: "DevOps Engineer", department: "Infrastructure", location: "Remote", applicants: 3, deadline: "10 Aug", status: "active" },
];

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

export default function ActiveRecruitmentsView() {
  const [filter, setFilter] = useState<FilterTab>("all");

  const filtered = filter === "all" ? MOCK_JOBS : MOCK_JOBS.filter((j) => j.status === filter);

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

      <div className="flex-1 overflow-y-auto p-8">
        <div className="grid grid-cols-2 gap-4">
          {filtered.map((job) => {
            const cfg = STATUS_CONFIG[job.status];
            return (
              <div
                key={job.title}
                className="bg-surface-default border border-border-default rounded-radius-card p-5 hover:border-border-light hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-body font-semibold text-text-primary">{job.title}</h3>
                  <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-radius-pill ${cfg.badgeClass}`}>
                    {cfg.dot} {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                  </span>
                </div>
                <div className="flex gap-4 flex-wrap text-[12px] text-text-muted mb-4">
                  <span>🏢 {job.department}</span>
                  <span>📍 {job.location}</span>
                  <span>👥 {job.applicants} Applicant{job.applicants !== 1 ? "s" : ""}</span>
                  <span>📅 Deadline: {job.deadline}</span>
                </div>
                <div className="flex gap-2 pt-3 border-t border-border-default">
                  <button className="px-3.5 py-1.5 text-[11px] text-text-muted border border-border-default rounded-radius-input hover:border-accent-gold hover:text-accent-gold transition-colors">
                    View Details
                  </button>
                  <button className="px-3.5 py-1.5 text-[11px] text-text-muted border border-border-default rounded-radius-input hover:border-accent-gold hover:text-accent-gold transition-colors">
                    Edit
                  </button>
                  <button className="px-3.5 py-1.5 text-[11px] text-text-muted border border-border-default rounded-radius-input hover:border-status-alert hover:text-status-alert transition-colors ml-auto">
                    Close
                  </button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-2 py-16 text-center text-caption text-text-muted">
              No jobs match this filter.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
