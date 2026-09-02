import type { TrendPoint } from "../types";

interface SparklineProps {
  series: TrendPoint[];
  strokeClassName?: string;
}

const DEFAULT_STROKE_CLASS = "stroke-pine";

const buildPointString = (series: TrendPoint[]): string => {
  if (series.length === 1) {
    return "4,18 116,18";
  }

  const values = series.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || 1;

  return series
    .map((point, index) => {
      const x = 4 + (index * 112) / Math.max(series.length - 1, 1);
      const normalizedY = (point.value - minValue) / valueRange;
      const y = 32 - normalizedY * 28;
      return `${x},${y}`;
    })
    .join(" ");
};

export const Sparkline = ({
  series,
  strokeClassName = DEFAULT_STROKE_CLASS,
}: SparklineProps): JSX.Element | null => {
  if (series.length === 0) {
    return null;
  }

  const points = buildPointString(series);

  return (
    <svg viewBox="0 0 120 36" className="h-10 w-full" preserveAspectRatio="none" aria-hidden="true">
      <polyline
        fill="none"
        points={points}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={strokeClassName}
      />
    </svg>
  );
};
