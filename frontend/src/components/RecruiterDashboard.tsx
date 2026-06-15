import { useState } from "react";
import { useBandSession } from "../hooks/useBandSession";
import SessionSetup from "./SessionSetup";
import SessionInfo from "./SessionInfo";
import BandEventLog from "./BandEventLog";
import CoverageMapViz from "./CoverageMapViz";
import EvidencePortfolio from "./EvidencePortfolio";

export default function RecruiterDashboard() {
  const { state, connect } = useBandSession();
  const [loading, setLoading] = useState(false);
  const [sessionLink, setSessionLink] = useState<string | null>(null);
  const [showViolationDetails, setShowViolationDetails] = useState(false);

  const handleSessionCreate = async (jd: string, resume: string, rubric: string, duration: string, enforcementLevel: string, violationThreshold: number, gracePeriod: number, demoMode: boolean) => {
    setLoading(true);
    try {
      const res = await fetch("/session/create", {
        method: "POST",
        body: new URLSearchParams({
          jd, resume, rubric, role_level: "senior", duration_minutes: duration,
          enforcement_level: enforcementLevel,
          violation_threshold: String(violationThreshold),
          grace_period: String(gracePeriod),
          demo_mode: demoMode ? "true" : "false",
        }),
      });
      const data = await res.json();
      connect(data.session_id);
      setSessionLink(`${window.location.origin}/interview/${data.session_id}`);
    } finally {
      setLoading(false);
    }
  };

  if (state.status === "idle") {
    return <SessionSetup onSubmit={handleSessionCreate} loading={loading} />;
  }

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
              {[...state.integrityViolations].reverse().map((v, i) => (
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
