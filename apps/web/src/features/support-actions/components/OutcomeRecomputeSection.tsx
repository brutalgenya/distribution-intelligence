import { useState } from "react";

import { formatDateTime, formatNumber } from "../../../lib/utils/format";
import type { OutcomeRecomputeResult } from "../types";
import { SectionCard } from "../../../components/ui/SectionCard";
import { DataField } from "../../../components/ui/DataField";

interface OutcomeRecomputeSectionProps {
  initialStartDate: string;
  initialEndDate: string;
  isPending: boolean;
  onSubmit: (input: { startDate: string; endDate: string }) => Promise<void> | void;
  lastResult: OutcomeRecomputeResult | null;
}

export const OutcomeRecomputeSection = ({
  initialStartDate,
  initialEndDate,
  isPending,
  onSubmit,
  lastResult,
}: OutcomeRecomputeSectionProps): JSX.Element => {
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);

  return (
    <SectionCard>
        <p className="ui-section-label mb-1">Outcome recompute</p>
      <h3 className="text-2xl font-semibold tracking-tight text-ink">Outcome recompute</h3>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-steel">
        Re-run the explicit outcomes window the backend exposes for support operations. The current contract requires a
        bounded date range and caps the measurement window at 90 days.
      </p>

      <form
        className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_0.9fr_auto] 2xl:grid-cols-1"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit({ startDate, endDate });
        }}
      >
        <label>
          <span className="text-sm font-semibold text-ink">Window start</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="mt-2 w-full rounded-radius-md border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition-colors duration-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-sm"
          />
        </label>
        <label>
          <span className="text-sm font-semibold text-ink">Window end</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="mt-2 w-full rounded-radius-md border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition-colors duration-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-sm"
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={isPending || !startDate || !endDate}
            className="w-full rounded-radius-md bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none whitespace-nowrap h-[46px]"
          >
            {isPending ? "Recomputing..." : "Recompute outcomes"}
          </button>
        </div>
      </form>

      {lastResult ? (
        <div className="mt-8 grid gap-4 border-t border-slate-200/60 pt-8 sm:grid-cols-2 lg:grid-cols-5 2xl:grid-cols-2">
           <div className="rounded-radius-md border border-slate-100 bg-slate-50/50 p-4 lg:col-span-2 2xl:col-span-2">
              <DataField label="Measurement window" value={<span className="font-semibold text-ink">{formatDateTime(lastResult.measurementWindowStart)} to {formatDateTime(lastResult.measurementWindowEnd)}</span>} />
           </div>
           <div className="rounded-radius-md bg-slate-50/50 p-4 border border-slate-100">
              <DataField label="Stockouts" value={<span className="text-xl font-bold tracking-tight text-ink">{formatNumber(lastResult.stockoutCount)}</span>} />
           </div>
           <div className="rounded-radius-md bg-slate-50/50 p-4 border border-slate-100">
              <DataField label="Fill-rate windows" value={<span className="text-xl font-bold tracking-tight text-ink">{formatNumber(lastResult.fillRateCount)}</span>} />
           </div>
           <div className="rounded-radius-md bg-slate-50/50 p-4 border border-slate-100">
              <DataField label="Forecast errors" value={<span className="text-xl font-bold tracking-tight text-ink">{formatNumber(lastResult.forecastErrorCount)}</span>} />
           </div>
        </div>
      ) : null}
    </SectionCard>
  );
};
