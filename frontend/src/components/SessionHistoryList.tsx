import { useNavigate } from "react-router-dom";

interface SessionRow {
  id: string;
  candidate_name: string | null;
  status: string;
  created_at: number;
  violation_count: number;
}

export default function SessionHistoryList({
  sessions,
  onCreateNew,
}: {
  sessions: SessionRow[];
  onCreateNew: () => void;
}) {
  const navigate = useNavigate();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Session History</h2>
        <button
          onClick={onCreateNew}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + New Interview
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-gray-400 italic">No past sessions.</p>
          <p className="text-xs text-gray-300 mt-1">Create your first interview to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500 text-xs uppercase tracking-wide">
                <th className="py-3 pr-4">Date</th>
                <th className="py-3 pr-4">Candidate</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 text-right">Violations</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/history/${s.id}`)}
                >
                  <td className="py-3 pr-4 text-gray-600">
                    {s.created_at ? new Date(s.created_at * 1000).toLocaleDateString() : "—"}
                  </td>
                  <td className="py-3 pr-4 font-medium text-gray-800">
                    {s.candidate_name || "—"}
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      s.status === "completed" ? "bg-green-100 text-green-700"
                        : s.status === "ENDED" ? "bg-gray-100 text-gray-600"
                          : s.status === "READY" || s.status === "active" ? "bg-blue-100 text-blue-700"
                            : "bg-yellow-100 text-yellow-700"
                    }`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="py-3 text-right text-gray-600">{s.violation_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
