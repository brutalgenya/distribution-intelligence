import type { PolicyActionFeedback } from "../types";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorNotice } from "../../../components/ui/ErrorNotice";
import { SkeletonBlock } from "../../../components/ui/SkeletonBlock";

const feedbackClassNames: Record<PolicyActionFeedback["tone"], string> = {
  success: "border-teal-200/50 bg-teal-50/50 text-teal-800",
  error: "border-rose-200/50 bg-rose-50/50 text-rose-800",
  info: "border-sky-200/50 bg-sky-50/50 text-sky-800",
};

export const PolicyGovernanceEmptyState = ({
  title,
  message,
}: {
  title: string;
  message: string;
}): JSX.Element => (
  <div className="p-10">
    <EmptyState title={title} message={message} />
  </div>
);

export const PolicyGovernanceErrorNotice = ({
  title,
  message,
}: {
  title: string;
  message: string;
}): JSX.Element => (
  <ErrorNotice title={title} message={message} />
);

export const PolicyGovernanceSectionSkeleton = ({
  rows = 4,
}: {
  rows?: number;
}): JSX.Element => (
  <div className="ui-panel p-6">
    <div className="mb-6 h-6 w-60 animate-pulse rounded-radius-full bg-slate-200" />
    <SkeletonBlock rows={rows} height="h-16" />
  </div>
);

export const PolicyGovernanceFeedbackNotice = ({
  feedback,
}: {
  feedback: PolicyActionFeedback;
}): JSX.Element => (
  <div
    className={`rounded-radius-lg border px-5 py-4 shadow-sm ${feedbackClassNames[feedback.tone]}`}
  >
    <p className="text-sm font-semibold">{feedback.title}</p>
    <p className="mt-1.5 text-sm leading-relaxed opacity-90">{feedback.message}</p>
  </div>
);
