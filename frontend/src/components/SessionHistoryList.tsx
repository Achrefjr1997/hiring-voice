import { useNavigate } from "react-router-dom";

interface SessionRow {
  id: string;
  candidate_name: string | null;
  status: string;
  created_at: number;
  violation_count: number;
}

const STATUS_BADGES: Record<string, string> = {
  completed: "bg-status-live/20 text-status-live border-status-live/30",
  ENDED: "bg-surface-raised text-text-muted border-border-default",
  READY: "bg-status-info/20 text-status-info border-status-info/30",
  active: "bg-status-info/20 text-status-info border-status-info/30",
};

export default function SessionHistoryList({
  sessions,
  onCreateNew,
}: {
  sessions: SessionRow[];
  onCreateNew?: () => void;
}) {
  const navigate = useNavigate();

  return (
    <div>
      {onCreateNew && (
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-h3 font-heading text-text-primary">Session History</h2>
          <button
            onClick={onCreateNew}
            className="px-4 py-2 rounded-radius-card bg-accent-gold text-bg-primary text-caption font-semibold hover:brightness-110 transition-all"
          >
            + New Interview
          </button>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="text-center py-16 bg-surface-default border border-border-default rounded-radius-card">
          <p className="text-body text-text-muted italic">No past sessions.</p>
          <p className="text-caption text-text-muted mt-1">Create your first interview to get started.</p>
        </div>
      ) : (
        <div className="bg-surface-default border border-border-default rounded-radius-card overflow-hidden">
          <table className="w-full text-body">
            <thead>
              <tr className="border-b border-border-default text-caption text-text-muted uppercase tracking-wide">
                <th className="py-3 px-4 text-left font-medium">Date</th>
                <th className="py-3 px-4 text-left font-medium">Candidate</th>
                <th className="py-3 px-4 text-left font-medium">Status</th>
                <th className="py-3 px-4 text-right font-medium">Violations</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-border-default hover:bg-surface-hover cursor-pointer transition-colors last:border-0"
                  onClick={() => navigate(`/report/${s.id}?back=history`)}
                >
                  <td className="py-4 px-4 text-text-secondary">
                    {s.created_at ? new Date(s.created_at * 1000).toLocaleDateString() : "—"}
                  </td>
                  <td className="py-4 px-4 font-medium text-text-primary">
                    {s.candidate_name || "—"}
                  </td>
                  <td className="py-4 px-4">
                    <span className={`inline-block px-2 py-0.5 rounded-radius-card text-caption font-medium border ${STATUS_BADGES[s.status] ?? "bg-surface-raised text-text-muted border-border-default"}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right text-text-secondary">{s.violation_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
