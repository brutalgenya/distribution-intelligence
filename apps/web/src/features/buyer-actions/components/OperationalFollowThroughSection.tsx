import { Link } from "react-router-dom";

import { formatDateTime, formatNumber } from "../../../lib/utils/format";
import { buildInvestigationHref } from "../../investigation/route";
import {
  formatPurchaseOrderStatus,
  getPurchaseOrderOpenQty,
  getPurchaseOrderOrderedQty,
  getPurchaseOrderReceivedQty,
} from "../../supply-execution/selectors";
import { buildSupplyExecutionHref } from "../../supply-execution/route";
import { buildSupportActionsHref } from "../../support-actions/route";
import { BuyerActionsPartialNotice } from "./BuyerActionsStates";
import type {
  BuyerActionFeedback,
  BuyerActionsMutationSummary,
  PurchaseOrder,
} from "../types";

interface OperationalFollowThroughSectionProps {
  purchaseOrder: PurchaseOrder | null;
  feedback: BuyerActionFeedback | null;
  lastMutationSummary: BuyerActionsMutationSummary | null;
  scope: {
    skuId: string | null;
    locationId: string | null;
  };
}

const linkClassName =
  "rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-black/20 hover:bg-black/5";

export const OperationalFollowThroughSection = ({
  purchaseOrder,
  feedback,
  lastMutationSummary,
  scope,
}: OperationalFollowThroughSectionProps): JSX.Element => {
  const orderedQty = purchaseOrder ? getPurchaseOrderOrderedQty(purchaseOrder) : 0;
  const receivedQty = purchaseOrder ? getPurchaseOrderReceivedQty(purchaseOrder) : 0;
  const openQty = purchaseOrder ? getPurchaseOrderOpenQty(purchaseOrder) : 0;

  return (
    <section className="rounded-[28px] border border-black/8 bg-white p-5 shadow-panel">
      <p className="text-xs uppercase tracking-[0.2em] text-steel">Follow-through</p>
      <h4 className="mt-2 text-xl font-semibold text-ink">Operational follow-through</h4>
      <p className="mt-2 text-sm leading-6 text-steel">
        Confirm what changed after a mutation, then jump back into the monitoring and investigation views that show the
        broader operational impact.
      </p>

      {feedback ? (
        <div
          className={`mt-5 rounded-2xl px-4 py-4 text-sm ${
            feedback.tone === "success"
              ? "border border-pine/20 bg-pine/10 text-pine"
              : feedback.tone === "error"
                ? "border border-red-200 bg-red-50 text-red-700"
                : "border border-black/10 bg-mist text-steel"
          }`}
        >
          <p className="font-semibold">{feedback.title}</p>
          <p className="mt-2 leading-6">{feedback.message}</p>
        </div>
      ) : null}

      {purchaseOrder ? (
        <div className="mt-5 grid gap-4 2xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
              <div className="rounded-2xl bg-mist px-4 py-3">
                <p className="text-xs uppercase tracking-[0.14em] text-steel">Current status</p>
                <p className="mt-2 text-base font-semibold text-ink">
                  {formatPurchaseOrderStatus(purchaseOrder.status)}
                </p>
              </div>
              <div className="rounded-2xl bg-mist px-4 py-3">
                <p className="text-xs uppercase tracking-[0.14em] text-steel">Received / ordered</p>
                <p className="mt-2 text-base font-semibold text-ink">
                  {formatNumber(receivedQty)} / {formatNumber(orderedQty)}
                </p>
              </div>
              <div className="rounded-2xl bg-mist px-4 py-3">
                <p className="text-xs uppercase tracking-[0.14em] text-steel">Open quantity</p>
                <p className="mt-2 text-base font-semibold text-ink">{formatNumber(openQty)}</p>
              </div>
            </div>

            {lastMutationSummary ? (
              <div className="rounded-2xl bg-mist px-4 py-4">
                <p className="text-xs uppercase tracking-[0.14em] text-steel">Last mutation result</p>
                <p className="mt-2 text-sm font-semibold text-ink">
                  {lastMutationSummary.poNumber} is now {formatPurchaseOrderStatus(lastMutationSummary.status)}.
                </p>
                <p className="mt-2 text-sm leading-6 text-steel">{lastMutationSummary.message}</p>
                <p className="mt-2 text-sm text-steel">
                  Refreshed {formatDateTime(lastMutationSummary.updatedAt)}
                </p>
              </div>
            ) : (
              <BuyerActionsPartialNotice
                title="No action performed yet"
                message="Submit, delay, or receive against the selected purchase order to see server-backed result feedback here."
              />
            )}
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Link
                to={buildSupplyExecutionHref({
                  purchaseOrderId: purchaseOrder.id,
                  supplierId: purchaseOrder.supplierId,
                  skuId: scope.skuId,
                  locationId: scope.locationId,
                })}
                className={linkClassName}
              >
                Back to supply execution
              </Link>
              <Link
                to={buildSupportActionsHref({
                  skuId: scope.skuId,
                  locationId: scope.locationId,
                })}
                className={linkClassName}
              >
                Open support actions
              </Link>
              {scope.skuId && scope.locationId ? (
                <Link
                  to={buildInvestigationHref(scope.skuId, scope.locationId)}
                  className={linkClassName}
                >
                  Open investigation
                </Link>
              ) : null}
            </div>

            <BuyerActionsPartialNotice
              title="Unsupported actions stay explicit"
              message="The current backend does not expose standalone purchase-order cancel, expected-date-only edit, or reverse-receipt mutations, so this workspace leaves those actions unavailable."
            />
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <BuyerActionsPartialNotice
            title="Select a purchase order"
            message="Choose a purchase order from the queue to see refreshed status, receipt totals, and cross-links after a mutation."
          />
        </div>
      )}
    </section>
  );
};
