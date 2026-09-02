import { Link } from "react-router-dom";

import type { ActivationChecklistItem } from "../types";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusChip } from "../../../components/ui/StatusChip";
import { uiButtonSecondaryClassName } from "../../../components/ui/classes";

const statusTones: Record<ActivationChecklistItem["status"], "success" | "warning" | "danger"> = {
  complete: "success",
  attention: "warning",
  blocked: "danger",
};

const statusLabels: Record<ActivationChecklistItem["status"], string> = {
  complete: "Complete",
  attention: "Attention needed",
  blocked: "Blocked",
};

interface ActivationChecklistSectionProps {
  items: ActivationChecklistItem[];
}

export const ActivationChecklistSection = ({
  items,
}: ActivationChecklistSectionProps): JSX.Element => (
  <section className="space-y-4">
    <PageHeader
      label="Go-live checklist"
      title="Activation checklist"
      description="Each step is backed by real backend evidence and links into the workspace best suited to move the tenant forward."
    />

    <div className="space-y-4">
      {items.map((item) => (
        <SectionCard key={item.id}>
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-4">
                <h4 className="text-xl font-semibold tracking-tight text-ink">{item.title}</h4>
                <StatusChip tone={statusTones[item.status]}>
                  {statusLabels[item.status]}
                </StatusChip>
              </div>
              <p className="mt-3 text-sm font-semibold text-ink">{item.evidence}</p>
              <p className="mt-2 text-sm leading-relaxed text-steel">{item.helper}</p>
            </div>
            {item.href.startsWith("/") ? (
              <Link
                to={item.href}
                className={uiButtonSecondaryClassName}
              >
                {item.linkLabel}
              </Link>
            ) : (
               <a
                href={item.href}
                className={uiButtonSecondaryClassName}
              >
                {item.linkLabel}
              </a>
            )}
          </div>
        </SectionCard>
      ))}
    </div>
  </section>
);
