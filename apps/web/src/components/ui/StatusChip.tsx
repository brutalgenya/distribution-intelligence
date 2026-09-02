import clsx from "clsx";

type Tone = "success" | "warning" | "danger" | "neutral" | "info";

const toneClasses: Record<Tone, string> = {
  success: "ui-chip ui-chip-success",
  warning: "ui-chip ui-chip-warning",
  danger: "ui-chip ui-chip-danger",
  neutral: "ui-chip ui-chip-neutral",
  info: "ui-chip ui-chip-info",
};

interface StatusChipProps {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}

export const StatusChip = ({
  tone,
  children,
  className,
}: StatusChipProps): JSX.Element => (
  <span className={clsx(toneClasses[tone], className)}>{children}</span>
);
