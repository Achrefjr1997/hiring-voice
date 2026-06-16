import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useBandSession } from "../hooks/useBandSession";
import { useIntegrityCheck } from "../hooks/useIntegrityCheck";
import CandidateNameForm from "./CandidateNameForm";
import CompetencySummary from "./CompetencySummary";
import VoiceInterface from "./VoiceInterface";
import type { CompetencySummary as CompetencySummaryType } from "../types";

type Stage = "validating" | "invalid" | "name-form" | "summary" | "interview" | "finished";

export default function CandidateRoom() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { state, connect, sendAudio } = useBandSession();
  const [stage, setStage] = useState<Stage>("validating");

  useEffect(() => {
    document.body.classList.add("candidate-mode");
    return () => document.body.classList.remove("candidate-mode");
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [competencySummary, setCompetencySummary] = useState<CompetencySummaryType | null>(null);
  const [finishing, setFinishing] = useState(false);
  useIntegrityCheck(sessionId ?? null, stage === "interview");

  useEffect(() => {
    if (state.status === "ended" && stage === "interview") {
      setStage("finished");
    }
  }, [state.status, stage]);

  useEffect(() => {
    if (!sessionId) {
      setError("Invalid or expired interview link");
      setStage("invalid");
      return;
    }
    fetch(`/session/${sessionId}`)
      .then(async (r) => {
        if (r.status === 404) {
          setError("Invalid or expired interview link");
          setStage("invalid");
        } else {
          const data = await r.json();
          if (data.status === "ENDED" || data.status === "completed" || data.status === "CANDIDATE_FINISHED") {
            setError("This interview has already been completed.");
            setStage("invalid");
          } else {
            setStage("name-form");
          }
        }
      })
      .catch(() => {
        setError("Could not connect to server");
        setStage("invalid");
      });
  }, [sessionId]);

  const handleNameSubmit = async (first: string, last: string) => {
    if (!sessionId) return;
    await fetch(`/session/${sessionId}/candidate`, {
      method: "POST",
      body: new URLSearchParams({ first_name: first, last_name: last }),
    });

    let summary: CompetencySummaryType | null = null;
    let pollAttempts = 0;
    while (!summary && pollAttempts < 30) {
      pollAttempts++;
      try {
        const res = await fetch(`/session/${sessionId}/competencies`);
        if (res.ok) {
          summary = await res.json();
          break;
        }
      } catch {
        // retry
      }
      await new Promise((r) => setTimeout(r, 2000));
    }

    if (!summary) {
      setError("Interview not ready after 60 seconds. Please try again later.");
      return;
    }

    setCompetencySummary(summary);
    setStage("summary");
  };

  const handleStartInterview = async () => {
    if (!sessionId) return;
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.warn("[AntiCheat] Fullscreen request failed:", err);
    }
    connect(sessionId);
    setStage("interview");
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

  if (stage === "invalid") {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="max-w-md p-8 bg-surface-default rounded-radius-card border border-status-alert/30 shadow-sm">
          <h1 className="text-heading font-semibold text-status-alert font-serif mb-2">Cannot join interview</h1>
          <p className="text-body text-text-muted">{error}</p>
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
        <div className="bg-surface-default rounded-radius-card border border-border-default shadow-sm p-8 max-w-md w-full mx-4">
          <CandidateNameForm onSubmit={handleNameSubmit} />
        </div>
      </div>
    );
  }

  if (stage === "summary" && competencySummary) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <CompetencySummary
          competencies={competencySummary.competencies}
          estimatedDuration={competencySummary.estimated_duration}
          onStart={handleStartInterview}
        />
      </div>
    );
  }

  if (stage === "finished") {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="max-w-md p-8 bg-surface-default rounded-radius-card border border-accent-gold/20 shadow-sm text-center">
          <div className="w-16 h-16 rounded-full bg-accent-gold/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-accent-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-heading font-semibold text-text-primary font-serif mb-2">Interview Complete</h1>
          <p className="text-body text-text-muted">Thank you for your time. We will review your interview and contact you regarding next steps.</p>
          <p className="text-caption text-text-muted mt-6">You may now close this tab.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen p-4 relative">
      {state.integrityPaused && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="bg-surface-default rounded-radius-card shadow-xl max-w-md p-8 text-center border border-border-default">
            <h2 className="text-heading font-semibold text-text-primary font-serif mb-2">Interview Paused</h2>
            <p className="text-body text-text-muted">Please wait for the recruiter to resume the session.</p>
          </div>
        </div>
      )}

      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={handleFinish}
          disabled={finishing}
          className="px-4 py-2 text-body font-medium rounded-radius-card border border-accent-gold/30 text-accent-gold bg-surface-default hover:bg-accent-gold/10 disabled:opacity-50 transition-colors"
        >
          {finishing ? "Ending Interview..." : "Finish Interview"}
        </button>
      </div>

      <VoiceInterface
        events={state.events}
        onAudioReady={sendAudio}
        sessionStatus={state.status}
      />
    </div>
  );
}
