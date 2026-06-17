import { useState } from "react";
import { Logo } from "./ui/Logo";

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
      {/* Logo */}
      <div className="flex justify-center">
        <Logo size="md" animate="fade-in" className="mb-2" />
      </div>

      {/* Heading */}
      <div className="text-center">
        <h1 className="text-3xl font-semibold text-gray-900 font-serif mb-3">Join Interview</h1>
        <p className="text-sm text-gray-600">Enter your name to begin the interview session.</p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold text-gray-700">First Name *</label>
        <input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="John"
          className="rounded-lg border-2 border-gray-200 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-accent-gold focus:border-accent-gold text-gray-900 placeholder:text-gray-400 transition-all"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold text-gray-700">Last Name *</label>
        <input
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Doe"
          className="rounded-lg border-2 border-gray-200 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-accent-gold focus:border-accent-gold text-gray-900 placeholder:text-gray-400 transition-all"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading || !firstName.trim() || !lastName.trim()}
        className="w-full px-6 py-3.5 rounded-lg bg-accent-gold text-gray-900 text-base font-semibold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md mt-2"
      >
        {loading ? "Joining\u2026" : "Start Interview"}
      </button>

      <p className="text-sm text-gray-500 text-center flex items-center justify-center gap-2">
        <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        Your session is secure and encrypted
      </p>
    </div>
  );
}
