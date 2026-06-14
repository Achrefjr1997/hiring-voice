import { useState } from "react";

export default function SessionSetup({
  onSubmit,
  loading,
}: {
  onSubmit: (jd: string, resume: string, rubric: string, duration: string) => Promise<void>;
  loading: boolean;
}) {
  const [jd, setJd] = useState("");
  const [resume, setResume] = useState("");
  const [rubric, setRubric] = useState("");
  const [duration, setDuration] = useState("30");

  const handleSubmit = async () => {
    if (!jd.trim() || !resume.trim()) return;
    await onSubmit(jd, resume, rubric, duration);
  };

  return (
    <div className="max-w-2xl mx-auto p-8 flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-gray-800">VoiceHire — Session Setup</h1>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Job Description *</label>
        <textarea
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          rows={6}
          placeholder="Paste the full job description here…"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Candidate Resume *</label>
        <textarea
          value={resume}
          onChange={(e) => setResume(e.target.value)}
          rows={6}
          placeholder="Paste the candidate's resume here…"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Company Rubric (optional)</label>
        <textarea
          value={rubric}
          onChange={(e) => setRubric(e.target.value)}
          rows={4}
          placeholder="Paste your company's hiring rubric or evaluation criteria…"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Session Duration</label>
        <select
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="15">15 Minutes (Quick Screen)</option>
          <option value="30">30 Minutes (Standard)</option>
          <option value="45">45 Minutes (Deep Dive)</option>
          <option value="60">60 Minutes (Executive)</option>
        </select>
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading || !jd.trim() || !resume.trim()}
        className="self-start px-6 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Creating session…" : "Start interview"}
      </button>
    </div>
  );
}
