import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  uiButtonSecondaryClassName,
  uiPageStackClassName,
} from "../../../components/ui/classes";
import { PageIntro } from "../../../components/ui/PageIntro";
import { SplitPanel } from "../../../components/ui/SplitPanel";
import { StatusChip } from "../../../components/ui/StatusChip";
import { isApiError } from "../../../lib/api/errors";
import { useSession } from "../../session/SessionProvider";
import { AdministrativeAuditSection } from "../components/AdministrativeAuditSection";
import { MembershipsSection } from "../components/MembershipsSection";
import { OrganizationSettingsSection } from "../components/OrganizationSettingsSection";
import { OrganizationSummarySection } from "../components/OrganizationSummarySection";
import { PilotHandoffReadinessSection } from "../components/PilotHandoffReadinessSection";
import { RolesAccessSection } from "../components/RolesAccessSection";
import {
  TenantAdminEmptyState,
  TenantAdminErrorNotice,
  TenantAdminFeedbackNotice,
  TenantAdminSectionSkeleton,
} from "../components/TenantAdminStates";
import {
  useInviteOrganizationMemberMutation,
  useTenantApprovals,
  useTenantAuditTimeline,
  useTenantBillingEntitlements,
  useTenantBillingSubscription,
  useTenantDecisions,
  useTenantExecutions,
  useTenantFailedRecords,
  useTenantIntegrationConnections,
  useTenantIntegrationSyncRuns,
  useTenantMemberships,
  useTenantOrganizationEntitlements,
} from "../hooks";
import { readTenantAdminRouteParams } from "../route";
import {
  deriveAdministrativeAuditItems,
  deriveLatestEvidenceAt,
  deriveOrganizationSummary,
  derivePilotHandoffChecklist,
  deriveRoleCoverage,
  findCurrentMembership,
  findSelectedMembership,
  sortMemberships,
} from "../selectors";
import type { InviteMemberDraft, TenantAdminFeedback, TenantAdminRouteParams } from "../types";

const knownParams = ["membershipId"] as const;

const getApiErrorMessage = (error: unknown, fallback: string): string =>
  isApiError(error) ? `${error.message} Correlation: ${error.correlationId}.` : fallback;

const defaultInviteDraft: InviteMemberDraft = {
  email: "",
  role: "operator",
};

export const TenantAdminPage = (): JSX.Element => {
  const session = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const routeParams = useMemo(() => readTenantAdminRouteParams(searchParams), [searchParams]);

  const [inviteDraft, setInviteDraft] = useState<InviteMemberDraft>(defaultInviteDraft);
  const [feedback, setFeedback] = useState<TenantAdminFeedback | null>(null);

  const membershipsQuery = useTenantMemberships();
  const orgEntitlementsQuery = useTenantOrganizationEntitlements();
  const billingSubscriptionQuery = useTenantBillingSubscription();
  const billingEntitlementsQuery = useTenantBillingEntitlements();
  const connectionsQuery = useTenantIntegrationConnections();
  const syncRunsQuery = useTenantIntegrationSyncRuns();
  const failedRecordsQuery = useTenantFailedRecords();
  const decisionsQuery = useTenantDecisions();
  const approvalsQuery = useTenantApprovals();
  const executionsQuery = useTenantExecutions();
  const auditTimelineQuery = useTenantAuditTimeline();

  const inviteMutation = useInviteOrganizationMemberMutation();

  const memberships = useMemo(
    () => sortMemberships(membershipsQuery.data ?? []),
    [membershipsQuery.data],
  );
  const currentMembership = useMemo(
    () => findCurrentMembership(memberships, session.userId),
    [memberships, session.userId],
  );
  const selectedMembership = useMemo(
    () => findSelectedMembership(memberships, routeParams.membershipId, session.userId),
    [memberships, routeParams.membershipId, session.userId],
  );

  const organizationEntitlements = orgEntitlementsQuery.data ?? [];
  const subscription = billingSubscriptionQuery.data ?? null;
  const billingEntitlements = billingEntitlementsQuery.data ?? null;
  const connections = connectionsQuery.data ?? [];
  const syncRuns = syncRunsQuery.data ?? [];
  const failedRecords = failedRecordsQuery.data ?? [];
  const decisions = decisionsQuery.data ?? [];
  const approvals = approvalsQuery.data ?? [];
  const executions = executionsQuery.data ?? [];
  const auditTimeline = auditTimelineQuery.data ?? [];

  const summary = useMemo(
    () =>
      deriveOrganizationSummary({
        memberships,
        subscription,
        billingEntitlements,
        currentMembership,
      }),
    [billingEntitlements, currentMembership, memberships, subscription],
  );
  const roleCoverage = useMemo(() => deriveRoleCoverage(memberships), [memberships]);
  const checklist = useMemo(
    () =>
      derivePilotHandoffChecklist({
        memberships,
        subscription,
        connections,
        syncRuns,
        decisions,
        approvals,
        executions,
        failedRecords,
      }),
    [
      approvals,
      connections,
      decisions,
      executions,
      failedRecords,
      memberships,
      subscription,
      syncRuns,
    ],
  );
  const adminAuditItems = useMemo(
    () => deriveAdministrativeAuditItems(auditTimeline),
    [auditTimeline],
  );
  const latestEvidenceAt = useMemo(
    () =>
      deriveLatestEvidenceAt({
        memberships,
        entitlements: organizationEntitlements,
        subscription,
        connections,
        syncRuns,
        failedRecords,
        decisions,
        approvals,
        executions,
        auditTimeline,
      }),
    [
      approvals,
      auditTimeline,
      connections,
      decisions,
      executions,
      failedRecords,
      memberships,
      organizationEntitlements,
      subscription,
      syncRuns,
    ],
  );

  useEffect(() => {
    if (memberships.length === 0 || selectedMembership?.id === routeParams.membershipId) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams);
    knownParams.forEach((key) => {
      nextSearchParams.delete(key);
    });

    if (selectedMembership) {
      nextSearchParams.set("membershipId", selectedMembership.id);
    }

    setSearchParams(nextSearchParams, { replace: true });
  }, [memberships.length, routeParams.membershipId, searchParams, selectedMembership, setSearchParams]);

  const applyRouteParams = (nextParams: Partial<TenantAdminRouteParams>) => {
    const mergedParams: TenantAdminRouteParams = {
      membershipId: routeParams.membershipId,
      ...nextParams,
    };

    const nextSearchParams = new URLSearchParams(searchParams);
    knownParams.forEach((key) => {
      nextSearchParams.delete(key);
    });

    if (mergedParams.membershipId) {
      nextSearchParams.set("membershipId", mergedParams.membershipId);
    }

    setSearchParams(nextSearchParams, { replace: true });
  };

  const handleInviteFieldChange = <K extends keyof InviteMemberDraft>(
    field: K,
    value: InviteMemberDraft[K],
  ) => {
    setInviteDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleInvite = async (): Promise<void> => {
    if (inviteDraft.email.trim().length === 0) {
      setFeedback({
        tone: "error",
        title: "Email required",
        message: "Provide an email address before calling the real organization invitation endpoint.",
        createdAt: new Date().toISOString(),
      });
      return;
    }

    try {
      const result = await inviteMutation.mutateAsync({
        email: inviteDraft.email.trim(),
        role: inviteDraft.role,
      });

      setInviteDraft((current) => ({
        ...current,
        email: "",
      }));
      setFeedback({
        tone: "success",
        title: "Invitation created",
        message: `Created a ${result.status} invitation for ${result.email} as ${result.role}. The backend returned an invitation token, but this workspace intentionally does not display it.`,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        title: "Invitation failed",
        message: getApiErrorMessage(
          error,
          "The backend rejected the invitation request.",
        ),
        createdAt: new Date().toISOString(),
      });
    }
  };

  if (!session.isConfigured) {
    return (
      <TenantAdminEmptyState
        title="Set demo session headers"
        message="Paste the seeded demo user id and organization id into the session panel above. This workspace sends those values on every request to the real organization, billing, integration, decision, workflow, and support APIs."
      />
    );
  }

  const initialLoading =
    membershipsQuery.isLoading &&
    orgEntitlementsQuery.isLoading &&
    billingSubscriptionQuery.isLoading &&
    billingEntitlementsQuery.isLoading;

  return (
    <div className={uiPageStackClassName}>
      <PageIntro
        eyebrow="Tenant Admin"
        title="Organization readiness and access control"
        description="Operate the live tenant with clear ownership, entitlement visibility, and pilot handoff evidence rather than a generic profile-management surface."
        actions={
          <>
            <Link to="/activation" className={uiButtonSecondaryClassName}>
              Open activation
            </Link>
            <Link to="/policies" className={uiButtonSecondaryClassName}>
              Open policies
            </Link>
          </>
        }
        meta={
          <div className="flex flex-wrap gap-2">
            <StatusChip tone="info">{memberships.length} memberships</StatusChip>
            <StatusChip tone={currentMembership ? "success" : "warning"}>
              {currentMembership ? currentMembership.role : "No current role"}
            </StatusChip>
            <StatusChip tone={checklist.some((item) => item.status !== "complete") ? "warning" : "neutral"}>
              {checklist.length} handoff checks
            </StatusChip>
          </div>
        }
      />

      {initialLoading ? (
        <TenantAdminSectionSkeleton rows={4} />
      ) : (
        <OrganizationSummarySection
          summary={summary}
          organizationId={session.organizationId}
          currentMembership={currentMembership}
          latestEvidenceAt={latestEvidenceAt}
        />
      )}

      {feedback ? <TenantAdminFeedbackNotice feedback={feedback} /> : null}

      {membershipsQuery.isError || orgEntitlementsQuery.isError ? (
        <TenantAdminErrorNotice
          title="Organization admin data partially unavailable"
          message={getApiErrorMessage(
            membershipsQuery.error ?? orgEntitlementsQuery.error,
            "The memberships or org entitlement read model could not be loaded.",
          )}
        />
      ) : null}

      {billingSubscriptionQuery.isError || billingEntitlementsQuery.isError ? (
        <TenantAdminErrorNotice
          title="Commercial admin data partially unavailable"
          message={getApiErrorMessage(
            billingSubscriptionQuery.error ?? billingEntitlementsQuery.error,
            "The billing subscription or entitlement read model could not be loaded.",
          )}
        />
      ) : null}

      <SplitPanel
        secondarySticky={false}
        primary={
          <div className="space-y-6">
            <MembershipsSection
              memberships={memberships}
              selectedMembershipId={selectedMembership?.id ?? null}
              currentUserId={session.userId}
              onSelectMembership={(membershipId) => applyRouteParams({ membershipId })}
            />

            <OrganizationSettingsSection
              organizationEntitlements={organizationEntitlements}
              billingEntitlements={billingEntitlements}
            />
          </div>
        }
        secondary={
          <RolesAccessSection
            roleCoverage={roleCoverage}
            currentMembership={currentMembership}
            selectedMembership={selectedMembership}
            inviteDraft={inviteDraft}
            billingEntitlements={billingEntitlements}
            pending={inviteMutation.isPending}
            onInviteFieldChange={handleInviteFieldChange}
            onInvite={() => {
              void handleInvite();
            }}
          />
        }
      />

      {connectionsQuery.isError ||
      syncRunsQuery.isError ||
      failedRecordsQuery.isError ||
      decisionsQuery.isError ||
      approvalsQuery.isError ||
      executionsQuery.isError ? (
        <TenantAdminErrorNotice
          title="Pilot handoff evidence partially unavailable"
          message={getApiErrorMessage(
            connectionsQuery.error ??
              syncRunsQuery.error ??
              failedRecordsQuery.error ??
              decisionsQuery.error ??
              approvalsQuery.error ??
              executionsQuery.error,
            "One or more integration, decision, or workflow queries failed.",
          )}
        />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)]">
        <PilotHandoffReadinessSection items={checklist} />

        <div className="space-y-6">
          {auditTimelineQuery.isError ? (
            <TenantAdminErrorNotice
              title="Administrative audit timeline unavailable"
              message={getApiErrorMessage(
                auditTimelineQuery.error,
                "The support audit timeline could not be loaded.",
              )}
            />
          ) : null}

          <AdministrativeAuditSection items={adminAuditItems} />
        </div>
      </div>
    </div>
  );
};
