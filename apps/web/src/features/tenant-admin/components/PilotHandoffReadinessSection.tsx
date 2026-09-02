import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusChip } from "../../../components/ui/StatusChip";
import { uiButtonSecondaryClassName } from "../../../components/ui/classes";
import type { PilotHandoffChecklistItem } from "../types";

const statusTones: Record<PilotHandoffChecklistItem["status"], "success" | "warning" | "danger"> = {
  complete: "success",
  attention: "warning",
  blocked: "danger",
};

const statusLabels: Record<PilotHandoffChecklistItem["status"], string> = {
  complete: "Complete",
  attention: "Attention needed",
  blocked: "Blocked",
};

interface PilotHandoffReadinessSectionProps {
  items: PilotHandoffChecklistItem[];
}

export const PilotHandoffReadinessSection = ({
  items,
}: PilotHandoffReadinessSectionProps): JSX.Element => (
  <section className="space-y-4">
    <PageHeader
      label="Pilot handoff"
      title="Pilot handoff readiness"
      description="This checklist stays transparent: each step is tied to direct backend evidence and links into the workspace best suited to resolve the gap."
    />

    <div className="space-y-4">
      {items.map((item) => (
        <SectionCard key={item.id}>
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-3">
                <h4 className="text-xl font-semibold tracking-tight text-ink">{item.title}</h4>
                <StatusChip tone={statusTones[item.status]}>
                  {statusLabels[item.status]}
                </StatusChip>
              </div>
              <p className="mt-3 text-sm font-medium text-ink">{item.evidence}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-steel">{item.helper}</p>
            </div>
            <div className="min-w-[140px] text-right">
               <a
                href={item.href}
                className={uiButtonSecondaryClassName}
              >
                {item.linkLabel}
              </a>
            </div>
          </div>
        </SectionCard>
      ))}
    </div>
  </section>
);
