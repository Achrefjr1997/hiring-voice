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
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Interview Overview</h1>
      <p className="text-gray-600 mb-6">
        This interview will assess the following competencies. Estimated duration:{" "}
        <strong>{estimatedDuration}</strong>
      </p>

      <div className="flex gap-2 mb-6">
        <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800 font-medium">
          {mustHaveCount} Required
        </span>
        <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 font-medium">
          {niceToHaveCount} Good to explore
        </span>
      </div>

      <div className="space-y-3 mb-8">
        {competencies.map((comp, i) => (
          <div key={i} className="border rounded-lg p-4 flex items-start gap-3">
            <span className="text-xs font-mono text-gray-400 mt-0.5 shrink-0">{i + 1}.</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-gray-900">{comp.name}</h3>
                  <p className="text-sm text-gray-500">{comp.domain}</p>
                </div>
                <span
                  className={`shrink-0 text-xs px-2 py-0.5 rounded font-medium ${
                    comp.classification === "MUST_HAVE"
                      ? "bg-red-100 text-red-800"
                      : "bg-gray-100 text-gray-600"
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
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
      >
        Start Interview
      </button>
    </div>
  );
}
