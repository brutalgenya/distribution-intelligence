import clsx from "clsx";

interface SectionCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "default";
}

export const SectionCard = ({
  children,
  className,
  padding = "default",
}: SectionCardProps): JSX.Element => (
  <section
    className={clsx(
      "ui-panel animate-fade-in",
      padding === "none" && "!p-0",
      className,
    )}
  >
    {children}
  </section>
);
