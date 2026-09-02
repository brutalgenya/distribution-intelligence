import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorNotice } from "../../../components/ui/ErrorNotice";
import { PageIntro } from "../../../components/ui/PageIntro";
import { SkeletonBlock } from "../../../components/ui/SkeletonBlock";
import { StatusChip } from "../../../components/ui/StatusChip";
import { isApiError } from "../../../lib/api/errors";
import { AudienceSnapshotSection } from "../components/AudienceSnapshotSection";
import { GlobalHealthSection } from "../components/GlobalHealthSection";
import { NextBestActionsSection } from "../components/NextBestActionsSection";
import { RecentActivitySection } from "../components/RecentActivitySection";
import { RoleFocusSection } from "../components/RoleFocusSection";
import { useCommandCenterData } from "../hooks";

const getApiErrorMessage = (error: unknown, fallback: string): string =>
  isApiError(error) ? `${error.message} Correlation: ${error.correlationId}.` : fallback;

export const CommandCenterPage = (): JSX.Element => {
  const {
    viewModel,
    sessionConfigured,
    initialLoading,
    adminError,
    operatorError,
    buyerError,
    activityError,
  } = useCommandCenterData();

  if (!sessionConfigured) {
    return (
      <EmptyState
        title="Set demo session headers"
        message="Paste the seeded demo user id and organization id into the session panel above to load the command center."
      />
    );
  }

  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Overview"
        title="Command Center"
        description={viewModel.roleFocus.helper}
        actions={
          <>
            <StatusChip tone="info">{viewModel.roleFocus.currentRoleLabel}</StatusChip>
            <StatusChip tone="neutral">{viewModel.globalSummary.title}</StatusChip>
          </>
        }
      />

      {initialLoading ? (
        <SkeletonBlock rows={3} height="h-28" />
      ) : (
        <GlobalHealthSection summary={viewModel.globalSummary} />
      )}

      <RoleFocusSection roleFocus={viewModel.roleFocus} />

      {adminError ? (
        <ErrorNotice
          title="Admin signals unavailable"
          message={getApiErrorMessage(adminError, "One or more activation or governance queries failed.")}
        />
      ) : null}

      {operatorError ? (
        <ErrorNotice
          title="Operator signals unavailable"
          message={getApiErrorMessage(operatorError, "One or more risk or workflow queries failed.")}
        />
      ) : null}

      {buyerError ? (
        <ErrorNotice
          title="Buyer signals unavailable"
          message={getApiErrorMessage(buyerError, "One or more supply queries failed.")}
        />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.02fr)_minmax(22rem,0.98fr)]">
        <NextBestActionsSection actions={viewModel.nextBestActions} />

        {activityError ? (
          <ErrorNotice
            title="Recent activity unavailable"
            message={getApiErrorMessage(activityError, "One or more activity inputs failed to load.")}
          />
        ) : (
          <RecentActivitySection items={viewModel.recentActivity} />
        )}
      </div>

      <div className="grid gap-6">
        {viewModel.orderedSnapshots.map((snapshot) => (
          <AudienceSnapshotSection key={snapshot.key} snapshot={snapshot} />
        ))}
      </div>
    </div>
  );
};
