import * as React from "react";
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
import { ActionConfirmationDialog } from "../../support-actions/components/ActionConfirmationDialog";
import { AutomationControlsSection } from "../components/AutomationControlsSection";
import { GovernanceAuditSection } from "../components/GovernanceAuditSection";
import { GovernanceSummarySection } from "../components/GovernanceSummarySection";
import { PolicyDetailPanel } from "../components/PolicyDetailPanel";
import { PolicyEditorSection } from "../components/PolicyEditorSection";
import { PolicyEffectivenessSection } from "../components/PolicyEffectivenessSection";
import { PolicyGovernanceEmptyState, PolicyGovernanceErrorNotice, PolicyGovernanceFeedbackNotice, PolicyGovernanceSectionSkeleton } from "../components/PolicyGovernanceStates";
import { PolicyListSection } from "../components/PolicyListSection";
import {
  useActivatePolicyMutation,
  useCreatePolicyMutation,
  useGovernanceApprovals,
  useGovernanceAuditTimeline,
  useGovernanceDecisions,
  usePolicies,
  usePolicyDetail,
  usePolicyEffectivenessDetail,
  usePolicyEffectivenessSummaries,
  useUpdatePolicyMutation,
} from "../hooks";
import { readPoliciesRouteParams } from "../route";
import {
  buildCreatePolicyInput,
  buildPolicyEditorState,
  buildPolicyRows,
  buildUpdatePolicyInput,
  createDefaultPolicyEditorState,
  deriveGovernanceSummary,
  deriveLatestGovernanceEvidenceAt,
  derivePolicyAuditItems,
  deriveSelectedPolicyApprovals,
  deriveSelectedPolicyDecisions,
  isDraftPolicy,
  toPolicyFilters,
  validatePolicyDraft,
} from "../selectors";
import type { PoliciesRouteParams, Policy, PolicyActionFeedback, PolicyEditorState } from "../types";

const knownParams = ["policyId", "policyType", "status"] as const;

const getApiErrorMessage = (error: unknown, fallback: string): string =>
  isApiError(error) ? `${error.message} Correlation: ${error.correlationId}.` : fallback;

export const PolicyGovernancePage = (): JSX.Element => {
  const session = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const routeParams = useMemo(() => readPoliciesRouteParams(searchParams), [searchParams]);

  const [feedback, setFeedback] = useState<PolicyActionFeedback | null>(null);
  const [draft, setDraft] = useState<PolicyEditorState>(createDefaultPolicyEditorState());
  const [forceCreateMode, setForceCreateMode] = useState(false);
  const [activationTarget, setActivationTarget] = useState<Policy | null>(null);

  const serverFilters = useMemo(() => toPolicyFilters(routeParams), [routeParams]);

  const policiesQuery = usePolicies(serverFilters);
  const policyDetailQuery = usePolicyDetail(routeParams.policyId);
  const allEffectivenessQuery = usePolicyEffectivenessSummaries();
  const selectedEffectivenessQuery = usePolicyEffectivenessDetail(routeParams.policyId);
  const decisionsQuery = useGovernanceDecisions();
  const approvalsQuery = useGovernanceApprovals();
  const auditTimelineQuery = useGovernanceAuditTimeline();

  const createPolicyMutation = useCreatePolicyMutation();
  const updatePolicyMutation = useUpdatePolicyMutation();
  const activatePolicyMutation = useActivatePolicyMutation();

  const policies = policiesQuery.data ?? [];
  const allSummaries = allEffectivenessQuery.data ?? [];
  const selectedPolicy =
    policyDetailQuery.data ??
    policies.find((policy) => policy.id === routeParams.policyId) ??
    null;
  const decisions = decisionsQuery.data ?? [];
  const approvals = approvalsQuery.data ?? [];
  const auditTimeline = auditTimelineQuery.data ?? [];

  const rows = useMemo(
    () => buildPolicyRows(policies, allSummaries, decisions, approvals),
    [allSummaries, approvals, decisions, policies],
  );
  const selectedPolicyDecisions = useMemo(
    () => deriveSelectedPolicyDecisions(decisions, selectedPolicy?.id ?? null),
    [decisions, selectedPolicy?.id],
  );
  const selectedPolicyApprovals = useMemo(
    () => deriveSelectedPolicyApprovals(approvals, selectedPolicyDecisions),
    [approvals, selectedPolicyDecisions],
  );
  const summary = useMemo(
    () =>
      deriveGovernanceSummary({
        policies,
        decisions,
        approvals,
      }),
    [approvals, decisions, policies],
  );
  const latestEvidenceAt = useMemo(
    () =>
      deriveLatestGovernanceEvidenceAt({
        policies,
        summaries: allSummaries,
        decisions,
        approvals,
        auditTimeline,
      }),
    [allSummaries, approvals, auditTimeline, decisions, policies],
  );
  const policyAuditItems = useMemo(
    () => derivePolicyAuditItems(auditTimeline, selectedPolicy?.id ?? null),
    [auditTimeline, selectedPolicy?.id],
  );
  const selectedSummaries = selectedPolicy
    ? selectedEffectivenessQuery.data ?? allSummaries.filter((summaryItem) => summaryItem.policyId === selectedPolicy.id)
    : allSummaries;

  useEffect(() => {
    if (rows.length === 0) {
      return;
    }

    if (!routeParams.policyId || !rows.some((row) => row.id === routeParams.policyId)) {
      const nextSearchParams = new URLSearchParams(searchParams);
      knownParams.forEach((key) => {
        if (key === "policyType" && routeParams.policyType !== "all") {
          return;
        }

        if (key === "status" && routeParams.status !== "all") {
          return;
        }

        if (key === "policyId") {
          nextSearchParams.delete("policyId");
        }
      });
      nextSearchParams.set("policyId", rows[0].id);
      setSearchParams(nextSearchParams, { replace: true });
    }
  }, [routeParams.policyId, routeParams.policyType, routeParams.status, rows, searchParams, setSearchParams]);

  useEffect(() => {
    if (selectedPolicy?.id) {
      setForceCreateMode(false);
    }
  }, [selectedPolicy?.id]);

  useEffect(() => {
    if (selectedPolicy && isDraftPolicy(selectedPolicy) && !forceCreateMode) {
      setDraft(buildPolicyEditorState(selectedPolicy));
      return;
    }

    setDraft(
      createDefaultPolicyEditorState(
        selectedPolicy?.policyType ?? (routeParams.policyType !== "all" ? routeParams.policyType : "replenishment"),
      ),
    );
  }, [forceCreateMode, routeParams.policyType, selectedPolicy]);

  const applyRouteParams = (nextParams: Partial<PoliciesRouteParams>) => {
    const mergedParams: PoliciesRouteParams = {
      policyId: routeParams.policyId,
      policyType: routeParams.policyType,
      status: routeParams.status,
      ...nextParams,
    };

    const nextSearchParams = new URLSearchParams(searchParams);
    knownParams.forEach((key) => nextSearchParams.delete(key));

    if (mergedParams.policyId) {
      nextSearchParams.set("policyId", mergedParams.policyId);
    }
    if (mergedParams.policyType !== "all") {
      nextSearchParams.set("policyType", mergedParams.policyType);
    }
    if (mergedParams.status !== "all") {
      nextSearchParams.set("status", mergedParams.status);
    }

    setSearchParams(nextSearchParams, { replace: true });
  };

  const handleFieldChange = <K extends keyof PolicyEditorState>(
    field: K,
    value: PolicyEditorState[K],
  ) => {
    if (field === "policyType") {
      setDraft((current) => ({
        ...createDefaultPolicyEditorState(value as PolicyEditorState["policyType"]),
        name: current.name,
        version: current.version,
      }));
      return;
    }

    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (): Promise<void> => {
    const validationFeedback = validatePolicyDraft(draft);
    if (validationFeedback) {
      setFeedback(validationFeedback);
      return;
    }

    try {
      if (selectedPolicy && isDraftPolicy(selectedPolicy) && !forceCreateMode) {
        const result = await updatePolicyMutation.mutateAsync({
          policyId: selectedPolicy.id,
          values: buildUpdatePolicyInput(draft),
        });

        applyRouteParams({ policyId: result.id });
        setFeedback({
          tone: "success",
          title: "Draft policy updated",
          message: `Saved ${result.name} as draft version ${result.version}.`,
          createdAt: new Date().toISOString(),
        });
        return;
      }

      const result = await createPolicyMutation.mutateAsync(buildCreatePolicyInput(draft));
      applyRouteParams({ policyId: result.id, policyType: routeParams.policyType, status: routeParams.status });
      setFeedback({
        tone: "success",
        title: "Draft policy created",
        message: `Created ${result.name} as draft version ${result.version}. Activate it separately when you are ready.`,
        createdAt: new Date().toISOString(),
      });
      setForceCreateMode(false);
    } catch (error) {
      setFeedback({
        tone: "error",
        title:
          selectedPolicy && isDraftPolicy(selectedPolicy) && !forceCreateMode
            ? "Draft update failed"
            : "Draft creation failed",
        message: getApiErrorMessage(
          error,
          "The backend rejected the policy mutation.",
        ),
        createdAt: new Date().toISOString(),
      });
    }
  };

  const handleActivate = async (): Promise<void> => {
    if (!activationTarget) {
      return;
    }

    try {
      const result = await activatePolicyMutation.mutateAsync({ policyId: activationTarget.id });
      applyRouteParams({ policyId: result.id });
      setFeedback({
        tone: "success",
        title: "Policy activated",
        message: `${result.name} is now active for ${result.policyType} decisions.`,
        createdAt: new Date().toISOString(),
      });
      setActivationTarget(null);
    } catch (error) {
      setFeedback({
        tone: "error",
        title: "Policy activation failed",
        message: getApiErrorMessage(
          error,
          "The backend rejected the policy activation request.",
        ),
        createdAt: new Date().toISOString(),
      });
    }
  };

  if (!session.isConfigured) {
    return (
      <PolicyGovernanceEmptyState
        title="Set demo session headers"
        message="Paste the seeded demo user id and organization id into the session panel above. This workspace sends those values on every request to the real decisioning, workflow, outcomes, and support APIs."
      />
    );
  }

  const initialLoading =
    policiesQuery.isLoading &&
    allEffectivenessQuery.isLoading &&
    decisionsQuery.isLoading &&
    approvalsQuery.isLoading;

  return (
    <>
      <div className={uiPageStackClassName}>
        <PageIntro
          eyebrow="Policies"
          title="Policy governance and deterministic controls"
          description="Manage policy drafts, inspect linked decision evidence, and govern activation using the real backend policy, workflow, and outcomes surfaces."
          actions={
            <>
              <Link to="/approval-governance" className={uiButtonSecondaryClassName}>
                Open approvals
              </Link>
              <Link to="/decisions" className={uiButtonSecondaryClassName}>
                Open decisions
              </Link>
            </>
          }
          meta={
            <div className="flex flex-wrap gap-2">
              <StatusChip tone="info">{rows.length} policies</StatusChip>
              <StatusChip tone={rows.some((row) => row.status === "active") ? "success" : "neutral"}>
                {rows.filter((row) => row.status === "active").length} active
              </StatusChip>
              <StatusChip tone={rows.some((row) => row.status === "draft") ? "warning" : "neutral"}>
                {rows.filter((row) => row.status === "draft").length} drafts
              </StatusChip>
            </div>
          }
        />

        {initialLoading ? (
          <PolicyGovernanceSectionSkeleton rows={4} />
        ) : (
          <GovernanceSummarySection summary={summary} latestEvidenceAt={latestEvidenceAt} />
        )}

        {feedback ? <PolicyGovernanceFeedbackNotice feedback={feedback} /> : null}

        {policiesQuery.isError || allEffectivenessQuery.isError || decisionsQuery.isError || approvalsQuery.isError ? (
          <PolicyGovernanceErrorNotice
            title="Governance data partially unavailable"
            message={getApiErrorMessage(
              policiesQuery.error ??
                allEffectivenessQuery.error ??
                decisionsQuery.error ??
                approvalsQuery.error,
              "One or more governance queries failed.",
            )}
          />
        ) : null}

        <SplitPanel
          collapseAt="2xl"
          secondarySticky={false}
          primary={
            <div className="space-y-6">
              <PolicyListSection
                rows={rows}
                filters={{
                  policyType: routeParams.policyType,
                  status: routeParams.status,
                }}
                selectedPolicyId={selectedPolicy?.id ?? null}
                onFiltersChange={(nextFilters) => {
                  applyRouteParams({
                    policyType: nextFilters.policyType,
                    status: nextFilters.status,
                    policyId: null,
                  });
                }}
                onSelectPolicy={(policyId) => applyRouteParams({ policyId })}
                onCreateDraft={() => setForceCreateMode(true)}
              />

              {selectedPolicy ? (
                policyDetailQuery.isLoading && !selectedPolicy ? (
                  <PolicyGovernanceSectionSkeleton rows={2} />
                ) : (
                  <PolicyDetailPanel
                    policy={selectedPolicy}
                    relatedDecisions={selectedPolicyDecisions}
                    relatedApprovals={selectedPolicyApprovals}
                  />
                )
              ) : rows.length === 0 ? (
                <PolicyGovernanceEmptyState
                  title="No policies yet"
                  message="No policies are currently persisted for this tenant. Create the first draft policy to establish explicit governance for replenishment, allocation, or exception decisions."
                />
              ) : null}
            </div>
          }
          secondary={
            <div className="space-y-6">
              <AutomationControlsSection
                policy={selectedPolicy}
                relatedDecisions={selectedPolicyDecisions}
                relatedApprovals={selectedPolicyApprovals}
                activationPending={activatePolicyMutation.isPending}
                onRequestActivate={(policy) => setActivationTarget(policy)}
              />

              <PolicyEditorSection
                selectedPolicy={selectedPolicy}
                draft={draft}
                forceCreateMode={forceCreateMode}
                pending={createPolicyMutation.isPending || updatePolicyMutation.isPending}
                feedback={null}
                onFieldChange={handleFieldChange}
                onSubmit={() => {
                  void handleSubmit();
                }}
                onSwitchToCreate={() => setForceCreateMode(true)}
              />
            </div>
          }
        />

        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
          <div className="space-y-6">
            {selectedEffectivenessQuery.isError ? (
              <PolicyGovernanceErrorNotice
                title="Selected policy effectiveness unavailable"
                message={getApiErrorMessage(
                  selectedEffectivenessQuery.error,
                  "The selected policy effectiveness summaries could not be loaded.",
                )}
              />
            ) : null}

            <PolicyEffectivenessSection
              selectedPolicy={selectedPolicy}
              summaries={selectedSummaries}
            />
          </div>

          <div className="space-y-6">
            {auditTimelineQuery.isError ? (
              <PolicyGovernanceErrorNotice
                title="Governance audit timeline unavailable"
                message={getApiErrorMessage(
                  auditTimelineQuery.error,
                  "The support timeline could not be loaded for governance evidence.",
                )}
              />
            ) : null}

            <GovernanceAuditSection items={policyAuditItems} />
          </div>
        </div>
      </div>

      <ActionConfirmationDialog
        open={activationTarget !== null}
        eyebrow="Confirm governance change"
        title="Activate policy"
        description="This calls the real policy activation endpoint. The backend remains authoritative for archiving any previously active policy of the same type, enforcing automation-tier entitlements, and recording audit and outbox events."
        confirmLabel="Activate policy"
        pending={activatePolicyMutation.isPending}
        onClose={() => {
          if (!activatePolicyMutation.isPending) {
            setActivationTarget(null);
          }
        }}
        onConfirm={() => handleActivate()}
      />
    </>
  );
};
