import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorNotice } from "../../../components/ui/ErrorNotice";
import { SkeletonBlock } from "../../../components/ui/SkeletonBlock";

interface CommandCenterEmptyStateProps {
  title: string;
  message: string;
}

interface CommandCenterErrorNoticeProps {
  title: string;
  message: string;
}

interface CommandCenterSectionSkeletonProps {
  rows?: number;
}

export const CommandCenterEmptyState = ({
  title,
  message,
}: CommandCenterEmptyStateProps): JSX.Element => (
  <EmptyState title={title} message={message} />
);

export const CommandCenterErrorNotice = ({
  title,
  message,
}: CommandCenterErrorNoticeProps): JSX.Element => (
  <ErrorNotice title={title} message={message} />
);

export const CommandCenterSectionSkeleton = ({
  rows = 4,
}: CommandCenterSectionSkeletonProps): JSX.Element => (
  <div className="ui-panel">
    <div className="h-5 w-48 ui-skeleton rounded-full" />
    <SkeletonBlock rows={rows} height="h-14" className="mt-4" />
  </div>
);
