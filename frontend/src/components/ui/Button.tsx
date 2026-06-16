import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANT_STYLES: Record<Variant, string> = {
  primary: "bg-accent-gold text-text-on-accent hover:brightness-110 border border-accent-gold/50",
  secondary: "bg-surface-default text-text-secondary hover:text-text-primary hover:bg-surface-hover border border-border-default",
  ghost: "bg-transparent text-text-secondary hover:text-text-primary hover:bg-surface-hover border border-transparent",
  danger: "bg-status-alert/10 text-status-alert hover:bg-status-alert/20 border border-status-alert/30",
};

const SIZE_STYLES: Record<Size, string> = {
  sm: "px-2.5 py-1 text-caption",
  md: "px-4 py-2 text-body",
  lg: "px-6 py-3 text-body font-semibold",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  children,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-radius-card font-medium transition-all duration-150 
        ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]} 
        disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:none
        ${className}`}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : icon ? (
        <span className="w-4 h-4 shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}
