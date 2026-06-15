import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useBandSession } from "../hooks/useBandSession";
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

  useEffect(() => {
    if (!sessionId) {
      setError("Invalid or expired interview link");
      setStage("invalid");
      return;
    }
    fetch(`/session/${sessionId}`)
      .then((r) => {
        if (r.status === 404) {
          setError("Invalid or expired interview link");
          setStage("invalid");
        } else {
          setStage("name-form");
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

  const handleStartInterview = () => {
    if (!sessionId) return;
    connect(sessionId);
    setStage("interview");
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
          <h1 className="text-lg font-semibold text-green-700 mb-2">Thank you!</h1>
          <p className="text-sm text-gray-600">Recruiter notified. You may close this tab.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-4">
      <VoiceInterface
        events={state.events}
        onAudioReady={sendAudio}
        sessionStatus={state.status}
      />
    </div>
  );
}
