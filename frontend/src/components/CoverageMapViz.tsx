import { AlertTriangle, CheckCircle, Circle } from "lucide-react";
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
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-radius-card border text-caption transition-colors ${STATUS_STYLES[cell.status] ?? "bg-surface-raised"}`}
                  >
                    <Icon size={14} className={`shrink-0 ${statusColor}`} />
                    <span className="flex-1 font-medium text-text-primary truncate">
                      {cell.name}
                    </span>
                    {cell.classification === "MUST_HAVE" && (
                      <span className="text-[9px] font-semibold text-accent-gold bg-accent-gold/10 px-1.5 py-0.5 rounded-radius-card shrink-0">
                        M
                      </span>
                    )}
                    <div className="w-14 h-1.5 bg-surface-raised rounded-full overflow-hidden shrink-0">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          cell.status === "COVERED" ? "bg-status-live"
                            : cell.status === "WEAK" ? "bg-status-warning"
                              : "bg-border-default"
                        }`}
                        style={{ width: `${confidencePct}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-text-muted w-6 text-right shrink-0">
                      {confidencePct}%
                    </span>
                    {cell.integrityFlagged && (
                      <AlertTriangle size={12} className="text-status-alert shrink-0" />
                    )}
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
