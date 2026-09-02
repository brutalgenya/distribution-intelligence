import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorNotice } from "../../../components/ui/ErrorNotice";
import { SkeletonBlock } from "../../../components/ui/SkeletonBlock";

export const InvestigationEmptyState = ({
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

export const InvestigationErrorNotice = ({
  title,
  message,
}: {
  title: string;
  message: string;
}): JSX.Element => <ErrorNotice title={title} message={message} />;

export const InvestigationSectionSkeleton = ({
  rows = 3,
}: {
  rows?: number;
}): JSX.Element => (
  <div className="ui-panel p-6">
    <div className="mb-6 h-6 w-56 animate-pulse rounded-radius-full bg-slate-200" />
    <SkeletonBlock rows={rows} height="h-24" />
  </div>
);
