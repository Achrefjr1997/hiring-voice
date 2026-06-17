import { useState } from "react";
import { useAuth } from "./AuthProvider";

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

interface EditJobModalProps {
  job: Job;
  onClose: () => void;
  onSaved: () => void;
}

const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Internship", "Temporary"];

function formatDateForInput(d: string | null): string {
  if (!d) return "";
  try { return new Date(d).toISOString().split("T")[0]; } catch { return ""; }
}

export default function EditJobModal({ job, onClose, onSaved }: EditJobModalProps) {
  const { token } = useAuth();
  const [title, setTitle] = useState(job.title);
  const [department, setDepartment] = useState(job.department || "");
  const [location, setLocation] = useState(job.location || "");
  const [employmentType, setEmploymentType] = useState(job.employment_type || "Full-time");
  const [skills, setSkills] = useState(job.required_skills.join(", "));
  const [deadline, setDeadline] = useState(formatDateForInput(job.deadline));
  const [description, setDescription] = useState(job.description || "");
  const [requirements, setRequirements] = useState(job.requirements || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Job title is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {};
      if (title.trim() !== job.title) body.title = title.trim();
      if (department.trim() !== (job.department || "")) body.department = department.trim() || null;
      if (location.trim() !== (job.location || "")) body.location = location.trim() || null;
      if (employmentType !== job.employment_type) body.employment_type = employmentType;
      if (description.trim() !== (job.description || "")) body.description = description.trim();
      if (requirements.trim() !== (job.requirements || "")) body.requirements = requirements.trim();
      const newSkills = skills.split(",").map((s) => s.trim()).filter(Boolean);
      if (JSON.stringify(newSkills) !== JSON.stringify(job.required_skills)) body.required_skills = newSkills.length > 0 ? newSkills : [];
      const newDeadline = deadline ? new Date(deadline).toISOString() : null;
      if (newDeadline !== job.deadline) body.deadline = newDeadline;

      const res = await fetch(`/jobs/${job.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to update job");
      onSaved();
    } catch (e: any) {
      setError(e.message || "Update failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-surface-default border border-border-default rounded-radius-card w-[640px] max-w-[95vw] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-8 pt-8 pb-6 border-b border-border-default flex items-start justify-between">
          <h2 className="text-h3 font-semibold text-text-primary">Edit Job Posting</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <i className="ti ti-x text-lg" />
          </button>
        </div>

        <div className="px-8 py-6 space-y-5">
          {error && (
            <div className="px-4 py-3 rounded-radius-card bg-status-alert/10 border border-status-alert/30 text-caption text-status-alert">
              {error}
            </div>
          )}

          <div>
            <label className="block text-caption text-text-muted mb-1.5">Job Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-surface-raised border border-border-default rounded-radius-input px-4 py-2.5 text-body text-text-primary placeholder:text-text-muted/50 outline-none focus:border-accent-gold transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-caption text-text-muted mb-1.5">Department</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full bg-surface-raised border border-border-default rounded-radius-input px-4 py-2.5 text-body text-text-primary placeholder:text-text-muted/50 outline-none focus:border-accent-gold transition-colors"
              />
            </div>
            <div>
              <label className="block text-caption text-text-muted mb-1.5">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-surface-raised border border-border-default rounded-radius-input px-4 py-2.5 text-body text-text-primary placeholder:text-text-muted/50 outline-none focus:border-accent-gold transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-caption text-text-muted mb-1.5">Employment Type</label>
              <select
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
                className="w-full bg-surface-raised border border-border-default rounded-radius-input px-4 py-2.5 text-body text-text-primary outline-none focus:border-accent-gold transition-colors"
              >
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-caption text-text-muted mb-1.5">Deadline</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full bg-surface-raised border border-border-default rounded-radius-input px-4 py-2.5 text-body text-text-primary outline-none focus:border-accent-gold transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-caption text-text-muted mb-1.5">Required Skills (comma-separated)</label>
            <input
              type="text"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              className="w-full bg-surface-raised border border-border-default rounded-radius-input px-4 py-2.5 text-body text-text-primary placeholder:text-text-muted/50 outline-none focus:border-accent-gold transition-colors"
            />
          </div>

          <div>
            <label className="block text-caption text-text-muted mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="w-full bg-surface-raised border border-border-default rounded-radius-input px-4 py-2.5 text-body text-text-primary placeholder:text-text-muted/50 outline-none focus:border-accent-gold transition-colors resize-y"
            />
          </div>

          <div>
            <label className="block text-caption text-text-muted mb-1.5">Requirements</label>
            <textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              rows={4}
              className="w-full bg-surface-raised border border-border-default rounded-radius-input px-4 py-2.5 text-body text-text-primary placeholder:text-text-muted/50 outline-none focus:border-accent-gold transition-colors resize-y"
            />
          </div>
        </div>

        <div className="px-8 py-5 border-t border-border-default flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2 text-caption text-text-muted border border-border-default rounded-radius-input hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !title.trim()}
            className="px-5 py-2 text-caption font-semibold bg-accent-gold text-bg-primary rounded-radius-input hover:brightness-110 transition-all disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
