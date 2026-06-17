import { createContext, useContext, useState, ReactNode } from "react";

export type SidebarView = "interviews" | "candidates" | "recruitments" | "analytics";

interface SidebarContextValue {
  activeView: SidebarView;
  setActiveView: (view: SidebarView) => void;
  prefillResume: string;
  setPrefillResume: (resume: string) => void;
  navigateToView: "setup" | null;
  setNavigateToView: (v: "setup" | null) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useState<SidebarView>("interviews");
  const [prefillResume, setPrefillResume] = useState("");
  const [navigateToView, setNavigateToView] = useState<"setup" | null>(null);
  return (
    <SidebarContext.Provider value={{ activeView, setActiveView, prefillResume, setPrefillResume, navigateToView, setNavigateToView }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within <SidebarProvider>");
  return ctx;
}
