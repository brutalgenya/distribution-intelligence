import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusChip } from "../../../components/ui/StatusChip";
import {
  uiButtonSecondaryClassName,
  uiInputClassName,
  uiSelectClassName,
} from "../../../components/ui/classes";
import type { ExecutionTaskStatus, ExecutionTaskType } from "../types";
import { executionStatusOptions, executionTaskTypeOptions } from "../types";

interface ExecutionQueueFiltersProps {
  status: ExecutionTaskStatus | "all";
  taskType: ExecutionTaskType | "all";
  search: string;
  from: string;
  to: string;
  count: number;
  onStatusChange: (value: ExecutionTaskStatus | "all") => void;
  onTaskTypeChange: (value: ExecutionTaskType | "all") => void;
  onSearchChange: (value: string) => void;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onReset: () => void;
}

export const ExecutionQueueFilters = ({
  status,
  taskType,
  search,
  from,
  to,
  count,
  onStatusChange,
  onTaskTypeChange,
  onSearchChange,
  onFromChange,
  onToChange,
  onReset,
}: ExecutionQueueFiltersProps): JSX.Element => (
  <SectionCard>
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <PageHeader
          label="Queue Filters"
          title="Execution operations"
          description="Filter the backend queue by execution status, task type, search term, and request window."
          actions={<StatusChip tone="info">{count} tasks</StatusChip>}
        />
        <button type="button" onClick={onReset} className={`${uiButtonSecondaryClassName} xl:self-end`}>
          Reset filters
        </button>
      </div>

      <div className="grid gap-3 xl:grid-cols-5">
        <label className="block xl:col-span-2">
          <span className="ui-field-label mb-1.5 block">Search task id or decision id</span>
          <input
            className={uiInputClassName}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Filter current queue rows"
          />
        </label>

        <label className="block">
          <span className="ui-field-label mb-1.5 block">Status</span>
          <select
            className={uiSelectClassName}
            value={status}
            onChange={(event) => onStatusChange(event.target.value as ExecutionTaskStatus | "all")}
          >
            {executionStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="ui-field-label mb-1.5 block">Task type</span>
          <select
            className={uiSelectClassName}
            value={taskType}
            onChange={(event) => onTaskTypeChange(event.target.value as ExecutionTaskType | "all")}
          >
            {executionTaskTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
          <label className="block">
            <span className="ui-field-label mb-1.5 block">From date</span>
            <input
              type="date"
              className={uiInputClassName}
              value={from}
              onChange={(event) => onFromChange(event.target.value)}
            />
          </label>

          <label className="block">
            <span className="ui-field-label mb-1.5 block">To date</span>
            <input
              type="date"
              className={uiInputClassName}
              value={to}
              onChange={(event) => onToChange(event.target.value)}
            />
          </label>
        </div>
      </div>
    </div>
  </SectionCard>
);
