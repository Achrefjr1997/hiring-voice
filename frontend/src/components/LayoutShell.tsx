import { useNavigate, useLocation } from "react-router-dom";
import { SidebarProvider, useSidebar } from "./SidebarContext";
import RecruiterSidebar from "./RecruiterSidebar";

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

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="h-screen bg-bg-primary flex flex-col">
        {/* Thin top bar with brand */}
        <header className="h-12 border-b border-border-default flex items-center px-6 shrink-0">
          <span className="font-heading text-h3 text-accent-gold tracking-wide">
            VoiceHire
          </span>
          <span className="ml-3 text-caption text-text-muted border-l border-border-default pl-3 leading-none">
            recruiter
          </span>
        </header>

        {/* Sidebar + content row */}
        <LayoutContent>{children}</LayoutContent>
      </div>
    </SidebarProvider>
  );
}
