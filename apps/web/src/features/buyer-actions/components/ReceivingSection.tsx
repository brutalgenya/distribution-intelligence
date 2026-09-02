import { useEffect, useMemo, useState } from "react";

import { formatDateTime, formatNumber } from "../../../lib/utils/format";
import {
  buildLocationLookup,
  buildSkuLookup,
  selectPurchaseOrderLineScopeLabel,
} from "../../supply-execution/selectors";
import { BuyerActionsPartialNotice } from "./BuyerActionsStates";
import { canReceivePurchaseOrder } from "../selectors";
import type {
  Location,
  PurchaseOrder,
  ReceivePurchaseOrderInput,
  Sku,
} from "../types";

interface ReceivingSectionProps {
  purchaseOrder: PurchaseOrder | null;
  skus: Sku[];
  locations: Location[];
  defaultLocationId: string | null;
  isPending: boolean;
  onRequestReceive: (purchaseOrder: PurchaseOrder, values: ReceivePurchaseOrderInput) => void;
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

type QuantityDrafts = Record<string, string>;
type LocationDrafts = Record<string, string>;

export const ReceivingSection = ({
  purchaseOrder,
  skus,
  locations,
  defaultLocationId,
  isPending,
  onRequestReceive,
}: ReceivingSectionProps): JSX.Element => {
  const [receivedAt, setReceivedAt] = useState("");
  const [quantityDrafts, setQuantityDrafts] = useState<QuantityDrafts>({});
  const [locationDrafts, setLocationDrafts] = useState<LocationDrafts>({});

  useEffect(() => {
    if (!purchaseOrder) {
      setReceivedAt("");
      setQuantityDrafts({});
      setLocationDrafts({});
      return;
    }

    const nextQuantities: QuantityDrafts = {};
    const nextLocations: LocationDrafts = {};

    purchaseOrder.lines.forEach((line) => {
      nextQuantities[line.id] = String(line.quantityReceived);
      nextLocations[line.id] = line.expectedLocationId ?? defaultLocationId ?? "";
    });

    setReceivedAt(toDateTimeLocalValue(purchaseOrder.receivedAt));
    setQuantityDrafts(nextQuantities);
    setLocationDrafts(nextLocations);
  }, [defaultLocationId, purchaseOrder]);

  const skuLookup = useMemo(() => buildSkuLookup(skus), [skus]);
  const locationLookup = useMemo(() => buildLocationLookup(locations), [locations]);

  const lineDrafts = useMemo(() => {
    if (!purchaseOrder) {
      return [];
    }

    return purchaseOrder.lines.map((line) => {
      const draftValue = quantityDrafts[line.id] ?? String(line.quantityReceived);
      const parsedQuantity = Number.parseInt(draftValue, 10);
      const nextQuantity = Number.isNaN(parsedQuantity) ? null : parsedQuantity;
      const locationId = line.expectedLocationId ?? locationDrafts[line.id] ?? "";
      const errors: string[] = [];

      if (draftValue.trim().length === 0 || nextQuantity === null) {
        errors.push("Receipt quantity must be a whole number.");
      } else {
        if (nextQuantity < line.quantityReceived) {
          errors.push("Receipt quantity cannot reduce previously received units.");
        }

        if (nextQuantity > line.quantityOrdered) {
          errors.push("Receipt quantity cannot exceed ordered units.");
        }

        if (nextQuantity > line.quantityReceived && !line.expectedLocationId && locationId.length === 0) {
          errors.push("Location is required when the PO line has no expected location.");
        }
      }

      return {
        line,
        nextQuantity,
        locationId,
        errors,
      };
    });
  }, [locationDrafts, purchaseOrder, quantityDrafts]);

  const changedLines = lineDrafts.filter(
    (entry) => entry.nextQuantity !== null && entry.nextQuantity > entry.line.quantityReceived,
  );
  const hasValidationErrors = lineDrafts.some((entry) => entry.errors.length > 0);

  const payload = useMemo(() => {
    if (changedLines.length === 0 || hasValidationErrors) {
      return null;
    }

    return {
      ...(toIsoDateTime(receivedAt) ? { receivedAt: toIsoDateTime(receivedAt) } : {}),
      lines: changedLines.map((entry) => ({
        lineId: entry.line.id,
        quantityReceived: entry.nextQuantity as number,
        ...(entry.line.expectedLocationId
          ? {}
          : entry.locationId.length > 0
            ? { locationId: entry.locationId }
            : {}),
      })),
    } satisfies ReceivePurchaseOrderInput;
  }, [changedLines, hasValidationErrors, receivedAt]);

  return (
    <section className="rounded-[28px] border border-black/8 bg-white p-5 shadow-panel">
      <p className="text-xs uppercase tracking-[0.2em] text-steel">Receiving</p>
      <h4 className="mt-2 text-xl font-semibold text-ink">Receiving and partial receipt posting</h4>
      <p className="mt-2 text-sm leading-6 text-steel">
        Receipt inputs use the real backend contract: cumulative quantities by purchase-order line, with location
        required only when the line has no expected receipt location yet.
      </p>

      {purchaseOrder ? (
        canReceivePurchaseOrder(purchaseOrder.status) ? (
          <div className="mt-5 space-y-5">
            <label className="block">
              <span className="text-sm font-semibold text-ink">Receipt timestamp</span>
              <input
                type="datetime-local"
                value={receivedAt}
                onChange={(event) => setReceivedAt(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-pine/40"
              />
              <span className="mt-2 block text-sm text-steel">
                Leave blank to let the backend persist the current server time.
              </span>
            </label>

            <div className="overflow-hidden rounded-[24px] border border-black/8">
              <div className="custom-scrollbar overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead className="bg-cloud">
                    <tr className="text-left text-xs uppercase tracking-[0.16em] text-steel">
                      <th className="px-4 py-4 font-semibold">Scope</th>
                      <th className="px-4 py-4 font-semibold">Current received</th>
                      <th className="px-4 py-4 font-semibold">Ordered</th>
                      <th className="px-4 py-4 font-semibold">New cumulative received</th>
                      <th className="px-4 py-4 font-semibold">Receipt location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineDrafts.map((entry) => (
                      <tr key={entry.line.id} className="border-t border-black/6 bg-white">
                        <td className="px-4 py-4 align-top">
                          <p className="text-sm font-semibold text-ink">
                            {selectPurchaseOrderLineScopeLabel(entry.line, {
                              skuById: skuLookup,
                              locationById: locationLookup,
                            })}
                          </p>
                          <p className="mt-1 text-sm text-steel">{entry.line.id}</p>
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-ink">
                          {formatNumber(entry.line.quantityReceived)}
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-ink">
                          {formatNumber(entry.line.quantityOrdered)}
                        </td>
                        <td className="px-4 py-4 align-top">
                          <input
                            type="number"
                            min={entry.line.quantityReceived}
                            max={entry.line.quantityOrdered}
                            step={1}
                            value={quantityDrafts[entry.line.id] ?? String(entry.line.quantityReceived)}
                            onChange={(event) =>
                              setQuantityDrafts((current) => ({
                                ...current,
                                [entry.line.id]: event.target.value,
                              }))
                            }
                            className="w-32 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-pine/40"
                          />
                          {entry.errors.length > 0 ? (
                            <ul className="mt-2 space-y-1 text-sm text-red-700">
                              {entry.errors.map((error) => (
                                <li key={error}>{error}</li>
                              ))}
                            </ul>
                          ) : null}
                        </td>
                        <td className="px-4 py-4 align-top">
                          {entry.line.expectedLocationId ? (
                            <div className="rounded-xl bg-mist px-3 py-2 text-sm text-ink">
                              {locationLookup.get(entry.line.expectedLocationId)?.code ??
                                entry.line.expectedLocationId}
                            </div>
                          ) : (
                            <select
                              value={locationDrafts[entry.line.id] ?? ""}
                              onChange={(event) =>
                                setLocationDrafts((current) => ({
                                  ...current,
                                  [entry.line.id]: event.target.value,
                                }))
                              }
                              className="w-full min-w-48 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-pine/40"
                            >
                              <option value="">Select location</option>
                              {locations.map((location) => (
                                <option key={location.id} value={location.id}>
                                  {location.code} - {location.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-1">
              <div className="rounded-2xl bg-mist px-4 py-4">
                <p className="text-xs uppercase tracking-[0.14em] text-steel">Receipt readiness</p>
                <p className="mt-2 text-sm leading-6 text-ink">
                  {changedLines.length > 0
                    ? `${formatNumber(changedLines.length)} line(s) will advance receipt totals if you confirm this action.`
                    : "Increase at least one cumulative received quantity above its current persisted value to post a receipt."}
                </p>
              </div>
              <div className="rounded-2xl bg-mist px-4 py-4">
                <p className="text-xs uppercase tracking-[0.14em] text-steel">Current receipt state</p>
                <p className="mt-2 text-sm leading-6 text-ink">
                  Status {purchaseOrder.status}. Backend received timestamp {formatDateTime(purchaseOrder.receivedAt)}.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (purchaseOrder && payload) {
                  onRequestReceive(purchaseOrder, payload);
                }
              }}
              disabled={isPending || payload === null}
              className="rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Posting receipt..." : "Confirm receipt posting"}
            </button>
          </div>
        ) : (
          <div className="mt-5">
            <BuyerActionsPartialNotice
              title="Receiving not available"
              message="The backend only exposes receipt posting for submitted, delayed, partially received, or already received purchase orders."
            />
          </div>
        )
      ) : (
        <div className="mt-5">
          <BuyerActionsPartialNotice
            title="Select a purchase order"
            message="Choose a purchase order from the queue to see whether cumulative receipt posting is available."
          />
        </div>
      )}
    </section>
  );
};
