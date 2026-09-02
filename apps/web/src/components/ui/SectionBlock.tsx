import clsx from "clsx";

import { PageHeader } from "./PageHeader";
import { SectionCard } from "./SectionCard";

interface SectionBlockProps {
  label?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "default";
}

export const SectionBlock = ({
  label,
  title,
  description,
  actions,
  children,
  className,
  padding = "default",
}: SectionBlockProps): JSX.Element => (
  <SectionCard className={clsx("space-y-5", className)} padding={padding}>
    <PageHeader label={label} title={title} description={description} actions={actions} />
    {children}
  </SectionCard>
);
