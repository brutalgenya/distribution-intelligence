import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorNotice } from "../../../components/ui/ErrorNotice";
import { SkeletonBlock } from "../../../components/ui/SkeletonBlock";
import { SectionCard } from "../../../components/ui/SectionCard";

export const SupportActionsEmptyState = ({
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

export const SupportActionsErrorNotice = ({
  title,
  message,
}: {
  title: string;
  message: string;
}): JSX.Element => (
  <ErrorNotice title={title} message={message} />
);

export const SupportActionsSectionSkeleton = ({
  rows = 4,
}: {
  rows?: number;
}): JSX.Element => (
  <SectionCard>
    <div className="mb-6 h-6 w-60 animate-pulse rounded-radius-full bg-slate-200" />
    <SkeletonBlock rows={rows} height="h-16" />
  </SectionCard>
);

export const UnsupportedActionNotice = ({
  title,
  message,
}: {
  title: string;
  message: string;
}): JSX.Element => (
  <div className="rounded-radius-md border border-slate-200/60 bg-slate-50 px-4 py-4 text-sm text-steel">
    <p className="font-semibold text-ink">{title}</p>
    <p className="mt-2 leading-relaxed">{message}</p>
  </div>
);
