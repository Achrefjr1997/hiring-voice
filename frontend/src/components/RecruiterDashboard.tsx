import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useBandSession } from "../hooks/useBandSession";
import { useAuth } from "./AuthProvider";
import { useSidebar } from "./SidebarContext";
import SessionSetup from "./SessionSetup";
import SessionInfo from "./SessionInfo";
import SessionHistoryList from "./SessionHistoryList";
import BandEventLog from "./BandEventLog";
import CoverageMapViz from "./CoverageMapViz";
import EvidencePortfolio from "./EvidencePortfolio";
import CandidatesCvsView from "./CandidatesCvsView";
import ActiveRecruitmentsView from "./ActiveRecruitmentsView";
import CreateJobModal from "./CreateJobModal";
import AnalyticsView from "./AnalyticsView";
import { Clock, Wifi, WifiOff, ChevronUp, ChevronDown, AlertTriangle } from "lucide-react";

type ViewMode = "history" | "setup" | "live";

export default function RecruiterDashboard() {
  const { state, connect } = useBandSession();
  const { token } = useAuth();
  const { activeView, prefillResume, navigateToView, setNavigateToView, setPrefillResume } = useSidebar();
  const navigate = useNavigate();
  const [view, setView] = useState<ViewMode>("history");
  const [loading, setLoading] = useState(false);
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [jobListKey, setJobListKey] = useState(0);
  const [sessionLink, setSessionLink] = useState<string | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [candidateEmail, setCandidateEmail] = useState<string | null>(null);
  const [sidePanels, setSidePanels] = useState({ competency: true, eventLog: true, integrity: true });

  const togglePanel = (panel: keyof typeof sidePanels) =>
    setSidePanels((s) => ({ ...s, [panel]: !s[panel] }));

  useEffect(() => {
    if (navigateToView === "setup") {
      setView("setup");
      setNavigateToView(null);
    }
  }, [navigateToView, setNavigateToView]);

  useEffect(() => {
    if (view !== "setup" && prefillResume) {
      setPrefillResume("");
    }
  }, [view]);

  useEffect(() => {
    if (!token) return;
    fetch("/sessions", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setSessions(data.sessions || []))
      .catch(() => {});
  }, [token]);

  const handleSessionCreate = async (jd: string, resume: string, rubric: string, duration: string, enforcementLevel: string, violationThreshold: number, gracePeriod: number, demoMode: boolean, ce?: string, jobId?: string) => {
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
      if (jobId) body.set("job_id", jobId);
      const res = await fetch("/session/create", {
        method: "POST", headers,
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

  const handleIntegrityResume = async () => {
    if (!state.sessionId) return;
    await fetch(`/session/${state.sessionId}/integrity-resume`, { method: "POST" });
  };

  const handleIntegrityTerminate = async () => {
    if (!state.sessionId) return;
    await fetch(`/session/${state.sessionId}/integrity-terminate`, { method: "POST" });
  };

  const covered = Object.values(state.coverageMap).filter((c) => c.status === "COVERED").length;
  const total = Object.keys(state.coverageMap).length;

  return (

      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ────────── INTERVIEWS VIEW ────────── */}
        {activeView === "interviews" && (
          <>
            {view === "history" && (
              <>
                <div className="h-14 border-b border-border-default flex items-center justify-between px-8 shrink-0">
                  <h1 className="text-body font-semibold text-text-primary">Recent Interviews</h1>
                  <button
                    onClick={() => setView("setup")}
                    className="bg-accent-gold text-bg-primary text-caption font-semibold px-5 py-2 rounded-radius-input hover:brightness-110 transition-all"
                  >
                    + New Interview
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-8">
                  <SessionHistoryList sessions={sessions} />
                </div>
              </>
            )}

            {view === "setup" && (
              <>
                <div className="h-14 border-b border-border-default flex items-center gap-4 px-8 shrink-0">
                  <button
                    onClick={() => setView("history")}
                    className="text-caption text-accent-gold hover:text-accent-gold/80 transition-colors"
                  >
                    ← Back
                  </button>
                  <h1 className="text-body font-semibold text-text-primary">New Interview</h1>
                </div>
                <div className="flex-1 overflow-y-auto p-8">
                  <div className="max-w-2xl mx-auto">
                    <SessionSetup onSubmit={handleSessionCreate} loading={loading} prefillResume={prefillResume} />
                  </div>
                </div>
              </>
            )}

            {view === "live" && (
              <>
                {/* Status bar */}
                <div className="flex items-center gap-4 px-6 py-2.5 border-b border-border-default bg-surface-default shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-status-live live-pulse" />
                    <span className="text-caption font-medium text-status-live">
                      {state.connected ? "LIVE" : "RECONNECTING"}
                    </span>
                    {!state.connected && <WifiOff size={12} className="text-status-alert" />}
                  </div>

                  {state.candidateName && (
                    <>
                      <span className="text-text-primary text-body font-medium">{state.candidateName}</span>
                      <span className="text-text-muted text-caption hidden sm:inline">
                        · {covered}/{total} competencies · {state.integrityViolations.length} violations
                      </span>
                    </>
                  )}

                  <div className="ml-auto flex items-center gap-3 text-caption text-text-muted">
                    {state.isSessionReady && (
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {(() => {
                          const elapsed = state.isSessionReady && state.events.length > 0
                            ? Math.floor((Date.now() - new Date(state.events[state.events.length - 1]?.timestamp || Date.now()).getTime()) / 1000)
                            : 0;
                          return `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
                        })()}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      {state.connected
                        ? <><Wifi size={12} className="text-status-live" /><span>Live</span></>
                        : <><WifiOff size={12} className="text-status-alert" /><span>Disconnected</span></>
                      }
                    </span>
                  </div>
                </div>

                {/* Demo mode banner */}
                {state.demoMode && (
                  <div className="mx-6 mt-3 rounded-radius-card bg-accent-gold/10 border border-accent-gold/30 px-4 py-2 text-caption text-accent-gold flex items-center gap-2 shrink-0">
                    <span className="font-semibold">DEMO MODE</span>
                    <span className="text-text-muted">Violations are logged only. No auto-action.</span>
                  </div>
                )}

                {/* Integrity paused banner */}
                {state.integrityPaused && (
                  <div className="mx-6 mt-3 rounded-radius-card bg-status-alert/10 border border-status-alert/30 px-4 py-3 shrink-0">
                    <p className="text-caption font-semibold text-status-alert mb-1">Interview Paused — Integrity Policy Violation</p>
                    <p className="text-caption text-status-alert/70 mb-2">Candidate has triggered the violation threshold.</p>
                    <div className="flex gap-2">
                      <button onClick={handleIntegrityResume} className="px-3 py-1.5 rounded-radius-card bg-status-live text-bg-primary text-caption font-medium hover:brightness-110 transition-all">
                        Resume Interview
                      </button>
                      <button onClick={handleIntegrityTerminate} className="px-3 py-1.5 rounded-radius-card bg-status-alert text-white text-caption font-medium hover:brightness-110 transition-all">
                        Terminate Interview
                      </button>
                    </div>
                  </div>
                )}

                {/* Main grid */}
                <div className="flex-1 flex gap-4 p-4 overflow-hidden">
                  <div className="flex-1 flex flex-col gap-4 min-w-0">
                    <div className="bg-surface-default border border-border-default rounded-radius-card flex-1 flex flex-col overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-default">
                        <h2 className="text-caption font-medium text-text-secondary uppercase tracking-wide">Live Transcript</h2>
                      </div>
                      <div className="flex-1 overflow-y-auto">
                        <SessionInfo
                          sessionLink={sessionLink}
                          candidateName={state.candidateName}
                          candidateStatus={state.candidateStatus}
                          isSessionReady={state.isSessionReady}
                          candidateEmail={candidateEmail}
                          onSendInvite={handleSendInvite}
                          sessionId={state.sessionId || undefined}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="w-[380px] shrink-0 flex flex-col gap-3 overflow-y-auto">
                    <div className="bg-surface-default border border-border-default rounded-radius-card overflow-hidden">
                      <button
                        onClick={() => togglePanel("competency")}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-surface-hover transition-colors"
                      >
                        <h2 className="text-caption font-medium text-text-secondary uppercase tracking-wide">Skill Map</h2>
                        {sidePanels.competency ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
                      </button>
                      {sidePanels.competency && (
                        <div className="px-3 pb-3 max-h-64 overflow-y-auto">
                          <CoverageMapViz coverageMap={state.coverageMap} />
                          <EvidencePortfolio
                            events={state.events}
                            decision={state.decision}
                            verdictRevealed={state.verdictRevealed}
                            sessionId={state.sessionId}
                            deliberationFullText={state.deliberationFullText}
                          />
                        </div>
                      )}
                    </div>

                    <div className="bg-surface-default border border-border-default rounded-radius-card overflow-hidden">
                      <button
                        onClick={() => togglePanel("eventLog")}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-surface-hover transition-colors"
                      >
                        <h2 className="text-caption font-medium text-text-secondary uppercase tracking-wide">Event Log</h2>
                        {sidePanels.eventLog ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
                      </button>
                      {sidePanels.eventLog && (
                        <div className="max-h-48 overflow-y-auto">
                          <BandEventLog events={state.events} connected={state.connected} />
                        </div>
                      )}
                    </div>

                    <div className="bg-surface-default border border-border-default rounded-radius-card overflow-hidden">
                      <button
                        onClick={() => togglePanel("integrity")}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-surface-hover transition-colors"
                      >
                        <h2 className="text-caption font-medium text-text-secondary uppercase tracking-wide">
                          Integrity Monitor
                          {state.integrityViolations.length > 0 && (
                            <span className="ml-2 text-status-alert">({state.integrityViolations.length})</span>
                          )}
                        </h2>
                        {sidePanels.integrity ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
                      </button>
                      {sidePanels.integrity && (
                        <div className="px-4 py-3 text-caption text-text-muted">
                          {state.integrityViolations.length === 0 ? (
                            <p>No violations detected.</p>
                          ) : (
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                              {[...state.integrityViolations].reverse().map((v: any, i: number) => (
                                <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-radius-card bg-surface-raised border border-border-default">
                                  <AlertTriangle size={12} className={v.severity === "severe" ? "text-status-alert" : "text-status-warning"} />
                                  <span className="flex-1 text-text-primary text-caption">{v.type.replace(/_/g, " ")}</span>
                                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-radius-card ${
                                    v.severity === "severe" ? "bg-status-alert/20 text-status-alert" : "bg-status-warning/20 text-status-warning"
                                  }`}>
                                    {v.points}pt
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ────────── CANDIDATES & CVs VIEW ────────── */}
        {activeView === "candidates" && (
          <>
            <div className="h-14 border-b border-border-default flex items-center px-8 shrink-0">
              <h1 className="text-body font-semibold text-text-primary">Candidate Database</h1>
            </div>
            <div className="flex-1 overflow-y-auto">
              <CandidatesCvsView />
            </div>
          </>
        )}

        {/* ────────── ACTIVE RECRUITMENTS VIEW ────────── */}
        {activeView === "recruitments" && (
          <>
            <div className="h-14 border-b border-border-default flex items-center justify-between px-8 shrink-0">
              <h1 className="text-body font-semibold text-text-primary">Active Recruitments</h1>
              <button onClick={() => setShowCreateJob(true)} className="bg-accent-gold text-bg-primary text-caption font-semibold px-5 py-2 rounded-radius-input hover:brightness-110 transition-all">
                + Create Job
              </button>
            </div>
            <ActiveRecruitmentsView key={jobListKey} />
          </>
        )}

        {showCreateJob && (
          <CreateJobModal
            onClose={() => setShowCreateJob(false)}
            onCreated={() => { setShowCreateJob(false); setJobListKey((k) => k + 1); }}
          />
        )}

        {/* ────────── ANALYTICS VIEW ────────── */}
        {activeView === "analytics" && (
          <>
            <div className="h-14 border-b border-border-default flex items-center px-8 shrink-0">
              <h1 className="text-body font-semibold text-text-primary">Analytics</h1>
            </div>
            <AnalyticsView />
          </>
        )}

      </div>
  );
}
