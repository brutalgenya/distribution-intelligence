
import { formatDateTime } from "../../../lib/utils/format";
import type {
  SupportActionSummaryCard,
  SupportActionableItem,
} from "../types";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { EmptyState } from "../../../components/ui/EmptyState";

interface ActionableQueueSectionProps {
  cards: SupportActionSummaryCard[];
  items: SupportActionableItem[];
  selectedExecutionId: string | null;
  selectedForecastJobId: string | null;
  selectedSyncRunId: string | null;
  onSelectItem: (item: SupportActionableItem) => void;
}

const toneClassNames: Record<SupportActionSummaryCard["tone"], string> = {
  critical: "border-rose-200/50 bg-rose-50/50 text-rose-700",
  warning: "border-amber-200/50 bg-amber-50/50 text-amber-700",
  positive: "border-emerald-200/50 bg-emerald-50/50 text-emerald-700",
  neutral: "border-slate-200/60 bg-slate-50 text-steel",
};

const formatSourceType = (value: SupportActionableItem["sourceType"]): string => {
  switch (value) {
    case "execution":
      return "Execution";
    case "forecast":
      return "Forecast";
    case "sync":
      return "Sync";
    case "failed_record":
      return "Failed record";
  }
};

const isSelected = (
  item: SupportActionableItem,
  selectedExecutionId: string | null,
  selectedForecastJobId: string | null,
  selectedSyncRunId: string | null,
): boolean =>
  item.executionId === selectedExecutionId ||
  item.forecastJobId === selectedForecastJobId ||
  item.syncRunId === selectedSyncRunId;

export const ActionableQueueSection = ({
  cards,
  items,
  selectedExecutionId,
  selectedForecastJobId,
  selectedSyncRunId,
  onSelectItem,
}: ActionableQueueSectionProps): JSX.Element => (
  <section className="space-y-4 w-full flex flex-col items-stretch">
    <PageHeader
      label="Support queue"
      title="Actionable operational queue"
      description="Move from diagnosis into safe remediation. This queue only surfaces items the backend already exposes for support action, plus failed-record blockers where recovery is not yet exposed."
    />

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.id} className={`rounded-radius-md border px-5 py-5 shadow-sm ${toneClassNames[card.tone]}`}>
          <p className="text-[10px] uppercase font-bold tracking-widest opacity-80">{card.label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">{card.value}</p>
          <p className="mt-3 text-sm leading-relaxed opacity-85">{card.helper}</p>
        </div>
      ))}
    </div>

    <SectionCard padding="none">
      <div className="border-b border-slate-200/60 px-6 py-5 bg-slate-50/50">
        <p className="ui-section-label mb-1">Review</p>
        <h4 className="text-xl font-semibold tracking-tight text-ink">Items ready for operator action</h4>
      </div>

      {items.length > 0 ? (
        <div className="custom-scrollbar overflow-x-auto pb-4">
          <table className="min-w-full border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200/60 text-left text-[10px] uppercase font-bold tracking-widest text-steel">
              <tr>
                <th className="px-5 py-4 whitespace-nowrap">Source</th>
                <th className="px-5 py-4 whitespace-nowrap">Item</th>
                <th className="px-5 py-4 whitespace-nowrap">Status</th>
                <th className="px-5 py-4 whitespace-nowrap">Latest issue</th>
                <th className="px-5 py-4 whitespace-nowrap">Available action</th>
                <th className="px-5 py-4 whitespace-nowrap">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr
                  key={item.key}
                  className={[
                    "cursor-pointer transition-colors duration-200 hover:bg-slate-50",
                    isSelected(item, selectedExecutionId, selectedForecastJobId, selectedSyncRunId)
                      ? "bg-slate-50/80 ring-1 ring-inset ring-slate-200/60"
                      : "bg-white",
                  ].join(" ")}
                  onClick={() => onSelectItem(item)}
                >
                  <td className="px-5 py-4 align-top">
                    <span className="inline-flex items-center rounded-radius-sm bg-slate-100 px-2 py-0.5 text-xs font-semibold text-ink">
                      {formatSourceType(item.sourceType)}
                    </span>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <p className="font-semibold text-ink break-all font-mono">{item.title}</p>
                    <p className="mt-1 text-sm text-steel break-all max-w-xs">{item.primaryReference}</p>
                    {item.secondaryReference ? (
                      <p className="mt-1 text-sm text-steel break-all max-w-xs">{item.secondaryReference}</p>
                    ) : null}
                  </td>
                  <td className="px-5 py-4 align-top text-sm font-medium text-ink">{item.statusLabel}</td>
                  <td className="max-w-sm px-5 py-4 align-top text-sm leading-relaxed text-steel">
                    {item.errorSummary ?? "No failure message persisted."}
                  </td>
                  <td className="px-5 py-4 align-top text-sm font-medium text-ink">
                    {item.availableActionLabel ?? (
                      <span className="font-normal text-steel opacity-80">{item.unsupportedReason ?? "No supported action"}</span>
                    )}
                  </td>
                  <td className="px-5 py-4 align-top text-sm text-ink whitespace-nowrap">{formatDateTime(item.updatedAt ?? item.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-8">
           <div className="bg-slate-50 rounded-radius-md p-6 border border-slate-200/60 shadow-sm text-center">
              <EmptyState title="No items" message="No action-ready operational items are currently exposed for the selected scope." />
           </div>
        </div>
      )}
    </SectionCard>
  </section>
);
