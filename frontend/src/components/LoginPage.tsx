import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Email and password required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const endpoint = isRegister ? "/auth/register" : "/auth/login";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Authentication failed");
        return;
      }
      login(data.token, data.recruiter_id, data.email);
      navigate("/");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <h1 className="font-heading text-h1 text-accent-gold tracking-wide">
            VoiceHire
          </h1>
          <p className="text-caption text-text-muted mt-2">
            {isRegister ? "Create your account" : "Sign in to your account"}
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface-default border border-border-default rounded-radius-card p-6 space-y-5">
          {error && (
            <p className="text-caption text-status-alert bg-status-alert/10 border border-status-alert/30 px-3 py-2 rounded-radius-card">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-caption text-text-secondary font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full bg-bg-primary border border-border-default rounded-radius-card px-3 py-2 text-body text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-gold focus:border-accent-gold transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-caption text-text-secondary font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full bg-bg-primary border border-border-default rounded-radius-card px-3 py-2 text-body text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-gold focus:border-accent-gold transition-colors"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full px-4 py-2.5 rounded-radius-card bg-accent-gold text-bg-primary text-body font-semibold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {loading ? "Please wait…" : isRegister ? "Create Account" : "Sign In"}
          </button>

          <button
            onClick={() => { setIsRegister(!isRegister); setError(""); }}
            className="w-full text-caption text-accent-gold hover:text-accent-gold/80 transition-colors text-center"
          >
            {isRegister ? "Already have an account? Sign in" : "Don't have an account? Register"}
          </button>
        </div>
      </div>
    </div>
  );
}
