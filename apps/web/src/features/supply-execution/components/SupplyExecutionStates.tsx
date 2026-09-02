export const SupplyExecutionEmptyState = ({
  title,
  message,
}: {
  title: string;
  message: string;
}): JSX.Element => (
  <section className="rounded-[28px] border border-dashed border-black/12 bg-white px-6 py-8 shadow-panel">
    <h3 className="text-2xl font-semibold text-ink">{title}</h3>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-steel">{message}</p>
  </section>
);

export const SupplyExecutionErrorNotice = ({
  title,
  message,
}: {
  title: string;
  message: string;
}): JSX.Element => (
  <div className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-panel">
    <p className="font-semibold">{title}</p>
    <p className="mt-2 leading-6">{message}</p>
  </div>
);

export const SupplyExecutionSectionSkeleton = ({
  rows = 4,
}: {
  rows?: number;
}): JSX.Element => (
  <section className="rounded-[28px] border border-black/8 bg-white px-5 py-5 shadow-panel">
    <div className="h-5 w-28 animate-pulse rounded-full bg-black/8" />
    <div className="mt-4 h-9 w-72 animate-pulse rounded-full bg-black/8" />
    <div className="mt-6 space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-16 animate-pulse rounded-[20px] bg-black/6" />
      ))}
    </div>
  </section>
);

export const PartialDataNotice = ({
  title,
  message,
}: {
  title: string;
  message: string;
}): JSX.Element => (
  <div className="rounded-2xl border border-dashed border-black/10 bg-mist px-4 py-4 text-sm text-steel">
    <p className="font-semibold text-ink">{title}</p>
    <p className="mt-2 leading-6">{message}</p>
  </div>
);
