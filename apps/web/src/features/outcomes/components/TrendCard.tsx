import type { TrendCardData } from "../types";
import { Sparkline } from "./Sparkline";
import { SectionCard } from "../../../components/ui/SectionCard";
import { EmptyState } from "../../../components/ui/EmptyState";

interface TrendCardProps {
  trend: TrendCardData;
}

export const TrendCard = ({ trend }: TrendCardProps): JSX.Element => (
  <SectionCard>
    <p className="ui-section-label">{trend.title}</p>
    <h3 className="mt-1 text-2xl font-semibold text-ink tabular-nums">{trend.valueLabel}</h3>
    <p className="mt-1.5 text-sm text-steel">{trend.subtitle}</p>
    {trend.deltaLabel ? <p className="mt-1.5 text-sm font-semibold text-teal-600">{trend.deltaLabel}</p> : null}

    {trend.series.length > 0 ? (
      <div className="mt-5">
        <Sparkline series={trend.series} />
        <div className="mt-3 flex items-center justify-between text-xs tracking-wider uppercase text-ash">
          <span>{trend.series[0]?.label}</span>
          <span>{trend.series[trend.series.length - 1]?.label}</span>
        </div>
      </div>
    ) : (
      <div className="mt-5">
        <EmptyState title="Not enough data" message={trend.emptyMessage} />
      </div>
    )}
  </SectionCard>
);
