import { Link } from "react-router-dom";

import { formatDateTime } from "../../../lib/utils/format";
import { buildInvestigationHref } from "../../investigation/route";
import { buildSupportActionsHref } from "../../support-actions/route";
import { deriveClosureSignals } from "../selectors";
import type {
  PurchaseOrder,
  StockoutIncident,
  SupplyClosureSignal,
} from "../types";
import { PartialDataNotice } from "./SupplyExecutionStates";

interface ClosureSignalsSectionProps {
  selectedPurchaseOrder: PurchaseOrder | null;
  stockouts: StockoutIncident[];
  skuId: string | null;
  locationId: string | null;
}

const toneClassNames: Record<SupplyClosureSignal["tone"], string> = {
  critical: "border-red-200 bg-red-50 text-red-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  positive: "border-pine/20 bg-pine/10 text-pine",
  neutral: "border-black/10 bg-mist text-steel",
};

const linkClassName =
  "rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-black/20 hover:bg-black/5";

export const ClosureSignalsSection = ({
  selectedPurchaseOrder,
  stockouts,
  skuId,
  locationId,
}: ClosureSignalsSectionProps): JSX.Element => {
  const closureSignals = deriveClosureSignals({
    selectedPurchaseOrder,
    stockouts,
  });

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-steel">Closure signals</p>
        <h3 className="mt-2 text-3xl font-semibold text-ink">Closure and follow-through signals</h3>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-steel">
          Use current purchase order status, receipt totals, and any active item-level stockout evidence to understand
          whether replenishment is progressing toward closure or whether risk remains open.
        </p>
      </div>

      {selectedPurchaseOrder ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
            {closureSignals.map((signal) => (
              <div key={signal.id} className={`rounded-[24px] border px-4 py-4 shadow-panel ${toneClassNames[signal.tone]}`}>
                <p className="text-xs uppercase tracking-[0.16em]">{signal.label}</p>
                <p className="mt-3 text-2xl font-semibold">{signal.value}</p>
                <p className="mt-3 text-sm leading-6 opacity-85">{signal.helper}</p>
              </div>
            ))}
          </div>

          <div className="rounded-[28px] border border-black/8 bg-white p-5 shadow-panel">
            <div className="flex flex-wrap gap-3">
              {skuId && locationId ? (
                <>
                  <Link to={buildInvestigationHref(skuId, locationId)} className={linkClassName}>
                    Open investigation
                  </Link>
                  <Link
                    to={buildSupportActionsHref({
                      skuId,
                      locationId,
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

            <div className="mt-5 grid gap-4 2xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl bg-mist px-4 py-4">
                <p className="text-xs uppercase tracking-[0.14em] text-steel">Closure evidence</p>
                <p className="mt-2 text-sm leading-6 text-ink">
                  Current evidence is sourced from the purchase order read model itself: current status, delayed or
                  received timestamps, and persisted line-level received quantities.
                </p>
                <p className="mt-3 text-sm leading-6 text-steel">
                  Purchase order updated {formatDateTime(selectedPurchaseOrder.updatedAt)}.
                </p>
              </div>

              <div className="rounded-2xl bg-mist px-4 py-4">
                <p className="text-xs uppercase tracking-[0.14em] text-steel">Remaining gaps</p>
                <p className="mt-2 text-sm leading-6 text-steel">
                  The current backend does not expose structured purchase-order-to-decision links, receipt event
                  history, or a dedicated closure verdict endpoint, so this section intentionally stops at the current
                  supply read model and any item-level incident evidence already persisted elsewhere.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-[28px] border border-black/8 bg-white p-5 shadow-panel">
          <PartialDataNotice
            title="Select a purchase order to inspect closure"
            message="Closure signals are strongest when a specific purchase order is selected. Without that, this workspace keeps the queue and supplier context visible but cannot attribute receipt progress to one replenishment action."
          />
        </div>
      )}
    </section>
  );
};
