import { useState } from "react";
import { useBandSession } from "./hooks/useBandSession";
import SessionSetup from "./components/SessionSetup";
import BandEventLog from "./components/BandEventLog";
import CoverageMapViz from "./components/CoverageMapViz";
import EvidencePortfolio from "./components/EvidencePortfolio";
import VoiceInterface from "./components/VoiceInterface";

export default function App() {
  const { state, connect, sendAudio } = useBandSession();
  const [loading, setLoading] = useState(false);

  const handleSessionCreate = async (jd: string, resume: string, rubric: string, duration: string) => {
    setLoading(true);
    try {
      const res = await fetch("/session/create", {
        method: "POST",
        body: new URLSearchParams({ jd, resume, rubric, role_level: "senior", duration_minutes: duration }),
      });
      const data = await res.json();
      connect(data.session_id);
    } finally {
      setLoading(false);
    }
  };

  const handleEndSession = async () => {
    if (!state.sessionId) return;
    await fetch(`/session/${state.sessionId}/end`, { method: "POST" });
  };

  if (state.status === "idle") {
    return <SessionSetup onSubmit={handleSessionCreate} loading={loading} />;
  }

  return (
    <div className="grid grid-cols-2 gap-4 p-4 h-screen">
      <div className="flex flex-col gap-4 overflow-y-auto">
        <BandEventLog events={state.events} connected={state.connected} />
        <CoverageMapViz coverageMap={state.coverageMap} />
        <EvidencePortfolio events={state.events} decision={state.decision} />
        {state.status === "active" && (
          <button
            onClick={handleEndSession}
            className="self-start px-4 py-2 rounded-lg bg-red-100 text-red-700 text-sm font-medium hover:bg-red-200"
          >
            End session
          </button>
        )}
      </div>
      <div className="flex items-center justify-center">
        <VoiceInterface
          events={state.events}
          onAudioReady={sendAudio}
          sessionStatus={state.status}
        />
      </div>
    </div>
  );
}
