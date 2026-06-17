import { useAuth } from "./AuthProvider";
import { useNavigate } from "react-router-dom";
import { History, Users, Briefcase, BarChart3 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type SidebarView = "interviews" | "candidates" | "recruitments" | "analytics";

interface Props {
  activeView: SidebarView;
  onViewChange: (view: SidebarView) => void;
}

const NAV_ITEMS: { id: SidebarView; label: string; icon: LucideIcon }[] = [
  { id: "interviews", label: "Recent Interviews", icon: History },
  { id: "candidates", label: "Candidates & CVs", icon: Users },
  { id: "recruitments", label: "Active Recruitments", icon: Briefcase },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
];

export default function RecruiterSidebar({ activeView, onViewChange }: Props) {
  const { email, logout } = useAuth();
  const navigate = useNavigate();

  const initials = email
    ? email
        .split("@")[0]
        .split(".")
        .map((s) => s[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <aside className="w-[250px] min-w-[250px] bg-[#0A0A0A] border-r border-border-default flex flex-col h-full">
      <nav className="flex-1 py-4 pt-6">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={
                "w-full flex items-center gap-3 px-6 py-3 text-sm transition-all duration-150 border-l-2 text-left " +
                (isActive
                  ? "text-accent-gold border-l-accent-gold bg-accent-gold/[0.05] font-medium"
                  : "text-gray-300 border-l-transparent hover:text-white hover:bg-white/[0.02]")
              }
            >
              <Icon
                className={isActive ? "text-accent-gold" : "text-gray-400"}
                size={18}
                strokeWidth={2}
              />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="px-6 py-4 border-t border-border-default">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-radius-card bg-surface-hover flex items-center justify-center text-caption text-text-muted shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-caption font-medium text-text-primary truncate">
              {email?.split("@")[0] || "User"}
            </div>
            <div className="text-[11px] text-text-muted truncate">
              {email || ""}
            </div>
          </div>
          <button
            onClick={() => { logout(); navigate("/login"); }}
            className="text-xs text-gray-400 hover:text-status-alert transition-colors px-3 py-1.5 rounded-lg hover:bg-status-alert/10 shrink-0 font-medium"
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
