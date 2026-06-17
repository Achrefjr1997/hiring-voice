import { HTMLAttributes } from "react";
import logoPng from "../../assets/logo.png";

type LogoSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

interface LogoProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onClick'> {
  size?: LogoSize;
  withText?: boolean;
  textPosition?: "right" | "bottom";
  clickable?: boolean;
  animate?: "fade-in" | "pulse" | "spin" | "none";
  onClick?: () => void;
}

const sizeClasses: Record<LogoSize, string> = {
  xs: "w-8 h-8",    // 32px - Sidebar collapsed, Interview header
  sm: "w-12 h-12",  // 48px - Sidebar expanded, Email templates
  md: "w-16 h-16",  // 64px - Error pages, Loading screens
  lg: "w-20 h-20",  // 80px - Login page
  xl: "w-24 h-24",  // 96px - Completion screen
  "2xl": "w-32 h-32", // 128px - Extra large if needed
};

const animationClasses = {
  "fade-in": "animate-fade-in",
  "pulse": "animate-pulse-slow",
  "spin": "animate-spin-slow",
  "none": "",
};

export const Logo = ({
  size = "md",
  withText = false,
  textPosition = "right",
  clickable = false,
  animate = "none",
  className = "",
  onClick,
  ...props
}: LogoProps) => {
  const Wrapper = clickable ? "button" : "div";

  return (
    <Wrapper
      onClick={onClick}
      type={clickable ? "button" : undefined}
      className={`flex ${
        textPosition === "bottom" ? "flex-col items-center gap-2" : "items-center gap-3"
      } ${clickable ? "cursor-pointer hover:opacity-80 transition-opacity duration-200" : ""} ${className}`}
      {...props}
    >
      <img
        src={logoPng}
        alt="VoiceHire"
        className={`${sizeClasses[size]} ${animationClasses[animate]} object-contain`}
      />
      {withText && (
        <span className="font-heading text-h3 text-accent-gold tracking-wide">
          VoiceHire
        </span>
      )}
    </Wrapper>
  );
};
