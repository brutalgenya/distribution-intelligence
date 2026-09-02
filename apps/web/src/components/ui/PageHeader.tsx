interface PageHeaderProps {
  label?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  extra?: React.ReactNode;
  children?: React.ReactNode;
}

export const PageHeader = ({
  label,
  title,
  description,
  actions,
  extra,
  children,
}: PageHeaderProps): JSX.Element => (
  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
    <div className="min-w-0">
      {label ? <p className="ui-section-label">{label}</p> : null}
      <h3 className="ui-section-title">{title}</h3>
      {description ? <p className="ui-section-desc">{description}</p> : null}
    </div>

    {(actions || extra || children) ? (
      <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
        {actions || extra || children}
      </div>
    ) : null}
  </div>
);
