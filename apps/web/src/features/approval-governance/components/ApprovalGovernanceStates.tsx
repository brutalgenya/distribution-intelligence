import type { ApprovalGovernanceFeedback } from "../types";

export const ApprovalGovernanceSectionSkeleton = ({
  rows = 4,
}: {
  rows?: number;
}): JSX.Element => (
  <div className="space-y-4">
    {Array.from({ length: rows }).map((_, index) => (
      <div
        key={`approval-governance-skeleton-${index}`}
        className="h-36 animate-pulse rounded-[28px] bg-black/6"
      />
    ))}
  </div>
);

export const ApprovalGovernanceEmptyState = ({
  title,
  message,
}: {
  title: string;
  message: string;
}): JSX.Element => (
  <div className="rounded-[28px] border border-dashed border-black/10 bg-white px-6 py-10 text-center shadow-panel">
    <h3 className="text-xl font-semibold text-ink">{title}</h3>
    <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-steel">{message}</p>
  </div>
);

export const ApprovalGovernanceErrorNotice = ({
  title,
  message,
}: {
  title: string;
  message: string;
}): JSX.Element => (
  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
    <p className="font-semibold">{title}</p>
    <p className="mt-1">{message}</p>
  </div>
);

export const ApprovalGovernanceFeedbackNotice = ({
  feedback,
}: {
  feedback: ApprovalGovernanceFeedback;
}): JSX.Element => {
  const toneClassName =
    feedback.tone === "success"
      ? "border-pine/20 bg-pine/10 text-pine"
      : feedback.tone === "error"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-black/10 bg-mist text-steel";

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${toneClassName}`}>
      <p className="font-semibold">{feedback.title}</p>
      <p className="mt-1">{feedback.message}</p>
    </div>
  );
};
