import { formatDateTime, formatNumber } from "../../../lib/utils/format";
import { isApiError } from "../../../lib/api/errors";
import {
  uiButtonSecondaryClassName,
  uiErrorNoticeClassName,
  uiStatCardClassName,
} from "../../../components/ui/classes";
import type { WorkerStatus } from "../types";

interface ExecutionWorkerStatusCardProps {
  workerStatus: WorkerStatus | null;
  isLoading: boolean;
  error: unknown;
  onRefresh: () => void;
}

export const ExecutionWorkerStatusCard = ({
  workerStatus,
  isLoading,
  error,
  onRefresh,
}: ExecutionWorkerStatusCardProps): JSX.Element => (
  <section className="ui-panel">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-steel">Worker Diagnostics</p>
        <h3 className="mt-2 text-xl font-semibold text-ink">Execution worker health</h3>
        <p className="mt-1 text-sm text-steel">
          Support-backed status for execution processing, backlog, recent failures, and current worker state.
        </p>
      </div>

      <button
        type="button"
        onClick={onRefresh}
        className={uiButtonSecondaryClassName}
      >
        Refresh diagnostics
      </button>
    </div>

    {isLoading ? (
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={`worker-skeleton-${index}`} className="h-24 animate-pulse rounded-2xl bg-black/6" />
        ))}
      </div>
    ) : null}

    {!isLoading && error && isApiError(error) ? (
      <div className={`mt-4 ${uiErrorNoticeClassName}`}>
        <p className="font-semibold">Execution worker diagnostics failed to load</p>
        <p className="mt-1">
          {error.message} Correlation: {error.correlationId}.
        </p>
      </div>
    ) : null}

    {!isLoading && !error && workerStatus ? (
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className={uiStatCardClassName}>
          <p className="text-xs uppercase tracking-[0.14em] text-steel">Current state</p>
          <p className="mt-2 text-lg font-semibold text-ink">
            {workerStatus.currentlyRunning ? "Running" : workerStatus.lastStatus ?? "Unknown"}
          </p>
          <p className="mt-2 text-sm text-steel">Last run: {formatDateTime(workerStatus.lastRunAt)}</p>
        </div>
        <div className={uiStatCardClassName}>
          <p className="text-xs uppercase tracking-[0.14em] text-steel">Retry backlog</p>
          <p className="mt-2 text-lg font-semibold text-ink">{formatNumber(workerStatus.retryBacklog)}</p>
          <p className="mt-2 text-sm text-steel">Dead-lettered: {formatNumber(workerStatus.deadLetterCount)}</p>
        </div>
        <div className={uiStatCardClassName}>
          <p className="text-xs uppercase tracking-[0.14em] text-steel">Recent processed</p>
          <p className="mt-2 text-lg font-semibold text-ink">{formatNumber(workerStatus.recentProcessedCount)}</p>
          <p className="mt-2 text-sm text-steel">Failures: {formatNumber(workerStatus.recentFailureCount)}</p>
        </div>
        <div className={uiStatCardClassName}>
          <p className="text-xs uppercase tracking-[0.14em] text-steel">Last error</p>
          <p className="mt-2 text-sm leading-6 text-ink">
            {workerStatus.lastError ?? "No recent worker error recorded."}
          </p>
        </div>
      </div>
    ) : null}

    {!isLoading && !error && !workerStatus ? (
      <div className="mt-4 rounded-2xl border border-dashed border-slate-300/80 bg-white/70 px-4 py-4 text-sm text-steel">
        The support diagnostics endpoint is reachable, but it did not return an execution worker record yet.
      </div>
    ) : null}
  </section>
);
