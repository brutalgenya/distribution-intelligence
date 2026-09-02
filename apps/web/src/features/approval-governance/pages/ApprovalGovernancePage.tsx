import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { PageIntro } from "../../../components/ui/PageIntro";
import { SplitPanel } from "../../../components/ui/SplitPanel";
import { StatusChip } from "../../../components/ui/StatusChip";
import { uiButtonSecondaryClassName } from "../../../components/ui/classes";
import { isApiError } from "../../../lib/api/errors";
import { useSession } from "../../session/SessionProvider";
import { ActionConfirmationDialog } from "../../support-actions/components/ActionConfirmationDialog";
import { ApprovalOverrideDetailPanel } from "../components/ApprovalOverrideDetailPanel";
import { ApprovalGovernanceEmptyState, ApprovalGovernanceErrorNotice, ApprovalGovernanceFeedbackNotice, ApprovalGovernanceSectionSkeleton } from "../components/ApprovalGovernanceStates";
import { ApprovalQueueSection } from "../components/ApprovalQueueSection";
import { ExceptionPatternsSection } from "../components/ExceptionPatternsSection";
import { GovernanceAuditSection } from "../components/GovernanceAuditSection";
import { GovernanceFrictionSummarySection } from "../components/GovernanceFrictionSummarySection";
import { HumanInterventionSection } from "../components/HumanInterventionSection";
import {
  useApprovalGovernanceDecisionDetail,
  useApprovalGovernanceDecisionOutcomes,
  useApprovalGovernanceDecisions,
  useApprovalGovernanceExecutions,
  useApprovalGovernancePolicies,
  useApprovalGovernancePolicySummaries,
  useApprovalGovernanceTimeline,
  useApprovalTaskDetail,
  useApprovalTasks,
  useApproveGovernanceApprovalMutation,
  useOperatorOverrides,
  useRejectGovernanceApprovalMutation,
} from "../hooks";
import { readApprovalGovernanceRouteParams } from "../route";
import {
  buildApprovalRow,
  buildApprovalRows,
  deriveGovernanceAuditItems,
  deriveGovernanceFrictionSummary,
  deriveInterventionPatternRows,
  deriveLatestDecisionOutcome,
  deriveLatestGovernanceEvidenceAt,
  deriveOverrideRows,
  deriveRelatedExecutions,
  deriveSelectedOverrideRows,
  filterApprovalRows,
  filterOverrideRows,
} from "../selectors";
import type {
  ApprovalGovernanceFeedback,
  ApprovalGovernanceRouteParams,
  ApprovalRow,
} from "../types";

type ConfirmationState =
  | { kind: "approve"; approval: ApprovalRow }
  | { kind: "reject"; approval: ApprovalRow };

const knownParams = [
  "approvalTaskId",
  "decisionId",
  "policyId",
  "status",
  "decisionType",
  "overrideType",
] as const;

const isApprovalStatus = (
  value: string,
): value is ApprovalGovernanceRouteParams["status"] =>
  value === "all" ||
  value === "pending" ||
  value === "approved" ||
  value === "rejected" ||
  value === "cancelled";

const isDecisionType = (
  value: string,
): value is ApprovalGovernanceRouteParams["decisionType"] =>
  value === "all" ||
  value === "replenishment" ||
  value === "allocation" ||
  value === "exception";

const isOverrideType = (
  value: string,
): value is ApprovalGovernanceRouteParams["overrideType"] =>
  value === "all" ||
  value === "manual_approve" ||
  value === "manual_reject" ||
  value === "manual_cancel_execution" ||
  value === "manual_retry" ||
  value === "manual_close_exception" ||
  value === "manual_request_execution" ||
  value === "manual_request_approval";

const getApiErrorMessage = (error: unknown, fallback: string): string =>
  isApiError(error) ? `${error.message} Correlation: ${error.correlationId}.` : fallback;

export const ApprovalGovernancePage = (): JSX.Element => {
  const session = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const parsedRouteParams = useMemo(
    () => readApprovalGovernanceRouteParams(searchParams),
    [searchParams],
  );

  const routeParams = useMemo<ApprovalGovernanceRouteParams>(
    () => ({
      ...parsedRouteParams,
      status: isApprovalStatus(parsedRouteParams.status) ? parsedRouteParams.status : "all",
      decisionType: isDecisionType(parsedRouteParams.decisionType)
        ? parsedRouteParams.decisionType
        : "all",
      overrideType: isOverrideType(parsedRouteParams.overrideType)
        ? parsedRouteParams.overrideType
        : "all",
    }),
    [parsedRouteParams],
  );

  const [feedback, setFeedback] = useState<ApprovalGovernanceFeedback | null>(null);
  const [confirmationState, setConfirmationState] = useState<ConfirmationState | null>(null);

  const approvalsQuery = useApprovalTasks(
    useMemo(
      () => ({
        ...(routeParams.status !== "all" ? { status: routeParams.status } : {}),
      }),
      [routeParams.status],
    ),
  );
  const approvalDetailQuery = useApprovalTaskDetail(routeParams.approvalTaskId);
  const decisionsQuery = useApprovalGovernanceDecisions();
  const overridesQuery = useOperatorOverrides();
  const focusedOverridesQuery = useOperatorOverrides(
    useMemo(
      () => ({
        ...(routeParams.decisionId ? { decisionId: routeParams.decisionId } : {}),
        ...(routeParams.overrideType !== "all" ? { overrideType: routeParams.overrideType } : {}),
      }),
      [routeParams.decisionId, routeParams.overrideType],
    ),
  );
  const policiesQuery = useApprovalGovernancePolicies();
  const policySummariesQuery = useApprovalGovernancePolicySummaries();
  const executionsQuery = useApprovalGovernanceExecutions();

  const approvals = approvalsQuery.data ?? [];
  const decisions = decisionsQuery.data ?? [];
  const overrides = overridesQuery.data ?? [];
  const focusedOverrides = focusedOverridesQuery.data ?? overrides;
  const policies = policiesQuery.data ?? [];
  const policySummaries = policySummariesQuery.data ?? [];
  const executions = executionsQuery.data ?? [];

  const approvalRows = useMemo(
    () => buildApprovalRows(approvals, decisions, policies, overrides),
    [approvals, decisions, overrides, policies],
  );
  const filteredApprovalRows = useMemo(
    () =>
      filterApprovalRows(approvalRows, {
        decisionType: routeParams.decisionType,
        policyId: routeParams.policyId,
        decisionId: routeParams.decisionId,
      }),
    [approvalRows, routeParams.decisionId, routeParams.decisionType, routeParams.policyId],
  );
  const overrideRows = useMemo(
    () => deriveOverrideRows(overrides, decisions, policies, executions),
    [decisions, executions, overrides, policies],
  );
  const filteredOverrideRows = useMemo(
    () =>
      filterOverrideRows(
        deriveOverrideRows(focusedOverrides, decisions, policies, executions),
        {
          overrideType: routeParams.overrideType,
          decisionType: routeParams.decisionType,
          policyId: routeParams.policyId,
          decisionId: routeParams.decisionId,
        },
      ),
    [
      decisions,
      executions,
      focusedOverrides,
      routeParams.decisionId,
      routeParams.decisionType,
      routeParams.overrideType,
      routeParams.policyId,
      policies,
    ],
  );

  const selectedApprovalFromList =
    filteredApprovalRows.find((row) => row.id === routeParams.approvalTaskId) ??
    approvalRows.find((row) => row.id === routeParams.approvalTaskId) ??
    null;

  const selectedApproval =
    approvalDetailQuery.data !== undefined
      ? buildApprovalRow(approvalDetailQuery.data, decisions, policies, overrides)
      : selectedApprovalFromList;

  const selectedDecisionId =
    routeParams.decisionId ?? selectedApproval?.decisionId ?? selectedApprovalFromList?.decisionId ?? null;

  const decisionDetailQuery = useApprovalGovernanceDecisionDetail(selectedDecisionId);
  const selectedTimelineQuery = useApprovalGovernanceTimeline(selectedDecisionId);
  const globalTimelineQuery = useApprovalGovernanceTimeline(null);
  const decisionOutcomesQuery = useApprovalGovernanceDecisionOutcomes(selectedDecisionId);

  const selectedDecision =
    decisionDetailQuery.data ??
    selectedApproval?.decision ??
    decisions.find((decision) => decision.id === selectedDecisionId) ??
    null;
  const selectedPolicyId =
    routeParams.policyId ?? selectedDecision?.policyId ?? selectedApproval?.policy?.id ?? null;
  const selectedPolicy = policies.find((policy) => policy.id === selectedPolicyId) ?? null;
  const relatedExecutions = useMemo(
    () => deriveRelatedExecutions(executions, selectedDecision?.id ?? null),
    [executions, selectedDecision?.id],
  );
  const selectedOverrideRows = useMemo(
    () =>
      deriveSelectedOverrideRows(
        overrideRows,
        selectedDecision?.id ?? null,
        relatedExecutions.map((execution) => execution.id),
      ),
    [overrideRows, relatedExecutions, selectedDecision?.id],
  );
  const latestOutcome = useMemo(
    () => deriveLatestDecisionOutcome(decisionOutcomesQuery.data ?? []),
    [decisionOutcomesQuery.data],
  );
  const summary = useMemo(
    () =>
      deriveGovernanceFrictionSummary({
        approvals: approvalRows,
        overrides,
        policySummaries,
      }),
    [approvalRows, overrides, policySummaries],
  );
  const interventionPatterns = useMemo(
    () =>
      deriveInterventionPatternRows({
        policies,
        decisions,
        approvals: approvalRows,
        overrides: overrideRows,
        policySummaries,
      }),
    [approvalRows, decisions, overrideRows, policies, policySummaries],
  );
  const detailAuditItems = useMemo(
    () =>
      deriveGovernanceAuditItems(selectedTimelineQuery.data ?? [], {
        decisionId: selectedDecision?.id ?? null,
        policyId: selectedPolicyId,
      }),
    [selectedDecision?.id, selectedPolicyId, selectedTimelineQuery.data],
  );
  const governanceAuditItems = useMemo(
    () => deriveGovernanceAuditItems(globalTimelineQuery.data ?? []),
    [globalTimelineQuery.data],
  );
  const latestEvidenceAt = useMemo(
    () =>
      deriveLatestGovernanceEvidenceAt({
        approvals: approvalRows,
        overrides,
        policySummaries,
        auditTimeline: globalTimelineQuery.data ?? [],
        decisionOutcomes: decisionOutcomesQuery.data ?? [],
      }),
    [approvalRows, decisionOutcomesQuery.data, globalTimelineQuery.data, overrides, policySummaries],
  );

  const approveMutation = useApproveGovernanceApprovalMutation();
  const rejectMutation = useRejectGovernanceApprovalMutation();

  useEffect(() => {
    if (routeParams.approvalTaskId || routeParams.decisionId || filteredApprovalRows.length === 0) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("approvalTaskId", filteredApprovalRows[0].id);
    setSearchParams(nextParams, { replace: true });
  }, [
    filteredApprovalRows,
    routeParams.approvalTaskId,
    routeParams.decisionId,
    searchParams,
    setSearchParams,
  ]);

  const applyRouteParams = (nextParamsInput: Partial<ApprovalGovernanceRouteParams>) => {
    const nextParams = new URLSearchParams(searchParams);
    const mergedParams: ApprovalGovernanceRouteParams = {
      approvalTaskId: routeParams.approvalTaskId,
      decisionId: routeParams.decisionId,
      policyId: routeParams.policyId,
      status: routeParams.status,
      decisionType: routeParams.decisionType,
      overrideType: routeParams.overrideType,
      ...nextParamsInput,
    };

    knownParams.forEach((key) => nextParams.delete(key));

    if (mergedParams.approvalTaskId) {
      nextParams.set("approvalTaskId", mergedParams.approvalTaskId);
    }
    if (mergedParams.decisionId) {
      nextParams.set("decisionId", mergedParams.decisionId);
    }
    if (mergedParams.policyId) {
      nextParams.set("policyId", mergedParams.policyId);
    }
    if (mergedParams.status !== "all") {
      nextParams.set("status", mergedParams.status);
    }
    if (mergedParams.decisionType !== "all") {
      nextParams.set("decisionType", mergedParams.decisionType);
    }
    if (mergedParams.overrideType !== "all") {
      nextParams.set("overrideType", mergedParams.overrideType);
    }

    setSearchParams(nextParams, { replace: true });
  };

  const handleConfirmDialog = async (comment: string): Promise<void> => {
    if (!confirmationState) {
      return;
    }

    try {
      if (confirmationState.kind === "approve") {
        await approveMutation.mutateAsync({
          approvalTaskId: confirmationState.approval.id,
          ...(comment ? { comment } : {}),
        });
        setFeedback({
          tone: "success",
          title: "Approval recorded",
          message:
            "The backend approved the task, recorded the linked manual-approve override, and invalidated the related decision, workflow, policy, and outcomes queries.",
          createdAt: new Date().toISOString(),
        });
      } else {
        await rejectMutation.mutateAsync({
          approvalTaskId: confirmationState.approval.id,
          ...(comment ? { comment } : {}),
        });
        setFeedback({
          tone: "success",
          title: "Rejection recorded",
          message:
            "The backend rejected the task, recorded the linked manual-reject override, and refetched the related governance surfaces.",
          createdAt: new Date().toISOString(),
        });
      }

      setConfirmationState(null);
    } catch (error) {
      setFeedback({
        tone: "error",
        title:
          confirmationState.kind === "approve" ? "Approval action failed" : "Reject action failed",
        message: getApiErrorMessage(
          error,
          "The backend rejected the requested approval governance mutation.",
        ),
        createdAt: new Date().toISOString(),
      });
    }
  };

  if (!session.isConfigured) {
    return (
      <ApprovalGovernanceEmptyState
        title="Set demo session headers"
        message="Paste the seeded demo user id and organization id into the session panel above. This workspace sends those values on every request to the real workflow, decisioning, outcomes, and support APIs."
      />
    );
  }

  const initialLoading =
    approvalsQuery.isLoading &&
    decisionsQuery.isLoading &&
    overridesQuery.isLoading &&
    policiesQuery.isLoading &&
    policySummariesQuery.isLoading;

  return (
    <>
      <div className="page-stack">
        <PageIntro
          eyebrow="Approval Governance"
          title="Human intervention and approval friction"
          description="Monitor pending approvals, operator overrides, and decision-level evidence so human control remains explicit, auditable, and policy-bound."
          actions={
            <>
              <Link to="/policies" className={uiButtonSecondaryClassName}>
                Open policies
              </Link>
              <Link to="/workflow" className={uiButtonSecondaryClassName}>
                Open workflow
              </Link>
            </>
          }
          meta={
            <div className="flex flex-wrap gap-2">
              <StatusChip tone={approvalRows.some((row) => row.status === "pending") ? "warning" : "neutral"}>
                {approvalRows.filter((row) => row.status === "pending").length} pending approvals
              </StatusChip>
              <StatusChip tone={overrideRows.length > 0 ? "info" : "neutral"}>
                {overrideRows.length} override events
              </StatusChip>
              <StatusChip tone={filteredApprovalRows.length > 0 ? "info" : "neutral"}>
                {filteredApprovalRows.length} filtered tasks
              </StatusChip>
            </div>
          }
        />

        {initialLoading ? (
          <ApprovalGovernanceSectionSkeleton rows={4} />
        ) : (
          <GovernanceFrictionSummarySection
            summary={summary}
            latestEvidenceAt={latestEvidenceAt}
          />
        )}

        {feedback ? <ApprovalGovernanceFeedbackNotice feedback={feedback} /> : null}

        {approvalsQuery.isError ||
        decisionsQuery.isError ||
        overridesQuery.isError ||
        focusedOverridesQuery.isError ||
        policiesQuery.isError ||
        policySummariesQuery.isError ? (
          <ApprovalGovernanceErrorNotice
            title="Governance evidence partially unavailable"
            message={getApiErrorMessage(
              approvalsQuery.error ??
                decisionsQuery.error ??
                overridesQuery.error ??
                focusedOverridesQuery.error ??
                policiesQuery.error ??
                policySummariesQuery.error,
              "One or more approval-governance queries failed.",
            )}
          />
        ) : null}

        <SplitPanel
          collapseAt="2xl"
          primary={
            <div className="space-y-6">
              <ApprovalQueueSection
                rows={filteredApprovalRows}
                filters={{
                  status: routeParams.status,
                  decisionType: routeParams.decisionType,
                }}
                selectedApprovalTaskId={routeParams.approvalTaskId}
                onFiltersChange={(nextFilters) =>
                  applyRouteParams({
                    approvalTaskId: null,
                    ...nextFilters,
                  })
                }
                onSelectApproval={(approvalTaskId) =>
                  applyRouteParams({
                    approvalTaskId,
                    decisionId: null,
                  })
                }
              />

              <HumanInterventionSection
                rows={filteredOverrideRows}
                overrideType={routeParams.overrideType}
                selectedDecisionId={selectedDecision?.id ?? null}
                onOverrideTypeChange={(overrideType) => applyRouteParams({ overrideType })}
                onSelectContext={({ decisionId, policyId }) =>
                  applyRouteParams({
                    approvalTaskId: null,
                    decisionId: decisionId ?? null,
                    policyId: policyId ?? routeParams.policyId,
                  })
                }
              />
            </div>
          }
          secondary={
            <div className="space-y-6">
              {approvalDetailQuery.isError && routeParams.approvalTaskId ? (
                <ApprovalGovernanceErrorNotice
                  title="Selected approval detail unavailable"
                  message={getApiErrorMessage(
                    approvalDetailQuery.error,
                    "The selected approval task could not be loaded.",
                  )}
                />
              ) : null}

              {decisionDetailQuery.isError && selectedDecisionId ? (
                <ApprovalGovernanceErrorNotice
                  title="Selected decision detail unavailable"
                  message={getApiErrorMessage(
                    decisionDetailQuery.error,
                    "The selected decision could not be loaded.",
                  )}
                />
              ) : null}

              {selectedTimelineQuery.isError && selectedDecisionId ? (
                <ApprovalGovernanceErrorNotice
                  title="Decision governance timeline unavailable"
                  message={getApiErrorMessage(
                    selectedTimelineQuery.error,
                    "The selected decision's audit timeline could not be loaded.",
                  )}
                />
              ) : null}

              {decisionOutcomesQuery.isError && selectedDecisionId ? (
                <ApprovalGovernanceErrorNotice
                  title="Decision outcomes unavailable"
                  message={getApiErrorMessage(
                    decisionOutcomesQuery.error,
                    "The linked decision outcomes could not be loaded.",
                  )}
                />
              ) : null}

              <ApprovalOverrideDetailPanel
                approval={selectedApproval}
                decision={selectedDecision}
                policy={selectedPolicy}
                relatedExecutions={relatedExecutions}
                relatedOverrides={selectedOverrideRows}
                latestOutcome={latestOutcome}
                auditItems={detailAuditItems}
                isActionPending={approveMutation.isPending || rejectMutation.isPending}
                onApprove={() => {
                  if (selectedApproval) {
                    setConfirmationState({ kind: "approve", approval: selectedApproval });
                  }
                }}
                onReject={() => {
                  if (selectedApproval) {
                    setConfirmationState({ kind: "reject", approval: selectedApproval });
                  }
                }}
              />
            </div>
          }
        />

        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.02fr)_minmax(20rem,0.98fr)]">
          <ExceptionPatternsSection
            rows={interventionPatterns}
            selectedPolicyId={selectedPolicyId}
            onSelectPolicy={(policyId) =>
              applyRouteParams({
                policyId,
              })
            }
          />

          <div className="space-y-6">
            {globalTimelineQuery.isError ? (
              <ApprovalGovernanceErrorNotice
                title="Governance audit feed unavailable"
                message={getApiErrorMessage(
                  globalTimelineQuery.error,
                  "The global governance audit feed could not be loaded.",
                )}
              />
            ) : null}

            <GovernanceAuditSection items={governanceAuditItems} />
          </div>
        </div>
      </div>

      <ActionConfirmationDialog
        open={confirmationState !== null}
        eyebrow="Confirm governance action"
        title={
          confirmationState?.kind === "approve"
            ? "Approve pending decision"
            : "Reject pending decision"
        }
        description={
          confirmationState?.kind === "approve"
            ? "This calls the real approval endpoint. The backend remains authoritative for decision lifecycle changes, operator-override persistence, and audit/outbox emission."
            : "This calls the real rejection endpoint. The backend remains authoritative for decision lifecycle changes, operator-override persistence, and audit/outbox emission."
        }
        confirmLabel={
          confirmationState?.kind === "approve" ? "Approve decision" : "Reject decision"
        }
        pending={approveMutation.isPending || rejectMutation.isPending}
        tone={confirmationState?.kind === "reject" ? "critical" : "default"}
        showReasonInput
        reasonLabel="Comment"
        reasonPlaceholder="Optional audit comment for the workflow approval record."
        onClose={() => {
          if (!approveMutation.isPending && !rejectMutation.isPending) {
            setConfirmationState(null);
          }
        }}
        onConfirm={handleConfirmDialog}
      />
    </>
  );
};
