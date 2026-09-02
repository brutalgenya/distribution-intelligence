interface DataFieldProps {
  label: string;
  value?: React.ReactNode;
  children?: React.ReactNode;
}

export const DataField = ({
  label,
  value,
  children,
}: DataFieldProps): JSX.Element => (
  <div className="rounded-radius-md border border-slate-200/70 bg-white/86 px-4 py-3 shadow-sm">
    <dt className="ui-field-label">{label}</dt>
    <dd className="ui-field-value">{value ?? children}</dd>
  </div>
);
