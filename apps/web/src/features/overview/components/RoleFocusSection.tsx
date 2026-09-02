import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusChip } from "../../../components/ui/StatusChip";
import type { CommandCenterAudienceKey, CommandCenterRoleFocus } from "../types";

const audienceLabels: Record<CommandCenterAudienceKey, string> = {
  admin: "Admin",
  operator: "Operator",
  buyer: "Buyer",
};

interface RoleFocusSectionProps {
  roleFocus: CommandCenterRoleFocus;
}

export const RoleFocusSection = ({
  roleFocus,
}: RoleFocusSectionProps): JSX.Element => (
  <SectionCard className="ui-panel-glass !p-5">
    <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
      <div className="max-w-3xl">
        <p className="ui-section-label">Role Emphasis</p>
        <h3 className="mt-2 text-subheading text-ink">{roleFocus.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-steel">{roleFocus.helper}</p>
      </div>

      <div className="rounded-radius-md bg-white/82 px-4 py-3 shadow-sm ring-1 ring-slate-200/70">
        <p className="ui-field-label">Current session role</p>
        <p className="ui-field-value">{roleFocus.currentRoleLabel}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {roleFocus.orderedAudiences.map((audience, index) => (
            <StatusChip key={audience} tone={index === 0 ? "info" : "neutral"}>
              {index === 0 ? `Primary ${audienceLabels[audience]}` : audienceLabels[audience]}
            </StatusChip>
          ))}
        </div>
      </div>
    </div>
  </SectionCard>
);
