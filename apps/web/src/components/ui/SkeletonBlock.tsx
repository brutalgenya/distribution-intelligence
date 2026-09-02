import clsx from "clsx";

interface SkeletonBlockProps {
  rows?: number;
  height?: string;
  className?: string;
  variant?: "card" | "row" | "metric";
}

export const SkeletonBlock = ({
  rows = 1,
  height,
  className,
  variant = "card",
}: SkeletonBlockProps): JSX.Element => {
  const heightClass = height ?? (variant === "row" ? "h-14" : variant === "metric" ? "h-28" : "h-32");

  return (
    <div className={clsx("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={`skeleton-${index}`}
          className={clsx("ui-skeleton", heightClass)}
        />
      ))}
    </div>
  );
};
