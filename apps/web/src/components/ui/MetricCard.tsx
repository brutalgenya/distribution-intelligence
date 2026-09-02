import clsx from "clsx";

type MetricTone = "positive" | "critical" | "warning" | "neutral";

const toneClasses: Record<
  MetricTone,
  { accent: string; value: string; background: string }
> = {
  positive: {
    accent: "text-pine",
    value: "text-pine",
    background: "bg-[rgba(237,246,240,0.42)]",
  },
  critical: {
    accent: "text-ember",
    value: "text-ember",
    background: "bg-[rgba(255,241,239,0.56)]",
  },
  warning: {
    accent: "text-sand",
    value: "text-sand",
    background: "bg-[rgba(255,243,227,0.68)]",
  },
  neutral: {
    accent: "text-secondary",
    value: "text-ink",
    background: "bg-white",
  },
};

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  helper?: React.ReactNode;
  deltaLabel?: React.ReactNode | null;
  tone?: MetricTone;
  className?: string;
}

export const MetricCard = ({
  label,
  value,
  helper,
  deltaLabel,
  tone = "neutral",
  className,
}: MetricCardProps): JSX.Element => {
  const styles = toneClasses[tone];

  return (
    <article className={clsx("ui-metric-card", styles.background, className)}>
      <p className={clsx("ui-metric-label", styles.accent)}>{label}</p>
      <p className={clsx("ui-metric-value", styles.value)}>{value}</p>
      {deltaLabel ? (
        <p className={clsx("mt-2 text-xs font-semibold uppercase tracking-[0.16em]", styles.accent)}>
          {deltaLabel}
        </p>
      ) : null}
      {helper ? <p className="mt-4 text-sm leading-relaxed text-steel">{helper}</p> : null}
    </article>
  );
};
