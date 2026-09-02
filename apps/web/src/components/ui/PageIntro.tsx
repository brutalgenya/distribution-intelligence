import clsx from "clsx";

interface PageIntroProps {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}

export const PageIntro = ({
  eyebrow,
  title,
  description,
  actions,
  meta,
  className,
}: PageIntroProps): JSX.Element => (
  <section className={clsx("grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto]", className)}>
    <div className="min-w-0">
      {eyebrow ? <p className="ui-page-kicker">{eyebrow}</p> : null}
      <h1 className="ui-page-title">{title}</h1>
      <p className="ui-page-desc">{description}</p>
      {meta ? <div className="mt-5">{meta}</div> : null}
    </div>

    {actions ? <div className="flex flex-wrap items-start gap-3 xl:justify-end">{actions}</div> : null}
  </section>
);
