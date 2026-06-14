import { AlertTriangle, CheckCircle, Circle } from "lucide-react";
import type { CoverageMapState } from "../types";

const STATUS_STYLES: Record<string, string> = {
  COVERED: "bg-green-50 border-green-200",
  WEAK: "bg-amber-50 border-amber-200",
  UNEXPLORED: "bg-gray-50 border-gray-200",
};

const STATUS_ICONS: Record<string, typeof Circle> = {
  COVERED: CheckCircle,
  WEAK: AlertTriangle,
  UNEXPLORED: Circle,
};

const STATUS_COLORS: Record<string, string> = {
  COVERED: "text-green-500",
  WEAK: "text-amber-500",
  UNEXPLORED: "text-gray-300",
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
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100">
        <h2 className="text-sm font-medium text-gray-700 flex-1">Coverage Map</h2>
        {summary && (
          <span className="text-xs text-gray-500">
            {summary.must_have_covered}/{summary.must_have_total} MUST_HAVEs
          </span>
        )}
      </div>

      <div className="p-3 flex flex-col gap-3 max-h-72 overflow-y-auto">
        {Array.from(domains.entries()).map(([domain, cells]) => (
          <div key={domain}>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5 px-1">
              {domain}
            </h3>
            <div className="flex flex-col gap-1.5">
              {cells.map(([id, cell]) => {
                const Icon = STATUS_ICONS[cell.status] ?? Circle;
                const statusColor = STATUS_COLORS[cell.status] ?? "text-gray-300";
                const confidencePct = Math.round(cell.confidence * 100);

                return (
                  <div
                    key={id}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${STATUS_STYLES[cell.status] ?? "bg-gray-50"}`}
                  >
                    <Icon size={14} className={`shrink-0 ${statusColor}`} />
                    <span className="flex-1 font-medium text-gray-700 truncate">
                      {cell.name}
                    </span>
                    {cell.classification === "MUST_HAVE" && (
                      <span className="text-[9px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded shrink-0">
                        M
                      </span>
                    )}
                    <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden shrink-0">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          cell.status === "COVERED"
                            ? "bg-green-400"
                            : cell.status === "WEAK"
                              ? "bg-amber-400"
                              : "bg-gray-300"
                        }`}
                        style={{ width: `${confidencePct}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-gray-400 w-6 text-right shrink-0">
                      {confidencePct}%
                    </span>
                    {cell.integrityFlagged && (
                      <AlertTriangle size={12} className="text-red-400 shrink-0" />
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
