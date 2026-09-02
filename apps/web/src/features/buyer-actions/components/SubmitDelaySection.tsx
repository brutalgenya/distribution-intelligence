import { useEffect, useMemo, useState } from "react";

import { formatPurchaseOrderStatus } from "../../supply-execution/selectors";
import { BuyerActionsPartialNotice } from "./BuyerActionsStates";
import { canDelayPurchaseOrder, canSubmitPurchaseOrder } from "../selectors";
import type { DelayPurchaseOrderInput, PurchaseOrder } from "../types";

interface SubmitDelaySectionProps {
  purchaseOrder: PurchaseOrder | null;
  isSubmitPending: boolean;
  isDelayPending: boolean;
  onRequestSubmit: (purchaseOrder: PurchaseOrder) => void;
  onRequestDelay: (purchaseOrder: PurchaseOrder, values: DelayPurchaseOrderInput) => void;
}

const toDateTimeLocalValue = (value: string | null | undefined): string => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offset = date.getTimezoneOffset();
  const adjusted = new Date(date.getTime() - offset * 60_000);
  return adjusted.toISOString().slice(0, 16);
};

const toIsoDateTime = (value: string): string | undefined =>
  value.trim().length > 0 ? new Date(value).toISOString() : undefined;

export const SubmitDelaySection = ({
  purchaseOrder,
  isSubmitPending,
  isDelayPending,
  onRequestSubmit,
  onRequestDelay,
}: SubmitDelaySectionProps): JSX.Element => {
  const [expectedDeliveryAt, setExpectedDeliveryAt] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setExpectedDeliveryAt(toDateTimeLocalValue(purchaseOrder?.expectedDeliveryAt));
    setNotes(purchaseOrder?.notes ?? "");
  }, [purchaseOrder?.expectedDeliveryAt, purchaseOrder?.id, purchaseOrder?.notes]);

  const canSubmit = purchaseOrder ? canSubmitPurchaseOrder(purchaseOrder.status) : false;
  const canDelay = purchaseOrder ? canDelayPurchaseOrder(purchaseOrder.status) : false;

  const delayPayload = useMemo(
    () =>
      ({
        ...(toIsoDateTime(expectedDeliveryAt)
          ? { expectedDeliveryAt: toIsoDateTime(expectedDeliveryAt) }
          : {}),
        ...(notes.trim().length > 0 ? { notes: notes.trim() } : {}),
      }) satisfies DelayPurchaseOrderInput,
    [expectedDeliveryAt, notes],
  );

  return (
    <section className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-1">
      <div className="rounded-[28px] border border-black/8 bg-white p-5 shadow-panel">
        <p className="text-xs uppercase tracking-[0.2em] text-steel">Submit transition</p>
        <h4 className="mt-2 text-xl font-semibold text-ink">Submit purchase order</h4>
        <p className="mt-2 text-sm leading-6 text-steel">
          Use the real submit mutation when a draft purchase order is ready to leave planning and enter the supply
          execution lifecycle.
        </p>

        {purchaseOrder ? (
          canSubmit ? (
            <div className="mt-5 space-y-3">
              <p className="rounded-2xl bg-mist px-4 py-4 text-sm text-steel">
                This purchase order is currently in draft and can be submitted through the backend. The mutation is
                idempotent if the order is already submitted.
              </p>
              <button
                type="button"
                onClick={() => onRequestSubmit(purchaseOrder)}
                disabled={isSubmitPending}
                className="rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitPending ? "Submitting..." : "Submit purchase order"}
              </button>
            </div>
          ) : (
            <div className="mt-5">
              <BuyerActionsPartialNotice
                title="Submit not available"
                message={`The selected purchase order is ${formatPurchaseOrderStatus(
                  purchaseOrder.status,
                )}. The backend only exposes submit from draft status.`}
              />
            </div>
          )
        ) : (
          <div className="mt-5">
            <BuyerActionsPartialNotice
              title="Select a purchase order"
              message="Choose a purchase order from the queue to see whether submit is available."
            />
          </div>
        )}
      </div>

      <div className="rounded-[28px] border border-black/8 bg-white p-5 shadow-panel">
        <p className="text-xs uppercase tracking-[0.2em] text-steel">Delay transition</p>
        <h4 className="mt-2 text-xl font-semibold text-ink">Delay and expected delivery update</h4>
        <p className="mt-2 text-sm leading-6 text-steel">
          The backend delay route accepts an optional expected delivery timestamp and notes, but only as part of the
          delayed transition itself.
        </p>

        {purchaseOrder ? (
          canDelay ? (
            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-ink">Expected delivery</span>
                <input
                  type="datetime-local"
                  value={expectedDeliveryAt}
                  onChange={(event) => setExpectedDeliveryAt(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-pine/40"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-ink">Delay notes</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={4}
                  maxLength={1000}
                  placeholder="Optional supplier or delivery context for the delayed transition."
                  className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-pine/40"
                />
              </label>

              <button
                type="button"
                onClick={() => onRequestDelay(purchaseOrder, delayPayload)}
                disabled={isDelayPending}
                className="rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDelayPending ? "Working..." : "Mark purchase order delayed"}
              </button>
            </div>
          ) : (
            <div className="mt-5">
              <BuyerActionsPartialNotice
                title="Delay transition not available"
                message={
                  purchaseOrder.status === "delayed"
                    ? "This purchase order is already delayed. The current backend does not expose a standalone expected-date edit route after the order has entered delayed status."
                    : `The selected purchase order is ${formatPurchaseOrderStatus(
                        purchaseOrder.status,
                      )}. The backend only exposes delay from submitted status.`
                }
              />
            </div>
          )
        ) : (
          <div className="mt-5">
            <BuyerActionsPartialNotice
              title="Select a purchase order"
              message="Choose a purchase order from the queue to see whether delay is available."
            />
          </div>
        )}
      </div>
    </section>
  );
};
