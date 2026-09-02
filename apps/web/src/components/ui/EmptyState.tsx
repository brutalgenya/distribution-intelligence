interface EmptyStateProps {
  title: string;
  message: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const EmptyState = ({
  title,
  message,
  icon,
  action,
}: EmptyStateProps): JSX.Element => (
  <div className="ui-empty animate-fade-in">
    {icon ? <div className="mb-4 flex justify-center text-ash">{icon}</div> : null}
    <p className="ui-section-label">No data available</p>
    <h3 className="mt-2 text-heading text-ink">{title}</h3>
    <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-steel">{message}</p>
    {action ? <div className="mt-5">{action}</div> : null}
  </div>
);
