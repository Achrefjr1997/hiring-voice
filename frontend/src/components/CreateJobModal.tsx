import { useState } from "react";
import { useAuth } from "./AuthProvider";

interface CreateJobModalProps {
  onClose: () => void;
  onCreated: () => void;
}

const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Internship", "Temporary"];

export default function CreateJobModal({ onClose, onCreated }: CreateJobModalProps) {
  const { token } = useAuth();
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [employmentType, setEmploymentType] = useState("Full-time");
  const [skills, setSkills] = useState("");
  const [deadline, setDeadline] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateDescription = async () => {
    if (!title.trim()) {
      setError("Enter a job title before generating a description.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const skillsList = skills.split(",").map((s) => s.trim()).filter(Boolean);
      const res = await fetch("/jobs/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ job_title: title.trim(), skills: skillsList }),
      });
      if (!res.ok) throw new Error("Failed to generate description");
      const data = await res.json();
      setDescription(data.description || "");
      setRequirements(data.requirements || "");
    } catch (e: any) {
      setError(e.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Job title is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { title: title.trim() };
      if (department.trim()) body.department = department.trim();
      if (location.trim()) body.location = location.trim();
      body.employment_type = employmentType;
      if (description.trim()) body.description = description.trim();
      if (requirements.trim()) body.requirements = requirements.trim();
      if (skills.trim()) body.required_skills = skills.split(",").map((s) => s.trim()).filter(Boolean);
      if (deadline) body.deadline = new Date(deadline).toISOString();

      const res = await fetch("/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to create job");
      onCreated();
    } catch (e: any) {
      setError(e.message || "Creation failed");
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
          <h2 className="text-h3 font-semibold text-text-primary">Create Job Posting</h2>
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
              placeholder="e.g. Senior Frontend Engineer"
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
                placeholder="e.g. Engineering"
                className="w-full bg-surface-raised border border-border-default rounded-radius-input px-4 py-2.5 text-body text-text-primary placeholder:text-text-muted/50 outline-none focus:border-accent-gold transition-colors"
              />
            </div>
            <div>
              <label className="block text-caption text-text-muted mb-1.5">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Remote / NYC"
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
              placeholder="e.g. React, TypeScript, Tailwind CSS"
              className="w-full bg-surface-raised border border-border-default rounded-radius-input px-4 py-2.5 text-body text-text-primary placeholder:text-text-muted/50 outline-none focus:border-accent-gold transition-colors"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-caption text-text-muted">Description</label>
              <button
                onClick={handleGenerateDescription}
                disabled={generating}
                className="text-[11px] text-accent-gold hover:underline disabled:opacity-50 disabled:no-underline"
              >
                {generating ? "Generating…" : "✨ AI Generate"}
              </button>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Job description"
              className="w-full bg-surface-raised border border-border-default rounded-radius-input px-4 py-2.5 text-body text-text-primary placeholder:text-text-muted/50 outline-none focus:border-accent-gold transition-colors resize-y"
            />
          </div>

          <div>
            <label className="block text-caption text-text-muted mb-1.5">Requirements</label>
            <textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              rows={4}
              placeholder="Requirements / qualifications"
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
            {submitting ? "Creating…" : "Create Job"}
          </button>
        </div>
      </div>
    </div>
  );
}
