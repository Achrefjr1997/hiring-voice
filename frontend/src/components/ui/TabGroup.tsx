import { useState, type ReactNode } from "react";

interface Tab {
  id: string;
  label: string;
  content: ReactNode;
  badge?: string | number;
}

export default function TabGroup({
  tabs,
  defaultTab,
  className = "",
}: {
  tabs: Tab[];
  defaultTab?: string;
  className?: string;
}) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);

  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];
  if (!activeTab) return null;

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex border-b border-border-default">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-caption font-medium transition-colors border-b-2 -mb-[1px] 
              ${active === tab.id ? "border-accent-gold text-accent-gold" : "border-transparent text-text-muted hover:text-text-secondary"}`}
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span className={`px-1.5 py-0.5 rounded-radius-pill text-[10px] 
                ${active === tab.id ? "bg-accent-gold/10 text-accent-gold" : "bg-surface-raised text-text-muted"}`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="flex-1">
        {activeTab.content}
      </div>
    </div>
  );
}
