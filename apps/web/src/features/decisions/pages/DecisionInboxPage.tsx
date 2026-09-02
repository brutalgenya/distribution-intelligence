import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorNotice } from "../../../components/ui/ErrorNotice";
import { PageIntro } from "../../../components/ui/PageIntro";
import { SectionCard } from "../../../components/ui/SectionCard";
import { SkeletonBlock } from "../../../components/ui/SkeletonBlock";
import { SplitPanel } from "../../../components/ui/SplitPanel";
import { StatusChip } from "../../../components/ui/StatusChip";
import { isApiError } from "../../../lib/api/errors";
import { useSession } from "../../session/SessionProvider";
import { DecisionDetailContent } from "../components/DecisionDetailContent";
import { DecisionFilters } from "../components/DecisionFilters";
import { DecisionList } from "../components/DecisionList";
import { useDecisions } from "../hooks";
import type { DecisionStatus, DecisionType } from "../types";

const isDecisionType = (value: string | null): value is DecisionType =>
  value === "replenishment" || value === "allocation" || value === "exception";

const isDecisionStatus = (value: string | null): value is DecisionStatus =>
  value === "proposed" ||
  value === "awaiting_approval" ||
  value === "approved" ||
  value === "rejected" ||
  value === "execution_requested" ||
  value === "executing" ||
  value === "executed" ||
  value === "execution_failed" ||
  value === "superseded" ||
  value === "dismissed";

export const DecisionInboxPage = (): JSX.Element => {
  const session = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const decisionTypeParam = searchParams.get("decisionType");
  const statusParam = searchParams.get("status");

  const decisionType = isDecisionType(decisionTypeParam) ? decisionTypeParam : "all";
  const status = isDecisionStatus(statusParam) ? statusParam : "all";
  const selectedDecisionId = searchParams.get("decisionId");

  const filters = useMemo(
    () => ({
      ...(decisionType !== "all" ? { decisionType } : {}),
      ...(status !== "all" ? { status } : {}),
    }),
    [decisionType, status],
  );

  const decisionsQuery = useDecisions(filters);

  const updateParams = (updater: (params: URLSearchParams) => void) => {
    const nextParams = new URLSearchParams(searchParams);
    updater(nextParams);
    setSearchParams(nextParams, { replace: true });
  };

  const handleDecisionTypeChange = (value: DecisionType | "all") => {
    updateParams((params) => {
      if (value === "all") {
        params.delete("decisionType");
      } else {
        params.set("decisionType", value);
      }
    });
  };

  const handleStatusChange = (value: DecisionStatus | "all") => {
    updateParams((params) => {
      if (value === "all") {
        params.delete("status");
      } else {
        params.set("status", value);
      }
    });
  };

  const handleSelectDecision = (decisionId: string) => {
    updateParams((params) => {
      params.set("decisionId", decisionId);
    });
  };

  const errorMessage =
    decisionsQuery.error && isApiError(decisionsQuery.error)
      ? `${decisionsQuery.error.message} Correlation: ${decisionsQuery.error.correlationId}.`
      : "The decision list could not be loaded.";

  const decisionCount = decisionsQuery.data?.length ?? 0;

  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Decisions Inbox"
        title="Persisted recommendation queue"
        description="Inspect deterministic decisions, approval state, and linked outcomes without replacing the existing backend-driven inbox model."
        actions={<StatusChip tone="info">{decisionCount} visible</StatusChip>}
      />

      {!session.isConfigured ? (
        <EmptyState
          title="Set demo session headers"
          message="Paste the seeded demo user id and organization id into the session panel above. The app sends those values as x-user-id and x-organization-id on every request."
        />
      ) : (
        <SplitPanel
          primary={
            <div className="space-y-4">
              <DecisionFilters
                decisionType={decisionType}
                status={status}
                count={decisionCount}
                onDecisionTypeChange={handleDecisionTypeChange}
                onStatusChange={handleStatusChange}
              />

              {decisionsQuery.isLoading ? (
                <SkeletonBlock rows={4} height="h-32" />
              ) : decisionsQuery.isError ? (
                <ErrorNotice title="Decision list unavailable" message={errorMessage} />
              ) : decisionCount === 0 ? (
                <EmptyState
                  title="No decisions match these filters"
                  message="The backend returned an empty inbox for the selected decision type and status. Generate decisions in the API, then refresh this view."
                />
              ) : (
                <DecisionList
                  decisions={decisionsQuery.data ?? []}
                  selectedDecisionId={selectedDecisionId}
                  onSelect={handleSelectDecision}
                />
              )}
            </div>
          }
          secondary={
            selectedDecisionId ? (
              <SectionCard className="max-h-[calc(100vh-10rem)] !p-0 overflow-hidden">
                <DecisionDetailContent decisionId={selectedDecisionId} />
              </SectionCard>
            ) : (
              <EmptyState
                title="Choose a decision"
                message="Select a decision from the queue to open the inspector with approval state, rationale, and linked outcome data."
              />
            )
          }
        />
      )}
    </div>
  );
};
