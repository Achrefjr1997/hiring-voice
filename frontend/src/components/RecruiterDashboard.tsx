import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useBandSession } from "../hooks/useBandSession";
import { useAuth } from "./AuthProvider";
import SessionSetup from "./SessionSetup";
import SessionInfo from "./SessionInfo";
import SessionHistoryList from "./SessionHistoryList";
import BandEventLog from "./BandEventLog";
import CoverageMapViz from "./CoverageMapViz";
import EvidencePortfolio from "./EvidencePortfolio";

type ViewMode = "history" | "setup" | "live";

export default function RecruiterDashboard() {
  const { state, connect } = useBandSession();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<ViewMode>("history");
  const [loading, setLoading] = useState(false);
  const [sessionLink, setSessionLink] = useState<string | null>(null);
  const [showViolationDetails, setShowViolationDetails] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [candidateEmail, setCandidateEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch("/sessions", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setSessions)
      .catch(() => {});
  }, [token]);

  const handleSessionCreate = async (jd: string, resume: string, rubric: string, duration: string, enforcementLevel: string, violationThreshold: number, gracePeriod: number, demoMode: boolean, ce?: string) => {
    setLoading(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const body = new URLSearchParams({
        jd, resume, rubric, role_level: "senior", duration_minutes: duration,
        enforcement_level: enforcementLevel,
        violation_threshold: String(violationThreshold),
        grace_period: String(gracePeriod),
        demo_mode: demoMode ? "true" : "false",
      });
      if (ce) body.set("candidate_email", ce);
      const res = await fetch("/session/create", {
        method: "POST",
        headers,
        body,
      });
      if (res.status === 401) { navigate("/login"); return; }
      const data = await res.json();
      connect(data.session_id);
      setSessionLink(`${window.location.origin}/interview/${data.session_id}`);
      setCandidateEmail(ce || null);
      setView("live");
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvite = async () => {
    if (!state.sessionId) return;
    const res = await fetch(`/session/${state.sessionId}/send-invite`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to send invite");
  };

  // History view
  if (view === "history") {
    return (
      <div className="flex flex-col p-4 max-w-3xl mx-auto min-h-screen">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-800">VoiceHire</h1>
          <button
            onClick={() => { localStorage.removeItem("auth_token"); localStorage.removeItem("auth_recruiter_id"); localStorage.removeItem("auth_email"); navigate("/login"); }}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Sign Out
          </button>
        </div>
        <SessionHistoryList
          sessions={sessions}
          onCreateNew={() => setView("setup")}
        />
      </div>
    );
  }

  // Setup view
  if (view === "setup") {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto p-4">
          <button onClick={() => setView("history")} className="mb-4 text-sm text-blue-600 hover:text-blue-800">
            ← Back to History
          </button>
        </div>
        <SessionSetup onSubmit={handleSessionCreate} loading={loading} />
      </div>
    );
  }

  // Live view (unchanged behavior)
  const handleIntegrityResume = async () => {
    if (!state.sessionId) return;
    await fetch(`/session/${state.sessionId}/integrity-resume`, { method: "POST" });
  };

  const handleIntegrityTerminate = async () => {
    if (!state.sessionId) return;
    await fetch(`/session/${state.sessionId}/integrity-terminate`, { method: "POST" });
  };

  return (
    <div className="flex flex-col gap-4 p-4 max-w-3xl mx-auto h-screen overflow-y-auto">
      {state.demoMode && (
        <div className="rounded-lg border-2 border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800 font-medium flex items-center gap-2">
          <span>DEMO MODE ACTIVE</span>
          <span className="text-xs font-normal text-amber-600">Violations are logged only. No auto-action.</span>
        </div>
      )}

      {state.integrityViolations.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2">
          <div className="flex items-center gap-2 text-sm text-red-700 font-medium">
            <span>⚠️</span>
            <span>{state.integrityViolations.length} integrity violation{state.integrityViolations.length > 1 ? "s" : ""} detected</span>
            <button
              onClick={() => setShowViolationDetails(!showViolationDetails)}
              className="ml-auto text-xs text-blue-600 hover:text-blue-800 underline font-normal"
            >
              {showViolationDetails ? "Hide" : "View"} Violation Details
            </button>
          </div>
          {showViolationDetails && (
            <div className="mt-3 space-y-1 max-h-64 overflow-y-auto">
              {[...state.integrityViolations].reverse().map((v: any, i: number) => (
                <div key={i} className="flex items-center gap-3 text-xs border-b border-red-100 pb-1 last:border-0">
                  <span className="text-gray-500 w-20 shrink-0">{new Date(v.timestamp).toLocaleTimeString()}</span>
                  <span className="text-gray-700 flex-1">{v.type.replace(/_/g, " ")}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    v.severity === "severe" ? "bg-red-100 text-red-700"
                      : v.severity === "warning" ? "bg-yellow-100 text-yellow-700"
                        : "bg-blue-100 text-blue-700"
                  }`}>
                    {v.severity?.toUpperCase() || "INFO"}
                  </span>
                  <span className="text-gray-400 font-mono w-8 text-right">{v.points}pt</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {state.integrityPaused && (
        <div className="rounded-lg border-2 border-red-400 bg-red-50 px-4 py-3 space-y-2">
          <p className="text-sm font-semibold text-red-700">Interview Paused — Integrity Policy Violation</p>
          <p className="text-xs text-red-600">Candidate has triggered the violation threshold.</p>
          <div className="flex gap-2">
            <button
              onClick={handleIntegrityResume}
              className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700"
            >
              Resume Interview
            </button>
            <button
              onClick={handleIntegrityTerminate}
              className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700"
            >
              Terminate Interview
            </button>
          </div>
        </div>
      )}

        <SessionInfo
          sessionLink={sessionLink}
          candidateName={state.candidateName}
          candidateStatus={state.candidateStatus}
          isSessionReady={state.isSessionReady}
          candidateEmail={candidateEmail}
          onSendInvite={handleSendInvite}
          sessionId={state.sessionId || undefined}
        />
      <BandEventLog events={state.events} connected={state.connected} />
      <CoverageMapViz coverageMap={state.coverageMap} />
      <EvidencePortfolio
        events={state.events}
        decision={state.decision}
        verdictRevealed={state.verdictRevealed}
        sessionId={state.sessionId}
        deliberationFullText={state.deliberationFullText}
      />
    </div>
  );
}
