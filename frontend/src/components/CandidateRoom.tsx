import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useBandSession } from "../hooks/useBandSession";
import { useIntegrityCheck } from "../hooks/useIntegrityCheck";
import CandidateNameForm from "./CandidateNameForm";

import VoiceInterface from "./VoiceInterface";
import { AlertCircle, Clock, CheckCircle, Loader2, Mic, Monitor } from "lucide-react";
import { Logo } from "./ui/Logo";


type Stage = "validating" | "invalid" | "name-form" | "permissions" | "preparing" | "interview" | "finished";

export default function CandidateRoom() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { state, connect, sendAudio } = useBandSession();
  const [stage, setStage] = useState<Stage>("validating");

  useEffect(() => {
    document.body.classList.add("candidate-mode");
    return () => document.body.classList.remove("candidate-mode");
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<{ type: "completed" | "invalid" | "network" } | null>(null);

  const [preparingError, setPreparingError] = useState(false);
  const [micGranted, setMicGranted] = useState(false);
  const [fullscreenGranted, setFullscreenGranted] = useState(false);
  const [permissionsLoading, setPermissionsLoading] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<{ title?: string } | null>(null);
  const [candidateName, setCandidateName] = useState("");
  useIntegrityCheck(sessionId ?? null, stage === "interview");

  useEffect(() => {
    if (stage !== "preparing") return;
    const minTimer = setTimeout(() => setStage("interview"), 2500);
    const safetyTimer = setTimeout(() => setPreparingError(true), 10000);
    return () => { clearTimeout(minTimer); clearTimeout(safetyTimer); };
  }, [stage]);

  useEffect(() => {
    if (state.status === "ended" && stage === "interview") {
      setStage("finished");
    }
  }, [state.status, stage]);

  useEffect(() => {
    if (stage === "finished" && !candidateName && sessionId) {
      fetch(`/session/${sessionId}`)
        .then((r) => r.json())
        .then((data) => setCandidateName(data.candidate_name || "Candidate"))
        .catch(() => setCandidateName("Candidate"));
    }
  }, [stage, candidateName, sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setError("Invalid or expired interview link");
      setErrorDetail({ type: "invalid" });
      setStage("invalid");
      return;
    }
    fetch(`/session/${sessionId}`)
      .then(async (r) => {
        if (r.status === 404) {
          setError("Invalid or expired interview link");
          setErrorDetail({ type: "invalid" });
          setStage("invalid");
        } else {
          const data = await r.json();
          setSessionInfo(data);
          if (data.status === "ENDED" || data.status === "completed" || data.status === "CANDIDATE_FINISHED") {
            setError("This interview has already been completed.");
            setErrorDetail({ type: "completed" });
            setStage("invalid");
          } else {
            setStage("name-form");
          }
        }
      })
      .catch(() => {
        setError("Could not connect to server");
        setErrorDetail({ type: "network" });
        setStage("invalid");
      });
  }, [sessionId]);

  const handleNameSubmit = async (first: string, last: string) => {
    if (!sessionId) return;
    setCandidateName(`${first} ${last}`);
    await fetch(`/session/${sessionId}/candidate`, {
      method: "POST",
      body: new URLSearchParams({ first_name: first, last_name: last }),
    });
    setStage("permissions");
  };

  const handleFinish = async () => {
    if (!sessionId || finishing) return;
    setFinishing(true);
    try {
      await fetch(`/session/${sessionId}/finish`, { method: "POST" });
    } catch {
      // Server will auto-end regardless
    }
    setStage("finished");
  };

  const handleGrantMic = async () => {
    setPermissionsLoading("mic");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicGranted(true);
    } catch {
      // Permission denied — user can retry
    }
    setPermissionsLoading(null);
  };

  const handleGrantFullscreen = async () => {
    setPermissionsLoading("fullscreen");
    try {
      await document.documentElement.requestFullscreen();
      setFullscreenGranted(true);
    } catch {
      // Fullscreen denied — user can retry
    }
    setPermissionsLoading(null);
  };

  const handleStartFromPermissions = () => {
    if (!sessionId || !micGranted || !fullscreenGranted) return;
    connect(sessionId);
    setStage("preparing");
  };

  const currentFocus = useMemo(() => {
    const probeEvent = state.events.find((e) => e.type === "PROBE_GENERATED");
    if (!probeEvent) return null;
    const compId = (probeEvent.payload as any)?.competencyTargeted;
    if (!compId || !state.coverageMap[compId]) return null;
    const c = state.coverageMap[compId];
    return { name: c.name, domain: c.domain };
  }, [state.events, state.coverageMap]);

  if (stage === "invalid") {
    const isCompleted = errorDetail?.type === "completed";
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md bg-surface-cream rounded-radius-card border border-border-cream shadow-lg p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-accent-gold/10 flex items-center justify-center mx-auto mb-5">
            {isCompleted
              ? <Clock size={36} className="text-accent-gold" />
              : <AlertCircle size={36} className="text-accent-gold" />
            }
          </div>
          <h1 className="text-h1 font-semibold text-text-inverted font-serif mb-2">Interview Unavailable</h1>
          <p className="text-body text-text-muted leading-relaxed mb-4">
            {isCompleted
              ? "This interview session has already been completed or is no longer active."
              : "This interview link is invalid or has expired."}
            {" "}If you believe this is an error, please contact the recruiter who sent you this link.
          </p>
          {sessionId && (
            <p className="text-caption text-text-muted mb-6">Session: {sessionId.slice(0, 8)}...</p>
          )}
          <div className="flex gap-3 justify-center">
            <a
              href="mailto:support@voicehire.ai"
              className="px-5 py-2 text-caption font-semibold rounded-radius-card bg-accent-gold text-bg-primary hover:brightness-110 transition-all"
            >
              Contact Support
            </a>
            <button
              onClick={() => window.close()}
              className="px-5 py-2 text-caption text-text-muted border border-border-light rounded-radius-card hover:text-text-inverted transition-colors"
            >
              Close Window
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (stage === "validating") {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-body text-text-muted italic">Verifying link\u2026</p>
      </div>
    );
  }

  if (stage === "name-form") {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="bg-surface-cream rounded-radius-card border border-border-cream shadow-lg p-8 max-w-md w-full mx-4">
          <CandidateNameForm onSubmit={handleNameSubmit} />
        </div>
      </div>
    );
  }

  if (stage === "permissions") {
    const allGranted = micGranted && fullscreenGranted;
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-cream p-4">
        <div className="w-full max-w-md bg-white rounded-xl border-2 border-gray-200 shadow-xl p-8">
          <h1 className="text-3xl font-serif text-gray-900 mb-2 text-center">Almost Ready</h1>
          <p className="text-sm text-gray-600 mb-8 text-center">
            Grant the following permissions to enable your interview experience.
          </p>

          <div className="space-y-4 mb-6">
            {/* Microphone Permission */}
            <div className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
              micGranted
                ? "border-green-200 bg-green-50"
                : "border-gray-200 bg-gray-50"
            }`}>
              <div className="flex items-center gap-3 flex-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  micGranted ? "bg-green-100" : "bg-yellow-100"
                }`}>
                  {micGranted
                    ? <CheckCircle size={20} className="text-green-600" />
                    : <Mic size={20} className="text-yellow-600" />
                  }
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">Microphone Access</p>
                  <p className="text-xs text-gray-600">Required to record your responses</p>
                </div>
              </div>
              {micGranted ? (
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-100 border border-green-300">
                  <CheckCircle size={16} className="text-green-700" />
                  <span className="text-sm font-semibold text-green-700">Granted</span>
                </div>
              ) : (
                <button
                  onClick={handleGrantMic}
                  disabled={permissionsLoading === "mic"}
                  className="px-5 py-2 text-sm font-semibold rounded-lg bg-accent-gold text-gray-900 hover:brightness-110 disabled:opacity-50 transition-all shrink-0 shadow-sm"
                >
                  {permissionsLoading === "mic" ? "Granting…" : "Grant"}
                </button>
              )}
            </div>

            {/* Fullscreen Permission */}
            <div className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
              fullscreenGranted
                ? "border-green-200 bg-green-50"
                : "border-gray-200 bg-gray-50"
            }`}>
              <div className="flex items-center gap-3 flex-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  fullscreenGranted ? "bg-green-100" : "bg-yellow-100"
                }`}>
                  {fullscreenGranted
                    ? <CheckCircle size={20} className="text-green-600" />
                    : <Monitor size={20} className="text-yellow-600" />
                  }
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">Fullscreen Mode</p>
                  <p className="text-xs text-gray-600">Provides a distraction-free experience</p>
                </div>
              </div>
              {fullscreenGranted ? (
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-100 border border-green-300">
                  <CheckCircle size={16} className="text-green-700" />
                  <span className="text-sm font-semibold text-green-700">Granted</span>
                </div>
              ) : (
                <button
                  onClick={handleGrantFullscreen}
                  disabled={permissionsLoading === "fullscreen"}
                  className="px-5 py-2 text-sm font-semibold rounded-lg bg-accent-gold text-gray-900 hover:brightness-110 disabled:opacity-50 transition-all shrink-0 shadow-sm"
                >
                  {permissionsLoading === "fullscreen" ? "Granting…" : "Grant"}
                </button>
              )}
            </div>
          </div>

          {/* Helper Text */}
          {!allGranted && (
            <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-start gap-2">
              <svg className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-blue-700">
                Please grant both permissions to continue to your interview.
              </p>
            </div>
          )}

          {/* Start Interview Button */}
          <button
            onClick={handleStartFromPermissions}
            disabled={!allGranted}
            className={`w-full px-6 py-4 rounded-lg text-base font-bold transition-all shadow-md ${
              allGranted
                ? "bg-accent-gold text-gray-900 hover:brightness-110 cursor-pointer"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            {allGranted ? "Start Interview" : "Waiting for Permissions..."}
          </button>

          {/* Security Message */}
          <p className="text-sm text-gray-500 text-center mt-4 flex items-center justify-center gap-2">
            <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Your session is secure and encrypted
          </p>
        </div>
      </div>
    );
  }

  if (stage === "preparing") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-surface-cream p-4">
        <div className="w-16 h-16 border-4 border-accent-gold/20 border-t-accent-gold rounded-full animate-spin mb-6" />

        <h2 className="text-h2 font-serif text-text-inverted mb-2 text-center">Preparing Your Interview</h2>
        <p className="text-body text-text-muted text-center max-w-md">
          Our AI Hiring Committee is reviewing your profile and generating your personalized competency rubric...
        </p>

        <div className="mt-8 space-y-3 text-caption text-text-muted">
          <div className="flex items-center gap-2">
            <CheckCircle size={14} className="text-status-live" /> Audio verified
          </div>
          <div className="flex items-center gap-2 animate-pulse">
            <Loader2 size={14} className="text-accent-gold" /> Initializing Session Brain...
          </div>
        </div>

        {preparingError && (
          <div className="mt-8 text-center">
            <p className="text-body text-status-alert mb-3">Something went wrong. Please try again.</p>
            <button
              onClick={() => { setPreparingError(false); setStage("name-form"); }}
              className="px-6 py-2 rounded-radius-card bg-accent-gold text-text-on-accent font-medium hover:brightness-110 transition-all"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    );
  }

  if (stage === "finished") {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md bg-surface-cream rounded-radius-card border border-border-cream shadow-lg p-8 text-center">
          <Logo size="xl" animate="pulse" className="mx-auto mb-6" />

          <div className="w-20 h-20 rounded-full bg-accent-gold/10 flex items-center justify-center mx-auto mb-5">
            <svg className="w-10 h-10 text-accent-gold checkmark-draw" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-h1 font-semibold text-text-inverted font-serif mb-2">
            Thank You, {candidateName || "Candidate"}!
          </h1>
          <p className="text-body text-text-muted leading-relaxed mb-6">
            Your responses have been securely recorded. Our AI Hiring Committee is now analyzing your evidence portfolio. You can expect feedback within 48 hours.
          </p>
          <div className="bg-[#F5F2EB] rounded-radius-card p-4 mb-6 space-y-3 text-left">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-status-live/15 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-status-live" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-[14px] text-text-inverted">Interview Completed</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-accent-gold/15 flex items-center justify-center flex-shrink-0">
                <span className="text-accent-gold text-[13px] font-bold animate-pulse">⋯</span>
              </div>
              <span className="text-[14px] text-text-inverted">AI Analysis <span className="text-text-muted">(In Progress)</span></span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-white/60 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-[14px] text-text-muted">Feedback Email <span className="text-text-muted">(Coming Soon)</span></span>
            </div>
          </div>
          <p className="text-caption text-text-muted mb-4">
            Having issues? <a href="mailto:support@voicehire.ai" className="text-accent-gold hover:underline">support@voicehire.ai</a>
          </p>
          <p className="text-[11px] text-text-muted">
            VoiceHire — Evidence-based hiring, powered by AI.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-40 bg-[#F5F2EB] border-b border-border-cream px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Logo size="xs" withText textPosition="right" />
          <div className="border-l border-border-cream pl-4">
            <p className="text-[15px] font-semibold text-text-inverted">
              {sessionInfo?.title || `${sessionId?.slice(0, 8) ?? "Interview"}`}
            </p>
            <p className="text-caption text-text-muted">
              {sessionInfo?.title ? `Session: ${sessionId?.slice(0, 8)}` : ""}
            </p>
          </div>
        </div>
        <button
          onClick={handleFinish}
          disabled={finishing}
          className="px-4 py-1.5 text-caption font-medium rounded-radius-input border border-border-light text-text-muted hover:bg-black/5 disabled:opacity-50 transition-colors"
        >
          {finishing ? "Ending…" : "End Interview"}
        </button>
      </div>

      <div className="flex flex-col items-center justify-center min-h-screen p-4 pt-20 relative">
        {state.integrityPaused && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
            <div className="bg-surface-default rounded-radius-card shadow-xl max-w-md p-8 text-center border border-border-default">
              <h2 className="text-heading font-semibold text-text-primary font-serif mb-2">Interview Paused</h2>
              <p className="text-body text-text-muted">Please wait for the recruiter to resume the session.</p>
            </div>
          </div>
        )}

        <VoiceInterface
          events={state.events}
          onAudioReady={sendAudio}
          sessionStatus={state.status}
          currentFocus={currentFocus}
        />
      </div>
    </>
  );
}
