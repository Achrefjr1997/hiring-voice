import type { ReactNode, HTMLAttributes } from "react";

type CardVariant = "default" | "raised" | "cream";

const VARIANT_STYLES: Record<CardVariant, string> = {
  default: "bg-surface-default border border-border-default",
  raised: "bg-surface-raised border border-border-default",
  cream: "bg-surface-cream border border-border-cream",
};

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: boolean;
  children: ReactNode;
}

export default function Card({
  variant = "default",
  padding = true,
  children,
  className = "",
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-radius-card ${VARIANT_STYLES[variant]} ${padding ? "p-4" : ""} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
