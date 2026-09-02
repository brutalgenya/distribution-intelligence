import { MetricCard } from "../../../components/ui/MetricCard";
import type { MetricCardItem } from "../types";

interface MetricCardGridProps {
  items: MetricCardItem[];
}

export const MetricCardGrid = ({ items }: MetricCardGridProps): JSX.Element => (
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
    {items.map((item) => (
      <MetricCard
        key={item.id}
        label={item.label}
        value={item.value}
        helper={item.helper}
        deltaLabel={item.deltaLabel}
        tone={item.tone}
      />
    ))}
  </div>
);
