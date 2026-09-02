import { formatLabel } from "../../lib/utils/format";
import type { ExecutionTaskStatus } from "./types";

export const formatExecutionTaskType = (value: string): string => formatLabel(value);

export const formatExecutionStatus = (value: string): string =>
  value === "dead_lettered" ? "Dead-lettered" : formatLabel(value);

export const formatTargetSystem = (value: string): string => formatLabel(value);

export const getExecutionStatusTone = (
  status: ExecutionTaskStatus,
): { backgroundClassName: string; textClassName: string } => {
  switch (status) {
    case "pending":
      return { backgroundClassName: "bg-sand/15", textClassName: "text-amber-700" };
    case "running":
      return { backgroundClassName: "bg-sky-100", textClassName: "text-sky-700" };
    case "succeeded":
      return { backgroundClassName: "bg-pine/15", textClassName: "text-pine" };
    case "failed":
      return { backgroundClassName: "bg-red-100", textClassName: "text-red-700" };
    case "dead_lettered":
      return { backgroundClassName: "bg-rose-100", textClassName: "text-rose-700" };
    case "cancelled":
      return { backgroundClassName: "bg-black/5", textClassName: "text-steel" };
  }
};

export const isRetryableStatus = (status: ExecutionTaskStatus): boolean =>
  status === "failed" || status === "dead_lettered";

export const isCancellableStatus = (status: ExecutionTaskStatus): boolean =>
  status === "pending" || status === "failed" || status === "dead_lettered";
