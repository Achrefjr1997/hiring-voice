import { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";

interface Job {
  id: string;
  title: string;
  department: string | null;
  description: string;
  requirements: string;
  status: string;
}

interface Candidate {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  raw_resume_text: string;
}

export default function SessionSetup({
  onSubmit,
  loading,
  prefillResume = "",
  prefillEmail = "",
}: {
  onSubmit: (jd: string, resume: string, rubric: string, duration: string, enforcementLevel: string, violationThreshold: number, gracePeriod: number, demoMode: boolean, candidateEmail?: string, jobId?: string) => Promise<void>;
  loading: boolean;
  prefillResume?: string;
  prefillEmail?: string;
}) {
  const { token } = useAuth();
  const [jd, setJd] = useState("");
  const [resume, setResume] = useState("");
  const [rubric, setRubric] = useState("");
  const [duration, setDuration] = useState("30");
  const [enforcementLevel, setEnforcementLevel] = useState("OBSERVATION_ONLY");
  const [violationThreshold, setViolationThreshold] = useState("3");
  const [gracePeriod, setGracePeriod] = useState("1");
  const [demoMode, setDemoMode] = useState(true);
  const [candidateEmail, setCandidateEmail] = useState("");
  const [jobId, setJobId] = useState("");

  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoadingJobs(true);
    setLoadingCandidates(true);
    fetch("/jobs", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setJobs)
      .catch(() => {})
      .finally(() => setLoadingJobs(false));
    fetch("/candidates", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setCandidates)
      .catch(() => {})
      .finally(() => setLoadingCandidates(false));
  }, [token]);

  useEffect(() => {
    if (prefillResume) {
      setResume(prefillResume);
    }
  }, [prefillResume]);

  useEffect(() => {
    if (prefillEmail) {
      setCandidateEmail(prefillEmail);
    }
  }, [prefillEmail]);

  const handleJobSelect = (id: string) => {
    setJobId(id);
    if (!id) return;
    const job = jobs.find((j) => j.id === id);
    if (job) {
      setJd([job.description, job.requirements].filter(Boolean).join("\n\n"));
    }
  };

  const handleCandidateSelect = (id: string) => {
    if (!id) return;
    const c = candidates.find((c) => c.id === id);
    if (c) {
      setResume(c.raw_resume_text || "");
      if (c.email) setCandidateEmail(c.email);
    }
  };

  const handleSubmit = async () => {
    if (!jd.trim() || !resume.trim()) return;
    await onSubmit(jd, resume, rubric, duration, enforcementLevel, parseInt(violationThreshold) || 3, parseInt(gracePeriod) || 1, demoMode, candidateEmail || undefined, jobId || undefined);
  };

  const inputClass = "w-full bg-bg-primary border border-border-default rounded-radius-card px-3 py-2 text-body text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-gold focus:border-accent-gold transition-colors";
  const labelClass = "text-caption text-text-secondary font-medium";
  const selectClass = inputClass;

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <h1 className="font-heading text-h2 text-text-primary">Session Setup</h1>

      <div className="bg-surface-default border border-border-default rounded-radius-card p-6 flex flex-col gap-5">
        {/* ── Job Description ── */}
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Job Description *</label>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] text-text-muted whitespace-nowrap">Load from posting:</span>
            <select
              value={jobId}
              onChange={(e) => handleJobSelect(e.target.value)}
              className="flex-1 bg-surface-raised border border-border-default rounded-radius-input px-3 py-1.5 text-[12px] text-text-primary outline-none focus:border-accent-gold transition-colors"
            >
              <option value="">— Manual entry —</option>
              {loadingJobs ? (
                <option disabled>Loading…</option>
              ) : jobs.length === 0 ? (
                <option disabled>No job postings found</option>
              ) : (
                jobs.filter((j) => j.status === "active" || j.status === "draft").map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}{j.department ? ` (${j.department})` : ""} — {j.status}
                  </option>
                ))
              )}
            </select>
          </div>
          <textarea
            value={jd}
            onChange={(e) => { setJd(e.target.value); if (!e.target.value) setJobId(""); }}
            rows={5}
            placeholder="Paste the full job description here…"
            className={inputClass + " resize-y"}
          />
        </div>

        {/* ── Candidate Resume ── */}
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Candidate Resume *</label>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] text-text-muted whitespace-nowrap">Load from candidate:</span>
            <select
              value=""
              onChange={(e) => handleCandidateSelect(e.target.value)}
              className="flex-1 bg-surface-raised border border-border-default rounded-radius-input px-3 py-1.5 text-[12px] text-text-primary outline-none focus:border-accent-gold transition-colors"
            >
              <option value="">— Manual entry —</option>
              {loadingCandidates ? (
                <option disabled>Loading…</option>
              ) : candidates.length === 0 ? (
                <option disabled>No candidates found</option>
              ) : (
                candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {[c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || c.id.slice(0, 8)}
                  </option>
                ))
              )}
            </select>
          </div>
          <textarea
            value={resume}
            onChange={(e) => setResume(e.target.value)}
            rows={5}
            placeholder="Paste the candidate's resume here…"
            className={inputClass + " resize-y"}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Company Rubric (optional)</label>
          <textarea
            value={rubric}
            onChange={(e) => setRubric(e.target.value)}
            rows={3}
            placeholder="Paste your company's hiring rubric or evaluation criteria…"
            className={inputClass + " resize-y"}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Candidate Email (optional)</label>
          <input
            type="email"
            value={candidateEmail}
            onChange={(e) => setCandidateEmail(e.target.value)}
            placeholder="candidate@company.com"
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Session Duration</label>
          <select value={duration} onChange={(e) => setDuration(e.target.value)} className={selectClass}>
            <option value="15">15 Minutes (Quick Screen)</option>
            <option value="30">30 Minutes (Standard)</option>
            <option value="45">45 Minutes (Deep Dive)</option>
            <option value="60">60 Minutes (Executive)</option>
          </select>
        </div>

        <fieldset className="border border-border-default rounded-radius-card p-4 space-y-3">
          <legend className="text-caption font-semibold text-text-secondary px-1">Anti-Cheat Enforcement</legend>

          <div className="flex flex-col gap-1.5">
            <label className="text-caption text-text-secondary">Enforcement Level</label>
            <select value={enforcementLevel} onChange={(e) => setEnforcementLevel(e.target.value)} className={selectClass}>
              <option value="OBSERVATION_ONLY">Observation Only (log violations)</option>
              <option value="WARNING_MODE">Warning Mode (show warnings)</option>
              <option value="AUTO_TERMINATE">Auto-Terminate (end on threshold)</option>
              <option value="LOCKDOWN">Lockdown (terminate on first violation)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-caption text-text-secondary">Violation Threshold</label>
              <input type="number" min={1} max={50} value={violationThreshold}
                onChange={(e) => setViolationThreshold(e.target.value)} className={inputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-caption text-text-secondary">Grace Period (warnings)</label>
              <input type="number" min={0} max={10} value={gracePeriod}
                onChange={(e) => setGracePeriod(e.target.value)} className={inputClass} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-caption text-text-secondary cursor-pointer">
            <input type="checkbox" checked={demoMode}
              onChange={(e) => setDemoMode(e.target.checked)}
              className="rounded border-border-default bg-bg-primary text-accent-gold focus:ring-accent-gold" />
            Demo mode (log violations only, no auto-action)
          </label>
        </fieldset>

        <button
          onClick={handleSubmit}
          disabled={loading || !jd.trim() || !resume.trim()}
          className="self-start px-6 py-2.5 rounded-radius-card bg-accent-gold text-bg-primary text-body font-semibold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {loading ? "Creating session…" : "Start Interview"}
        </button>
      </div>
    </div>
  );
}
