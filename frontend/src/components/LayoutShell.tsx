import { useNavigate, useLocation } from "react-router-dom";
import { SidebarProvider, useSidebar } from "./SidebarContext";
import RecruiterSidebar from "./RecruiterSidebar";
import { Logo } from "./ui/Logo";
import { Menu } from "lucide-react";

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { activeView, setActiveView } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();

  const handleViewChange = (view: string) => {
    setActiveView(view as any);
    if (location.pathname !== "/") {
      navigate("/");
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      <RecruiterSidebar activeView={activeView} onViewChange={handleViewChange} />
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}

function LayoutHeader() {
  const { toggleSidebar } = useSidebar();
  return (
    <header className="h-12 border-b border-border-default flex items-center justify-between px-4 lg:px-6 shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="lg:hidden p-1.5 text-text-muted hover:text-text-primary -ml-1 transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu size={20} />
        </button>
        <Logo size="xs" className="w-7 h-7" />
        <span className="font-heading text-h3 text-accent-gold tracking-wide">
          VoiceHire
        </span>
        <span className="text-caption text-text-muted border-l border-border-default pl-3 ml-3 leading-none hidden sm:block">
          recruiter
        </span>
      </div>
    </header>
  );
}

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="h-screen bg-bg-primary flex flex-col">
        <LayoutHeader />
        <LayoutContent>{children}</LayoutContent>
      </div>
    </SidebarProvider>
  );
}
