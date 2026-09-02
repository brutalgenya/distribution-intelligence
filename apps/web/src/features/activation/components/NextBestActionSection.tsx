import { Link } from "react-router-dom";
import type { NextBestAction } from "../types";
import { PageHeader } from "../../../components/ui/PageHeader";
import { uiButtonClassName } from "../../../components/ui/classes";

const toneClassNames: Record<NextBestAction["tone"], string> = {
  positive: "border-teal-200/50 bg-teal-50/30 text-teal-900",
  critical: "border-rose-200/50 bg-rose-50/30 text-rose-900",
  warning: "border-amber-200/50 bg-amber-50/30 text-amber-900",
  neutral: "border-slate-200/60 bg-white text-ink",
};

interface NextBestActionSectionProps {
  action: NextBestAction;
  pending: boolean;
  onTrigger: () => void;
}

export const NextBestActionSection = ({
  action,
  pending,
  onTrigger,
}: NextBestActionSectionProps): JSX.Element => (
  <section className="space-y-4">
    <PageHeader
      label="Recommended action"
      title="Next best action"
      description="This is the highest-priority next step the UI can recommend from the current server-backed activation evidence."
    />

    <article className={`ui-panel transition-colors duration-300 ${toneClassNames[action.tone]}`}>
      <h4 className="text-2xl font-semibold tracking-tight">{action.title}</h4>
      <p className="mt-3 max-w-4xl text-sm leading-relaxed opacity-90">{action.description}</p>

      {action.buttonLabel ? (
        action.kind === "link" && action.href ? (
          action.href.startsWith("/") ? (
             <Link
              to={action.href}
              className={`mt-6 inline-flex ${uiButtonClassName} shadow-sm bg-white/50 text-ink border border-current/20 hover:bg-white`}
            >
              {action.buttonLabel}
            </Link>
          ) : (
            <a
              href={action.href}
              className={`mt-6 inline-flex ${uiButtonClassName} shadow-sm bg-white/50 text-ink border border-current/20 hover:bg-white`}
            >
              {action.buttonLabel}
            </a>
          )
        ) : (
          <button
            type="button"
            onClick={onTrigger}
            disabled={pending}
            className={`mt-6 ${uiButtonClassName} shadow-sm bg-white/50 text-ink border border-current/20 hover:bg-white disabled:bg-white/30 disabled:border-current/10`}
          >
            {pending ? "Working..." : action.buttonLabel}
          </button>
        )
      ) : null}
    </article>
  </section>
);
