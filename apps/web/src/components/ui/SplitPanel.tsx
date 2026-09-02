import clsx from "clsx";

interface SplitPanelProps {
  primary: React.ReactNode;
  secondary: React.ReactNode;
  className?: string;
  secondarySticky?: boolean;
  collapseAt?: "xl" | "2xl";
}

export const SplitPanel = ({
  primary,
  secondary,
  className,
  secondarySticky = true,
  collapseAt = "xl",
}: SplitPanelProps): JSX.Element => (
  <div
    className={clsx(
      "grid items-start gap-6",
      collapseAt === "2xl"
        ? "2xl:grid-cols-[minmax(0,1.12fr)_minmax(22rem,0.88fr)]"
        : "xl:grid-cols-[minmax(0,1.18fr)_minmax(20rem,0.82fr)]",
      className,
    )}
  >
    <div className="min-w-0">{primary}</div>
    <div
      className={clsx(
        "min-w-0",
        secondarySticky &&
          (collapseAt === "2xl"
            ? "2xl:sticky 2xl:top-28 2xl:self-start"
            : "xl:sticky xl:top-28 xl:self-start"),
      )}
    >
      {secondary}
    </div>
  </div>
);
