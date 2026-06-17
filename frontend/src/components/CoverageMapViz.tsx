import { AlertTriangle, CheckCircle, Circle, Target } from "lucide-react";
import type { CoverageMapState } from "../types";

const STATUS_STYLES: Record<string, string> = {
  COVERED: "bg-status-live/10 border-status-live/30",
  WEAK: "bg-status-warning/10 border-status-warning/30",
  UNEXPLORED: "bg-surface-raised border-border-default",
};

const STATUS_ICONS: Record<string, typeof Circle> = {
  COVERED: CheckCircle,
  WEAK: AlertTriangle,
  UNEXPLORED: Circle,
};

const STATUS_COLORS: Record<string, string> = {
  COVERED: "text-status-live",
  WEAK: "text-status-warning",
  UNEXPLORED: "text-text-muted",
};

export default function CoverageMapViz({
  coverageMap,
  summary,
}: {
  coverageMap: CoverageMapState;
  summary?: { total: number; covered: number; must_have_total: number; must_have_covered: number; all_must_haves_done: boolean };
}) {
  const entries = Object.entries(coverageMap);
  if (entries.length === 0) return null;

  const domains = new Map<string, typeof entries>();
  for (const [id, cell] of entries) {
    const group = domains.get(cell.domain) ?? [];
    group.push([id, cell]);
    domains.set(cell.domain, group);
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Summary header */}
      {summary && (
        <div className="flex items-center gap-2 px-1 pt-1">
          <span className="text-caption text-text-muted">
            {summary.must_have_covered}/{summary.must_have_total} required
          </span>
        </div>
      )}

      {/* Competency grid */}
      <div className="flex flex-col gap-3">
        {Array.from(domains.entries()).map(([domain, cells]) => (
          <div key={domain}>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1.5 px-1">
              {domain}
            </h3>
            <div className="flex flex-col gap-1.5">
              {cells.map(([id, cell]) => {
                const Icon = STATUS_ICONS[cell.status] ?? Circle;
                const statusColor = STATUS_COLORS[cell.status] ?? "text-text-muted";
                const confidencePct = Math.round(cell.confidence * 100);

                return (
                  <div
                    key={id}
                    className={`flex flex-col gap-2 px-3 py-2.5 rounded-lg border transition-all hover:shadow-sm ${STATUS_STYLES[cell.status] ?? "bg-surface-raised"}`}
                    title={cell.name}
                  >
                    {/* Header row with icon and name */}
                    <div className="flex items-center gap-2">
                      <Icon size={16} className={`shrink-0 ${statusColor}`} />
                      <span className="flex-1 font-medium text-sm text-text-primary truncate">
                        {cell.name}
                      </span>
                      {cell.classification === "MUST_HAVE" && (
                        <div className="flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-md bg-amber-100 border border-amber-300">
                          <Target size={12} className="text-amber-700" />
                          <span className="text-xs font-semibold text-amber-700">Required</span>
                        </div>
                      )}
                      {cell.integrityFlagged && (
                        <AlertTriangle size={14} className="text-status-alert shrink-0" />
                      )}
                    </div>

                    {/* Progress bar row */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            cell.status === "COVERED" ? "bg-green-500"
                              : cell.status === "WEAK" ? "bg-yellow-500"
                                : "bg-gray-300"
                          }`}
                          style={{ width: `${confidencePct}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-gray-700 w-10 text-right shrink-0">
                        {confidencePct}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
