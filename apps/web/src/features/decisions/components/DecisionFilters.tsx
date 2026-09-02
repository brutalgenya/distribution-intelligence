import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusChip } from "../../../components/ui/StatusChip";
import { uiSelectClassName } from "../../../components/ui/classes";
import type { DecisionStatus, DecisionType } from "../types";
import { decisionStatusOptions, decisionTypeOptions } from "../types";

interface DecisionFiltersProps {
  decisionType: DecisionType | "all";
  status: DecisionStatus | "all";
  count: number;
  onDecisionTypeChange: (value: DecisionType | "all") => void;
  onStatusChange: (value: DecisionStatus | "all") => void;
}

export const DecisionFilters = ({
  decisionType,
  status,
  count,
  onDecisionTypeChange,
  onStatusChange,
}: DecisionFiltersProps): JSX.Element => (
  <SectionCard>
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <PageHeader
        label="Decision Filters"
        title="Recommendation queue"
        description="Filter the persisted decision inbox by decision type and current workflow status."
        actions={<StatusChip tone="info">{count} items</StatusChip>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[28rem]">
        <label className="block">
          <span className="ui-field-label mb-1.5 block">Decision type</span>
          <select
            className={uiSelectClassName}
            value={decisionType}
            onChange={(event) => onDecisionTypeChange(event.target.value as DecisionType | "all")}
          >
            {decisionTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="ui-field-label mb-1.5 block">Status</span>
          <select
            className={uiSelectClassName}
            value={status}
            onChange={(event) => onStatusChange(event.target.value as DecisionStatus | "all")}
          >
            {decisionStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  </SectionCard>
);
