import { createContext, useContext, useState, ReactNode } from "react";

export type SidebarView = "interviews" | "candidates" | "recruitments" | "analytics";

interface SidebarContextValue {
  activeView: SidebarView;
  setActiveView: (view: SidebarView) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useState<SidebarView>("interviews");
  return (
    <SidebarContext.Provider value={{ activeView, setActiveView }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within <SidebarProvider>");
  return ctx;
}
