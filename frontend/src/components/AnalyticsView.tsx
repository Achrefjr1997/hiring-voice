import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthProvider";
import DateRangePicker from "./DateRangePicker";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from "recharts";

interface Stats {
  total_sessions: number;
  total_candidates: number;
  total_jobs: number;
  open_jobs: number;
  active_sessions: number;
  status_breakdown: Record<string, number>;
  completed_count: number;
  completion_rate: number;
  avg_duration_seconds: number;
  sessions_this_week: number;
}

interface TrendPoint {
  date: string;
  total: number;
  completed: number;
}

interface SessionRow {
  id: string;
  candidate_name: string | null;
  status: string;
  created_at: number | null;
  ended_at: number | null;
  job_id: string | null;
  duration_seconds: number | null;
  violation_count: number;
}

interface PaginatedSessions {
  sessions: SessionRow[];
  total: number;
  limit: number;
  offset: number;
}

const PIE_COLORS = ["#22c55e", "#eab308", "#ef4444", "#6b7280", "#3b82f6"];

const STATUS_LABELS: Record<string, string> = {
  READY: "Ready",
  active: "Active",
  completed: "Completed",
  ENDED: "Ended",
  CANDIDATE_FINISHED: "Finished",
};

function formatDuration(sec: number | null): string {
  if (sec === null || sec === undefined) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}m ${s}s`;
}

function formatDate(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function todayISO(): string {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export default function AnalyticsView() {
  const { token } = useAuth();
  const [startDate, setStartDate] = useState(daysAgoISO(30));
  const [endDate, setEndDate] = useState(todayISO());
  const [granularity, setGranularity] = useState<"day" | "week">("day");

  const [stats, setStats] = useState<Stats | null>(null);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [sessions, setSessions] = useState<PaginatedSessions | null>(null);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(10);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("start_date", startDate);
      if (endDate) params.set("end_date", endDate);

      const [statsRes, trendsRes, sessionsRes] = await Promise.all([
        fetch(`/stats?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/stats/trends?${params.toString()}&granularity=${granularity}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/sessions?${params.toString()}&limit=${perPage}&offset=${page * perPage}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (trendsRes.ok) setTrends(await trendsRes.json());
      if (sessionsRes.ok) setSessions(await sessionsRes.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token, startDate, endDate, granularity, page, perPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDateChange = (s: string, e: string) => {
    setStartDate(s);
    setEndDate(e);
    setPage(0);
  };

  const totalPages = sessions ? Math.ceil(sessions.total / perPage) : 0;

  const pieData = stats
    ? Object.entries(stats.status_breakdown)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => ({ name: STATUS_LABELS[k] || k, value: v }))
    : [];

  return (
    <div className="flex-1 overflow-y-auto">
      {/* ── Global Filter Bar ── */}
      <div className="sticky top-0 z-10 bg-surface-default border-b border-border-default px-4 lg:px-8 py-3 flex items-center justify-between flex-wrap gap-2">
        <DateRangePicker startDate={startDate} endDate={endDate} onChange={handleDateChange} />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setGranularity("day")}
            className={
              "px-3 py-1.5 text-[11px] rounded-radius-input border transition-colors " +
              (granularity === "day"
                ? "border-accent-gold text-accent-gold bg-accent-gold/10"
                : "border-border-default text-text-muted hover:text-text-primary")
            }
          >
            Daily
          </button>
          <button
            onClick={() => setGranularity("week")}
            className={
              "px-3 py-1.5 text-[11px] rounded-radius-input border transition-colors " +
              (granularity === "week"
                ? "border-accent-gold text-accent-gold bg-accent-gold/10"
                : "border-border-default text-text-muted hover:text-text-primary")
            }
          >
            Weekly
          </button>
        </div>
      </div>

      {loading && !stats ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-caption text-text-muted">Loading analytics…</p>
        </div>
      ) : (
        <div className="p-4 lg:p-8 space-y-8">
          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Total Interviews" value={stats?.total_sessions ?? 0} />
            <KpiCard label="Active Sessions" value={stats?.active_sessions ?? 0} />
            <KpiCard label="Total Candidates" value={stats?.total_candidates ?? 0} />
            <KpiCard label="Avg Duration" value={formatDuration(stats?.avg_duration_seconds ?? null)} />
            <KpiCard label="Completion Rate" value={stats ? `${(stats.completion_rate * 100).toFixed(1)}%` : "0%"} />
            <KpiCard label="Open Jobs" value={stats?.open_jobs ?? 0} />
            <KpiCard label="Total Jobs" value={stats?.total_jobs ?? 0} />
            <KpiCard label="This Week" value={stats?.sessions_this_week ?? 0} />
          </div>

          {/* ── Charts Row ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart — Status Breakdown */}
            <div className="bg-surface-default border border-border-default rounded-radius-card p-6">
              <h3 className="text-caption font-semibold text-text-secondary uppercase tracking-wider mb-4">Status Breakdown</h3>
              {pieData.length > 0 ? (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width={200} height={200}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" stroke="none">
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "#1a1a2e",
                          border: "1px solid #2a2a4a",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        itemStyle={{ color: "#e0e0e0" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {pieData.map((d, i) => (
                      <div key={d.name} className="flex items-center gap-2 text-[12px]">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-text-muted">{d.name}</span>
                        <span className="text-text-primary font-medium ml-auto">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-caption text-text-muted py-8 text-center">No data for selected period</p>
              )}
            </div>

            {/* Area Chart — Trend */}
            <div className="bg-surface-default border border-border-default rounded-radius-card p-6">
              <h3 className="text-caption font-semibold text-text-secondary uppercase tracking-wider mb-4">
                {granularity === "day" ? "Daily" : "Weekly"} Trend
              </h3>
              {trends.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={trends}>
                    <defs>
                      <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#eab308" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#888" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#888" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: "#1a1a2e", border: "1px solid #2a2a4a", borderRadius: 8, fontSize: 12 }}
                      itemStyle={{ color: "#e0e0e0" }}
                    />
                    <Area type="monotone" dataKey="total" stroke="#eab308" fill="url(#totalGrad)" strokeWidth={2} name="Total" />
                    <Area type="monotone" dataKey="completed" stroke="#22c55e" fill="url(#completedGrad)" strokeWidth={2} name="Completed" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-caption text-text-muted py-8 text-center">No trend data for selected period</p>
              )}
            </div>
          </div>

          {/* ── Sessions Table ── */}
          <div className="bg-surface-default border border-border-default rounded-radius-card">
            <div className="px-6 py-4 border-b border-border-default flex items-center justify-between">
              <h3 className="text-caption font-semibold text-text-secondary uppercase tracking-wider">Recent Sessions</h3>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-text-muted">Rows:</span>
                <select
                  value={perPage}
                  onChange={(e) => { setPerPage(Number(e.target.value)); setPage(0); }}
                  className="bg-surface-raised border border-border-default rounded-radius-input px-2 py-1 text-[11px] text-text-primary outline-none"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-border-default text-text-muted">
                    <th className="text-left px-6 py-3 font-medium">Candidate</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                    <th className="text-left px-4 py-3 font-medium">Duration</th>
                    <th className="text-left px-4 py-3 font-medium">Violations</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions?.sessions.map((s) => (
                    <tr key={s.id} className="border-b border-border-default/50 hover:bg-white/[0.02]">
                      <td className="px-6 py-3 text-text-primary">{s.candidate_name || "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="px-4 py-3 text-text-muted">{formatDate(s.created_at)}</td>
                      <td className="px-4 py-3 text-text-muted">{formatDuration(s.duration_seconds)}</td>
                      <td className="px-4 py-3">
                        <span className={s.violation_count > 0 ? "text-status-alert" : "text-text-muted"}>
                          {s.violation_count}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!sessions || sessions.sessions.length === 0) && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-text-muted">No sessions found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-3 border-t border-border-default flex items-center justify-between text-[12px]">
                <span className="text-text-muted">
                  Showing {page * perPage + 1}–{Math.min((page + 1) * perPage, sessions?.total || 0)} of {sessions?.total || 0}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                    className="px-2.5 py-1 rounded-radius-input border border-border-default text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Prev
                  </button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    const start = Math.max(0, Math.min(page - 3, totalPages - 7));
                    const p = start + i;
                    if (p >= totalPages) return null;
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={
                          "px-2.5 py-1 rounded-radius-input border transition-colors " +
                          (p === page
                            ? "border-accent-gold text-accent-gold bg-accent-gold/10"
                            : "border-border-default text-text-muted hover:text-text-primary")
                        }
                      >
                        {p + 1}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                    disabled={page >= totalPages - 1}
                    className="px-2.5 py-1 rounded-radius-input border border-border-default text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ── */

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface-default border border-border-default rounded-radius-card px-5 py-4">
      <p className="text-[11px] text-text-muted uppercase tracking-wider mb-1">{label}</p>
      <p className="text-h2 font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { cls: string; label: string }> = {
    READY: { cls: "bg-status-warning/15 text-status-warning", label: "Ready" },
    active: { cls: "bg-status-live/15 text-status-live", label: "Active" },
    completed: { cls: "bg-status-live/15 text-status-live", label: "Completed" },
    ENDED: { cls: "bg-status-alert/15 text-status-alert", label: "Ended" },
    CANDIDATE_FINISHED: { cls: "bg-accent-gold/15 text-accent-gold", label: "Finished" },
  };
  const c = cfg[status] || { cls: "bg-white/[0.06] text-text-muted", label: status };
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-radius-pill ${c.cls}`}>
      {c.label}
    </span>
  );
}
