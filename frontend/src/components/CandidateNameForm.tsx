import { useState } from "react";

export default function CandidateNameForm({
  onSubmit,
}: {
  onSubmit: (first: string, last: string) => Promise<void>;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim()) return;
    setLoading(true);
    try {
      await onSubmit(firstName.trim(), lastName.trim());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-8 flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-gray-800">Join Interview</h1>
      <p className="text-sm text-gray-500">Enter your name to begin the interview session.</p>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">First Name *</label>
        <input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="John"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Last Name *</label>
        <input
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Doe"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading || !firstName.trim() || !lastName.trim()}
        className="self-start px-6 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Joining…" : "Start Interview"}
      </button>
    </div>
  );
}
