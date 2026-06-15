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

  const handleSessionCreate = async (jd: string, resume: string, rubric: string, duration: string) => {
    setLoading(true);
    try {
      const res = await fetch("/session/create", {
        method: "POST",
        body: new URLSearchParams({ jd, resume, rubric, role_level: "senior", duration_minutes: duration }),
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

  return (
    <div className="flex flex-col gap-4 p-4 max-w-3xl mx-auto h-screen overflow-y-auto">
        <SessionInfo
          sessionLink={sessionLink}
          candidateName={state.candidateName}
          candidateStatus={state.candidateStatus}
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
