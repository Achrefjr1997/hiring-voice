import { createContext, useContext, useState, ReactNode } from "react";

export type SidebarView = "interviews" | "candidates" | "recruitments" | "analytics";

interface SidebarContextValue {
  activeView: SidebarView;
  setActiveView: (view: SidebarView) => void;
  prefillResume: string;
  setPrefillResume: (resume: string) => void;
  prefillEmail: string;
  setPrefillEmail: (email: string) => void;
  navigateToView: "setup" | null;
  setNavigateToView: (v: "setup" | null) => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useState<SidebarView>("interviews");
  const [prefillResume, setPrefillResume] = useState("");
  const [prefillEmail, setPrefillEmail] = useState("");
  const [navigateToView, setNavigateToView] = useState<"setup" | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = () => setSidebarOpen((v) => !v);
  const closeSidebar = () => setSidebarOpen(false);
  return (
    <SidebarContext.Provider value={{ activeView, setActiveView, prefillResume, setPrefillResume, prefillEmail, setPrefillEmail, navigateToView, setNavigateToView, sidebarOpen, toggleSidebar, closeSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within <SidebarProvider>");
  return ctx;
}
