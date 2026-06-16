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

    // Fetch competency summary with polling (up to 60s)
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
        // Network error, retry
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
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="max-w-md p-8 bg-white rounded-xl border border-red-200 shadow-sm">
          <h1 className="text-lg font-semibold text-red-700 mb-2">Cannot join interview</h1>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (stage === "validating") {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <p className="text-sm text-gray-400">Verifying link…</p>
      </div>
    );
  }

  if (stage === "name-form") {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <CandidateNameForm onSubmit={handleNameSubmit} />
      </div>
    );
  }

  if (stage === "summary" && competencySummary) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
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
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="max-w-md p-8 bg-white rounded-xl border border-green-200 shadow-sm text-center">
          <h1 className="text-lg font-semibold text-green-700 mb-2">Interview Complete</h1>
          <p className="text-sm text-gray-600">Thank you for your time. We will review your interview and contact you regarding next steps.</p>
          <p className="text-xs text-gray-400 mt-4">You may now close this tab.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-4 relative">
      {state.integrityPaused && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl max-w-md p-8 text-center">
            <h2 className="text-lg font-semibold text-red-700 mb-2">Interview Paused</h2>
            <p className="text-sm text-gray-600">Please wait for the recruiter to resume the session.</p>
          </div>
        </div>
      )}

      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={handleFinish}
          disabled={finishing}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-red-200 text-red-600 bg-white hover:bg-red-50 disabled:opacity-50"
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
