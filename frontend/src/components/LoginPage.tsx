import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { Logo } from "./ui/Logo";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);

  // Handle Google OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const errorParam = params.get("error");

    if (errorParam === "oauth_failed") {
      setError("Google sign-in failed. Please try again.");
      window.history.replaceState({}, "", "/login");
      return;
    }

    if (token) {
      try {
        // Decode JWT to extract user_id and email
        const payload = JSON.parse(atob(token.split(".")[1]));

        // Call existing login function
        login(token, payload.sub, payload.email);

        // Clean URL
        window.history.replaceState({}, "", "/login");

        // Navigate to dashboard
        navigate("/");
      } catch (error) {
        console.error("Failed to process Google OAuth token:", error);
        setError("Failed to process login. Please try again.");
      }
    }
  }, [login, navigate]);

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
    <div className="min-h-screen bg-gradient-to-br from-bg-primary via-bg-primary to-[#131313] flex items-center justify-center p-4">
      <div className="w-full max-w-sm min-w-[320px]">
        {/* Brand */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <Logo size="sm" animate="fade-in" className="w-12 h-12" />
          <h1 className="font-heading text-h1 text-accent-gold tracking-wide">
            VoiceHire
          </h1>
        </div>

        {/* Card */}
        <div className="relative bg-gradient-to-br from-surface-default to-[#1C1C1C] border border-border-default border-t-2 border-t-accent-gold rounded-2xl p-8 shadow-2xl space-y-6">
          {error && (
            <div className="text-sm text-status-alert bg-status-alert/10 border border-status-alert/30 px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-sm text-text-secondary font-semibold">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <i className="ti ti-user text-text-muted text-lg"></i>
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full bg-bg-primary border border-border-default rounded-xl pl-11 pr-4 py-3 text-body text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold hover:bg-[#151515] transition-all duration-200"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm text-text-secondary font-semibold">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <i className="ti ti-lock text-text-muted text-lg"></i>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full bg-bg-primary border border-border-default rounded-xl pl-11 pr-4 py-3 text-body text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold hover:bg-[#151515] transition-all duration-200"
              />
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full px-4 py-3 rounded-xl bg-accent-gold text-bg-primary text-body font-semibold hover:brightness-110 hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0"
          >
            {loading ? "Please wait…" : isRegister ? "Create Account" : "Sign In"}
          </button>

          {/* Fine Divider Line */}
          <div className="w-full h-px bg-gray-700/50 my-5"></div>

          {/* Circular Google Button */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => window.location.href = "http://localhost:8000/auth/google/login"}
              className="w-12 h-12 rounded-full bg-white flex items-center justify-center hover:scale-105 transition-transform shadow-md border border-gray-200"
              aria-label="Sign in with Google"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </button>
          </div>

          <button
            onClick={() => { setIsRegister(!isRegister); setError(""); }}
            className="w-full text-sm text-accent-gold hover:text-accent-gold/80 hover:underline transition-all duration-200 text-center"
          >
            {isRegister ? "Already have an account? Sign in" : "Don't have an account? Register"}
          </button>
        </div>
      </div>
    </div>
  );
}
