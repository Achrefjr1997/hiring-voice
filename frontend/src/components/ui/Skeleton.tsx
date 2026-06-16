export default function Skeleton({
  width,
  height = 16,
  rounded = true,
  className = "",
}: {
  width?: string | number;
  height?: string | number;
  rounded?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`skeleton ${rounded ? "rounded-radius-card" : ""} ${className}`}
      style={{
        width: typeof width === "number" ? `${width}px` : width ?? "100%",
        height: typeof height === "number" ? `${height}px` : height,
      }}
    />
  );
}

export function SkeletonBlock({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? "60%" : "100%"} height={14} />
      ))}
    </div>
  );
}
