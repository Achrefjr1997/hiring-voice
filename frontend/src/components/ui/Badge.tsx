import type { ReactNode } from "react";

type BadgeVariant = "success" | "warning" | "error" | "info" | "neutral" | "gold";

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  success: "bg-status-live/10 text-status-live border-status-live/20",
  warning: "bg-status-warning/10 text-status-warning border-status-warning/20",
  error: "bg-status-alert/10 text-status-alert border-status-alert/20",
  info: "bg-status-info/10 text-status-info border-status-info/20",
  neutral: "bg-surface-raised text-text-muted border-border-default",
  gold: "bg-accent-gold/10 text-accent-gold border-accent-gold/20",
};

export default function Badge({
  variant = "neutral",
  children,
  className = "",
  dot,
}: {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-radius-card text-caption font-medium border ${VARIANT_STYLES[variant]} ${className}`}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
