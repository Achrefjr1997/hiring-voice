import { useAuth } from "./AuthProvider";
import { useNavigate } from "react-router-dom";

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      {/* Top navigation bar */}
      <header className="h-12 border-b border-border-default flex items-center px-6 shrink-0">
        <span className="font-heading text-h3 text-accent-gold tracking-wide">
          VoiceHire
        </span>
        <span className="ml-3 text-caption text-text-muted border-l border-border-default pl-3 leading-none">
          recruiter
        </span>
        <div className="ml-auto flex items-center gap-3">
          {token && (
            <button
              onClick={() => { logout(); navigate("/login"); }}
              className="text-caption text-text-secondary hover:text-text-primary transition-colors"
            >
              Sign out
            </button>
          )}
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
