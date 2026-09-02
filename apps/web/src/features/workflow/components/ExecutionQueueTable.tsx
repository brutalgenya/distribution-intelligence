import clsx from "clsx";

import { formatDateTime } from "../../../lib/utils/format";
import {
  uiTableClassName,
  uiTableHeadClassName,
  uiTableRowClassName,
  uiTableShellClassName,
  uiTableWrapClassName,
} from "../../../components/ui/classes";
import { StatusChip } from "../../../components/ui/StatusChip";
import {
  formatExecutionStatus,
  formatExecutionTaskType,
  isRetryableStatus,
} from "../presentation";
import type { SupportExecutionTask } from "../types";

interface ExecutionQueueTableProps {
  tasks: SupportExecutionTask[];
  selectedExecutionTaskId: string | null;
  onSelect: (executionTaskId: string) => void;
}

export const ExecutionQueueTable = ({
  tasks,
  selectedExecutionTaskId,
  onSelect,
}: ExecutionQueueTableProps): JSX.Element => (
  <div className={uiTableShellClassName}>
    <div className={uiTableWrapClassName}>
      <table className={uiTableClassName}>
        <thead className={uiTableHeadClassName}>
          <tr>
            <th>Task</th>
            <th>Decision</th>
            <th>Status</th>
            <th>Type</th>
            <th>Target</th>
            <th>Requested by</th>
            <th>Updated</th>
            <th>Retry</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const isSelected = selectedExecutionTaskId === task.id;
            const tone =
              task.status === "succeeded"
                ? "success"
                : task.status === "failed" || task.status === "dead_lettered"
                  ? "danger"
                  : task.status === "running"
                    ? "info"
                    : task.status === "pending"
                      ? "warning"
                      : "neutral";

            return (
              <tr
                key={task.id}
                className={clsx(
                  `${uiTableRowClassName} cursor-pointer transition`,
                  isSelected && "bg-secondary/[0.04]",
                )}
                onClick={() => onSelect(task.id)}
              >
                <td className="px-4 py-3 align-top">
                  <div className="font-semibold text-ink">{task.id}</div>
                  <div className="mt-0.5 text-xs text-steel">{formatDateTime(task.createdAt)}</div>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="font-medium text-ink">{task.decisionId}</div>
                  <div className="mt-0.5 text-xs text-steel">{task.decision.decisionType}</div>
                </td>
                <td className="px-4 py-3 align-top">
                  <StatusChip tone={tone}>{formatExecutionStatus(task.status)}</StatusChip>
                </td>
                <td className="px-4 py-3 align-top text-sm text-ink">
                  {formatExecutionTaskType(task.taskType)}
                </td>
                <td className="px-4 py-3 align-top text-sm text-ink">{task.targetSystem}</td>
                <td className="px-4 py-3 align-top text-sm text-ink">
                  {task.requestedByUserId ?? "System-managed"}
                </td>
                <td className="px-4 py-3 align-top text-sm text-ink">{formatDateTime(task.updatedAt)}</td>
                <td className="px-4 py-3 align-top text-sm text-ink">
                  {isRetryableStatus(task.status) ? "Available" : "Not available"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);
