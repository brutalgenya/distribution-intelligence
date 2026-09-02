import { formatDateTime, formatNumber } from "../../../lib/utils/format";
import type { SupportActionFeedback, WorkerStatus } from "../types";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { DataField } from "../../../components/ui/DataField";
import { EmptyState } from "../../../components/ui/EmptyState";

interface SupportFeedbackSectionProps {
  feedbacks: SupportActionFeedback[];
  workerStatuses: WorkerStatus[];
}

const feedbackToneClassNames: Record<SupportActionFeedback["tone"], string> = {
  success: "border-emerald-200/50 bg-emerald-50/50 text-emerald-800",
  error: "border-rose-200/50 bg-rose-50/50 text-rose-800",
  info: "border-slate-200/60 bg-slate-50 text-ink",
};

export const SupportFeedbackSection = ({
  feedbacks,
  workerStatuses,
}: SupportFeedbackSectionProps): JSX.Element => (
  <section className="space-y-4 w-full flex flex-col items-stretch">
    <PageHeader
      label="Feedback and diagnostics"
      title="Support diagnostics and feedback"
      description="Review the latest action results and current worker health after you trigger a remediation step."
    />

    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-1">
      <SectionCard>
        <p className="ui-section-label mb-1">Latest action results</p>
        <h4 className="text-xl font-semibold tracking-tight text-ink mb-5">Mutation feedback</h4>

        {feedbacks.length > 0 ? (
          <div className="space-y-3">
            {feedbacks.map((feedback) => (
              <div
                key={feedback.id}
                className={`rounded-radius-md border px-4 py-4 shadow-sm ${feedbackToneClassNames[feedback.tone]}`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold">{feedback.title}</p>
                    <p className="mt-2 text-sm leading-relaxed opacity-90">{feedback.message}</p>
                  </div>
                  <p className="text-xs uppercase font-bold tracking-widest opacity-60 whitespace-nowrap sm:mt-0.5">{formatDateTime(feedback.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
           <div className="bg-slate-50 rounded-radius-md p-6 border border-slate-200/60 shadow-sm text-center">
              <EmptyState title="No recent mutations" message="No support mutations have been triggered in this session yet." />
           </div>
        )}
      </SectionCard>

      <SectionCard>
        <p className="ui-section-label mb-1">Worker health</p>
        <h4 className="text-xl font-semibold tracking-tight text-ink mb-5">Operational diagnostics</h4>

        {workerStatuses.length > 0 ? (
          <div className="space-y-4">
            {workerStatuses.map((workerStatus) => (
              <div key={workerStatus.workerType} className="rounded-radius-md bg-slate-50/50 px-5 py-5 border border-slate-100 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                  <div>
                    <p className="text-base font-semibold text-ink capitalize">{workerStatus.workerType} worker</p>
                    <p className="mt-1 text-sm text-steel">
                      Last run <span className="font-medium text-ink">{formatDateTime(workerStatus.lastRunAt)}</span> <span className="mx-1.5 opacity-40">·</span> Status <span className="font-medium text-ink">{workerStatus.lastStatus ?? "unknown"}</span>
                    </p>
                  </div>
                  <span className={`inline-flex items-center rounded-radius-sm px-2 py-0.5 text-xs font-semibold ${workerStatus.currentlyRunning ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-700"}`}>
                    {workerStatus.currentlyRunning ? "Running now" : "Idle"}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                   <div className="rounded-radius-md bg-white p-3 border border-slate-200/60">
                      <DataField label="Processed" value={<span className="text-lg font-bold tracking-tight text-ink">{formatNumber(workerStatus.recentProcessedCount)}</span>} />
                   </div>
                   <div className="rounded-radius-md bg-white p-3 border border-slate-200/60">
                      <DataField label="Failures" value={<span className="text-lg font-bold tracking-tight text-ink">{formatNumber(workerStatus.recentFailureCount)}</span>} />
                   </div>
                   <div className="rounded-radius-md bg-white p-3 border border-slate-200/60">
                      <DataField label="Retry backlog" value={<span className="text-lg font-bold tracking-tight text-ink">{formatNumber(workerStatus.retryBacklog)}</span>} />
                   </div>
                </div>

                {workerStatus.lastError ? (
                  <p className="mt-4 text-sm leading-relaxed text-rose-700 bg-rose-50/50 rounded-radius-md p-3 border border-rose-200/50">{workerStatus.lastError}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
           <div className="bg-slate-50 rounded-radius-md p-6 border border-slate-200/60 shadow-sm text-center">
              <EmptyState title="No worker diagnostics" message="Worker diagnostics are not currently exposed for this tenant session." />
           </div>
        )}
      </SectionCard>
    </div>
  </section>
);
