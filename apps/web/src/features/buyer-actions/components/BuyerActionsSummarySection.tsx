import { formatDateTime } from "../../../lib/utils/format";
import type { BuyerActionsSummaryCard, Location, Sku } from "../types";

interface BuyerActionsSummarySectionProps {
  cards: BuyerActionsSummaryCard[];
  freshnessAt: string | null;
  scope: {
    sku: Sku | null;
    location: Location | null;
  };
}

const toneClasses: Record<BuyerActionsSummaryCard["tone"], string> = {
  critical: "border-red-200 bg-red-50",
  warning: "border-amber-200 bg-amber-50",
  positive: "border-pine/20 bg-pine/10",
  neutral: "border-black/8 bg-white",
};

export const BuyerActionsSummarySection = ({
  cards,
  freshnessAt,
  scope,
}: BuyerActionsSummarySectionProps): JSX.Element => (
  <section className="rounded-[28px] border border-black/8 bg-white px-5 py-5 shadow-panel">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div className="max-w-4xl">
        <p className="text-xs uppercase tracking-[0.28em] text-steel">Buyer posture</p>
        <h3 className="mt-2 text-3xl font-semibold text-ink">Actionable purchase order queue</h3>
        <p className="mt-2 text-sm leading-6 text-steel">
          Move from monitoring into safe supply-side operations using only the purchase-order lifecycle mutations the
          backend exposes today.
        </p>
      </div>

      <div className="rounded-[24px] border border-black/8 bg-mist px-4 py-4 text-sm text-steel">
        <p className="text-xs uppercase tracking-[0.15em] text-steel">Current scope</p>
        <p className="mt-2 font-semibold text-ink">
          {scope.sku && scope.location
            ? `${scope.sku.skuCode} - ${scope.sku.name} @ ${scope.location.code} - ${scope.location.name}`
            : "All purchase orders in the active organization"}
        </p>
        <p className="mt-2">
          {freshnessAt
            ? `Fresh as of ${formatDateTime(freshnessAt)}`
            : "Freshness timestamp is not exposed for the current selection."}
        </p>
      </div>
    </div>

    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
      {cards.map((card) => (
        <div key={card.id} className={`rounded-[24px] border px-4 py-4 ${toneClasses[card.tone]}`}>
          <p className="text-xs uppercase tracking-[0.14em] text-steel">{card.label}</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{card.value}</p>
          <p className="mt-2 text-sm leading-6 text-steel">{card.helper}</p>
        </div>
      ))}
    </div>
  </section>
);
