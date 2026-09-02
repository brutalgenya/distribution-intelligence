import { Link } from "react-router-dom";

import { formatDateTime } from "../../../lib/utils/format";
import { StatusChip } from "../../../components/ui/StatusChip";
import { uiButtonSecondaryClassName } from "../../../components/ui/classes";
import { buildBuyerActionsHref } from "../../buyer-actions/route";
import { buildDataOpsHref } from "../../data-ops/route";
import { buildSupplyExecutionHref } from "../../supply-execution/route";
import { buildSupportActionsHref } from "../../support-actions/route";
import { getRiskToneClasses, selectSkuLocationLabel } from "../selectors";
import type { InvestigationContextData, InvestigationRiskSummary } from "../types";

interface InvestigationHeaderProps {
  context: InvestigationContextData;
  riskSummary: InvestigationRiskSummary;
  investigationHref: string;
}

export const InvestigationHeader = ({
  context,
  riskSummary,
  investigationHref,
}: InvestigationHeaderProps): JSX.Element => {
  const toneData = getRiskToneClasses(riskSummary.level);

  let tone: "success" | "danger" | "warning" | "neutral" | "info" = "neutral";
  if (toneData.badgeClassName.includes("red")) tone = "danger";
  else if (toneData.badgeClassName.includes("emerald") || toneData.badgeClassName.includes("teal")) tone = "success";
  else if (toneData.badgeClassName.includes("amber")) tone = "warning";
  else if (toneData.badgeClassName.includes("indigo")) tone = "info";

  const locationId = context.location?.id ?? context.position?.locationId ?? null;

  return (
    <section className={`ui-panel p-6 sm:p-8 xl:p-10 ${toneData.panelClassName}`}>
      <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-4xl">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip tone={tone}>{riskSummary.label}</StatusChip>
            <StatusChip tone="neutral">{context.sku.skuCode}</StatusChip>
            {context.location ? <StatusChip tone="neutral">{context.location.code}</StatusChip> : null}
          </div>

          <h1 className="mt-4 text-page-heading text-ink">{selectSkuLocationLabel(context)}</h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-steel">
            Deep-dive the exact inventory position, forecast posture, supply coverage, decisions, and outcome evidence for this SKU/location scope.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-steel">
            <span>
              {riskSummary.freshnessAt
                ? `Fresh as of ${formatDateTime(riskSummary.freshnessAt)}`
                : "Freshness not available"}
            </span>
            <span className="text-ash">|</span>
            <span>{context.location?.name ?? "Location not exposed"}</span>
          </div>

          <ul className="mt-6 space-y-2 text-sm leading-relaxed text-steel">
            {riskSummary.reasons.map((reason) => (
              <li key={reason} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary/55" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex min-w-[220px] flex-col gap-2">
          <Link to={investigationHref} className={`${uiButtonSecondaryClassName} justify-center`}>
            Share view
          </Link>
          <Link
            to={buildDataOpsHref({
              skuId: context.sku.id,
              locationId,
            })}
            className={`${uiButtonSecondaryClassName} justify-center`}
          >
            Trace data and ops
          </Link>
          <Link
            to={buildSupportActionsHref({
              skuId: context.sku.id,
              locationId,
            })}
            className={`${uiButtonSecondaryClassName} justify-center`}
          >
            Open support actions
          </Link>
          <Link
            to={buildSupplyExecutionHref({
              skuId: context.sku.id,
              locationId,
            })}
            className={`${uiButtonSecondaryClassName} justify-center`}
          >
            Open supply execution
          </Link>
          <Link
            to={buildBuyerActionsHref({
              skuId: context.sku.id,
              locationId,
            })}
            className={`${uiButtonSecondaryClassName} justify-center`}
          >
            Open buyer actions
          </Link>
        </div>
      </div>
    </section>
  );
};
