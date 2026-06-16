import { useState } from "react";

export default function SessionSetup({
  onSubmit,
  loading,
}: {
  onSubmit: (jd: string, resume: string, rubric: string, duration: string, enforcementLevel: string, violationThreshold: number, gracePeriod: number, demoMode: boolean, candidateEmail?: string) => Promise<void>;
  loading: boolean;
}) {
  const [jd, setJd] = useState("");
  const [resume, setResume] = useState("");
  const [rubric, setRubric] = useState("");
  const [duration, setDuration] = useState("30");
  const [enforcementLevel, setEnforcementLevel] = useState("OBSERVATION_ONLY");
  const [violationThreshold, setViolationThreshold] = useState("3");
  const [gracePeriod, setGracePeriod] = useState("1");
  const [demoMode, setDemoMode] = useState(true);
  const [candidateEmail, setCandidateEmail] = useState("");

  const handleSubmit = async () => {
    if (!jd.trim() || !resume.trim()) return;
    await onSubmit(jd, resume, rubric, duration, enforcementLevel, parseInt(violationThreshold) || 3, parseInt(gracePeriod) || 1, demoMode, candidateEmail || undefined);
  };

  const inputClass = "w-full bg-bg-primary border border-border-default rounded-radius-card px-3 py-2 text-body text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-gold focus:border-accent-gold transition-colors";
  const labelClass = "text-caption text-text-secondary font-medium";
  const selectClass = inputClass;

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <h1 className="font-heading text-h2 text-text-primary">Session Setup</h1>

      <div className="bg-surface-default border border-border-default rounded-radius-card p-6 flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Job Description *</label>
          <textarea
            value={jd}
            onChange={(e) => setJd(e.target.value)}
            rows={5}
            placeholder="Paste the full job description here…"
            className={inputClass + " resize-y"}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Candidate Resume *</label>
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
