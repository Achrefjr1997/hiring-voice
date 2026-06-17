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
      <h1 className="text-heading font-semibold text-text-primary font-serif">Join Interview</h1>
      <p className="text-body text-text-muted">Enter your name to begin the interview session.</p>

      <div className="flex flex-col gap-1.5">
        <label className="text-caption font-medium text-text-secondary">First Name *</label>
        <input
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="John"
          className="rounded-radius-input border border-border-cream bg-[#F5F2EB] px-3 py-2 text-body focus:outline-none focus:ring-2 focus:ring-accent-gold/50 text-text-inverted placeholder:text-text-muted"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-caption font-medium text-text-secondary">Last Name *</label>
        <input
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Doe"
          className="rounded-radius-input border border-border-cream bg-[#F5F2EB] px-3 py-2 text-body focus:outline-none focus:ring-2 focus:ring-accent-gold/50 text-text-inverted placeholder:text-text-muted"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading || !firstName.trim() || !lastName.trim()}
        className="w-full px-6 py-2.5 rounded-radius-card bg-accent-gold text-text-on-accent text-body font-medium hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        {loading ? "Joining\u2026" : "Start Interview"}
      </button>

      <p className="text-caption text-text-muted text-center mt-1">🔒 Your session is secure and encrypted.</p>
    </div>
  );
}
