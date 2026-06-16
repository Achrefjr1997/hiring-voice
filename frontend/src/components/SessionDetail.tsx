import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { FileText } from "lucide-react";
import ReportView from "./ReportView";

interface HistoryData {
  session: {
    id: string;
    candidate_name: string | null;
    status: string;
  };
  report: Record<string, unknown> | null;
}

export default function SessionDetail() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sessionId || !token) return;
    setLoading(true);
    setError("");
    fetch(`/session/${sessionId}/history`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (r.status === 401) { logout(); navigate("/login"); return null; }
        if (r.status === 404) { setError("not_found"); return null; }
        if (!r.ok) { setError("failed"); return null; }
        return r.json();
      })
      .then((d) => {
        if (d) setData(d);
        setLoading(false);
      })
      .catch(() => { setError("network"); setLoading(false); });
  }, [sessionId, token, navigate, logout]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-sm text-gray-400">Loading session report…</p>
      </div>
    );
  }

  if (error === "not_found" || (!loading && !data)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-8 text-center">
        <h2 className="text-xl font-semibold text-red-600">Session Not Found</h2>
        <p className="text-gray-600 mt-2">This session may have been deleted or you don't have access.</p>
        <button onClick={() => navigate("/")} className="mt-4 text-sm text-blue-600 hover:underline">
          Return to Session History
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-8 text-center">
        <h2 className="text-xl font-semibold text-red-600">Error Loading Session</h2>
        <p className="text-gray-600 mt-2">Could not load the session report. Please try again.</p>
        <button onClick={() => navigate("/")} className="mt-4 text-sm text-blue-600 hover:underline">
          Return to Session History
        </button>
      </div>
    );
  }

  const report = data?.report;

  if (!report) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <button onClick={() => navigate("/")} className="mb-4 text-sm text-blue-600 hover:text-blue-800">
          ← Back to Session History
        </button>
        <div className="max-w-3xl mx-auto text-center py-12">
          <h2 className="text-lg font-semibold text-gray-700">Report Not Available</h2>
          <p className="text-sm text-gray-500 mt-2">
            This session's report was not saved. The interview may still be in progress.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate("/")} className="text-sm text-blue-600 hover:text-blue-800">
            ← Back to Session History
          </button>
          <a
            href={`/session/${sessionId}/pdf`}
            target="_blank"
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            <FileText size={14} />
            Download PDF Report
          </a>
        </div>
        <ReportView
          sessionId={sessionId!}
          decision={null}
          deliberationFullText={null}
          onClose={() => navigate("/")}
          initialReport={report as any}
        />
      </div>
    </div>
  );
}
