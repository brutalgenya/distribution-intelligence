import { formatDateTime, formatNumber } from "../../../lib/utils/format";
import { DataField } from "../../../components/ui/DataField";
import { EmptyState } from "../../../components/ui/EmptyState";
import { SectionCard } from "../../../components/ui/SectionCard";
import type { InvestigationContextData } from "../types";

interface InventoryStateSectionProps {
  context: InvestigationContextData;
}

export const InventoryStateSection = ({ context }: InventoryStateSectionProps): JSX.Element => (
  <SectionCard>
    <p className="ui-section-label">Inventory Real-Time State</p>
    <h4 className="mt-1 text-subheading text-ink">Current persisted position</h4>
    <p className="mt-1.5 text-sm leading-relaxed text-steel">
      Current persisted inventory position for this SKU/location scope.
    </p>

    {context.position ? (
      <>
        <div className="mt-6 grid gap-4 grid-cols-2 xl:grid-cols-3">
          <DataField label="On hand" value={formatNumber(context.position.onHandQty)} />
          <DataField label="Reserved" value={formatNumber(context.position.reservedQty)} />
          <DataField label="Available to promise" value={formatNumber(context.position.availableToPromiseQty)} />
          <DataField label="In transit" value={formatNumber(context.position.inTransitQty)} />
          <DataField label="Safety stock" value={formatNumber(context.position.safetyStockQty)} />
          <DataField label="Reorder point" value={formatNumber(context.position.reorderPointQty)} />
        </div>

        <dl className="mt-8 grid gap-4 border-t border-slate-200/60 pt-6 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wider text-steel">Position updated</dt>
            <dd className="mt-1 text-sm font-medium text-ink">{formatDateTime(context.position.updatedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-steel">Position id</dt>
            <dd className="mt-1 break-all text-sm font-medium text-ink">{context.position.id}</dd>
          </div>
        </dl>
      </>
    ) : (
      <div className="mt-6">
        <EmptyState
          title="No position"
          message="No persisted inventory position is currently exposed for this SKU/location scope."
        />
      </div>
    )}
  </SectionCard>
);
