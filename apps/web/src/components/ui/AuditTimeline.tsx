import { Link } from "react-router-dom";

import { formatDateTime } from "../../lib/utils/format";

type TimelineTone = "critical" | "warning" | "positive" | "neutral" | "info";

export interface AuditTimelineItem {
  id: string;
  eyebrow?: string;
  title: string;
  description: string;
  timestamp?: string | null;
  tone?: TimelineTone;
  href?: string | null;
  linkLabel?: string | null;
  trailing?: React.ReactNode;
}

interface AuditTimelineProps {
  items: AuditTimelineItem[];
  empty?: React.ReactNode;
}

export const AuditTimeline = ({ items, empty }: AuditTimelineProps): JSX.Element => {
  if (items.length === 0) {
    return <>{empty}</>;
  }

  return (
    <div className="ui-timeline space-y-4">
      {items.map((item) => (
        <article key={item.id} className="ui-timeline-item">
          <span className="ui-timeline-dot" data-tone={item.tone ?? "neutral"} />
          <div className="rounded-radius-lg border border-slate-200/70 bg-white/92 p-4 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {item.eyebrow ? <p className="ui-section-label">{item.eyebrow}</p> : null}
                  {item.timestamp ? (
                    <span className="text-xs text-ash">{formatDateTime(item.timestamp)}</span>
                  ) : null}
                </div>
                <h3 className="mt-1.5 text-sm font-semibold text-ink">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-steel">{item.description}</p>
              </div>

              {item.trailing ? <div className="flex-shrink-0">{item.trailing}</div> : null}
            </div>

            {item.href && item.linkLabel ? (
              <div className="mt-4">
                <Link to={item.href} className="ui-button ui-button-secondary text-xs">
                  {item.linkLabel}
                </Link>
              </div>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
};
