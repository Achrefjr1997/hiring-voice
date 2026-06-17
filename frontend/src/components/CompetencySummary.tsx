import type { CompetencySummaryItem } from "../types";

export default function CompetencySummary({
  competencies,
  estimatedDuration,
  onStart,
}: {
  competencies: CompetencySummaryItem[];
  estimatedDuration: string;
  onStart: () => void;
}) {
  const mustHaveCount = competencies.filter((c) => c.classification === "MUST_HAVE").length;
  const niceToHaveCount = competencies.length - mustHaveCount;

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-heading font-bold text-text-primary font-serif mb-2">Interview Overview</h1>
      <p className="text-body text-text-muted mb-6">
        This interview will assess the following competencies. Estimated duration:{" "}
        <strong className="text-accent-gold font-bold">{estimatedDuration}</strong>
      </p>

      <div className="flex gap-2 mb-6">
        <span className="text-caption px-2 py-1 rounded-radius-card border border-accent-gold text-accent-gold font-medium">
          {mustHaveCount} Required
        </span>
        <span className="text-caption px-2 py-1 rounded-radius-card bg-[#F5F2EB] text-text-muted font-medium">
          {niceToHaveCount} Good to explore
        </span>
      </div>

      <div className="space-y-3 mb-8">
        {competencies.map((comp, i) => (
          <div key={i} className="border border-border-default rounded-radius-card p-4 flex items-start gap-3 bg-surface-default">
            <span className="w-6 h-6 rounded-full bg-accent-gold/10 text-accent-gold flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-text-primary">{comp.name}</h3>
                  <p className="text-body text-text-muted">{comp.domain}</p>
                </div>
                <span
                  className={`shrink-0 text-caption px-2 py-0.5 rounded-radius-card font-medium ${
                    comp.classification === "MUST_HAVE"
                      ? "border border-accent-gold text-accent-gold"
                      : "bg-[#F5F2EB] text-text-muted"
                  }`}
                >
                  {comp.classification === "MUST_HAVE" ? "Required" : "Nice to have"}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onStart}
        className="w-full bg-accent-gold text-text-on-accent py-3 rounded-radius-card font-semibold hover:brightness-110 shadow-lg transition-all"
      >
        Start Interview
      </button>
    </div>
  );
}
