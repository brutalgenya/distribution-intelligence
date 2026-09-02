import clsx from "clsx";
import { Link } from "react-router-dom";

import { formatDateTime } from "../../../lib/utils/format";
import { buildInvestigationHref } from "../../investigation/route";
import { buildSupportActionsHref } from "../../support-actions/route";
import type {
  SupplyExecutionContextSummary,
  SupplyExecutionSummaryCard,
} from "../types";

interface SupplyExecutionSummarySectionProps {
  cards: SupplyExecutionSummaryCard[];
  freshnessAt: string | null;
  contextSummary: SupplyExecutionContextSummary;
}

const toneClassNames: Record<SupplyExecutionSummaryCard["tone"], string> = {
  critical: "border-red-200 bg-red-50 text-red-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  positive: "border-pine/20 bg-pine/10 text-pine",
  neutral: "border-black/10 bg-mist text-steel",
};

const linkClassName =
  "rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-black/20 hover:bg-black/5";

export const SupplyExecutionSummarySection = ({
  cards,
  freshnessAt,
  contextSummary,
}: SupplyExecutionSummarySectionProps): JSX.Element => (
  <section className="space-y-4">
    <div className="rounded-[28px] border border-black/8 bg-white px-5 py-5 shadow-panel">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-4xl">
          <p className="text-xs uppercase tracking-[0.28em] text-steel">Supply posture</p>
          <h3 className="mt-2 text-3xl font-semibold text-ink">Supply execution summary</h3>
          <p className="mt-2 text-sm leading-6 text-steel">
            Follow replenishment through purchase order execution, supplier coverage, lead-time context, and receipt
            progress. This workspace intentionally stays close to the current supply read model instead of inventing
            ERP-style lifecycle logic in the client.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-steel">
            <span className="rounded-full bg-black/5 px-3 py-1 font-semibold text-ink">
              {freshnessAt ? `Fresh as of ${formatDateTime(freshnessAt)}` : "Freshness not available"}
            </span>
            {contextSummary.sku && contextSummary.location ? (
              <span className="rounded-full bg-pine/10 px-3 py-1 font-semibold text-pine">
                Focused scope: {contextSummary.sku.skuCode} @ {contextSummary.location.code}
              </span>
            ) : null}
          </div>

          {contextSummary.sku && contextSummary.location ? (
            <p className="mt-4 text-sm leading-6 text-steel">
              This view is scoped to one investigation context. Open stockout incidents for that scope:{" "}
              <span className="font-semibold text-ink">{contextSummary.stockouts.length}</span>.
            </p>
          ) : (
            <p className="mt-4 text-sm leading-6 text-steel">
              Select a purchase order or arrive from investigation and support workflows to focus the queue on one
              replenishment story.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          {contextSummary.sku && contextSummary.location ? (
            <>
              <Link
                to={buildInvestigationHref(contextSummary.sku.id, contextSummary.location.id)}
                className={linkClassName}
              >
                Open investigation
              </Link>
              <Link
                to={buildSupportActionsHref({
                  skuId: contextSummary.sku.id,
                  locationId: contextSummary.location.id,
                })}
                className={linkClassName}
              >
                Open support actions
              </Link>
            </>
          ) : null}
          <Link to="/workflow" className={linkClassName}>
            Open workflow
          </Link>
        </div>
      </div>
    </div>

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
      {cards.map((card) => (
        <div key={card.id} className={clsx("rounded-[24px] border px-4 py-4 shadow-panel", toneClassNames[card.tone])}>
          <p className="text-xs uppercase tracking-[0.16em]">{card.label}</p>
          <p className="mt-3 text-3xl font-semibold">{card.value}</p>
          <p className="mt-3 text-sm leading-6 opacity-85">{card.helper}</p>
        </div>
      ))}
    </div>
  </section>
);
