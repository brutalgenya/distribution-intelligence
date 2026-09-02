import { Link } from "react-router-dom";

import { formatDateTime } from "../../../lib/utils/format";
import { MetricCardGrid } from "../../outcomes/components/MetricCardGrid";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusChip } from "../../../components/ui/StatusChip";
import type { CommandCenterSnapshot } from "../types";

const toneMap: Record<CommandCenterSnapshot["tone"], string> = {
  positive: "bg-[rgba(237,246,240,0.48)]",
  critical: "bg-[rgba(255,241,239,0.62)]",
  warning: "bg-[rgba(255,243,227,0.7)]",
  neutral: "bg-white",
};

interface AudienceSnapshotSectionProps {
  snapshot: CommandCenterSnapshot;
}

export const AudienceSnapshotSection = ({
  snapshot,
}: AudienceSnapshotSectionProps): JSX.Element => (
  <SectionCard className={toneMap[snapshot.tone]}>
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div className="max-w-3xl">
        <div className="flex flex-wrap items-center gap-2">
          <p className="ui-section-label">{snapshot.eyebrow}</p>
          {snapshot.currentRolePriority ? <StatusChip tone="info">Current priority</StatusChip> : null}
        </div>
        <h3 className="mt-2 text-heading text-ink">{snapshot.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-steel">{snapshot.description}</p>
        <p className="mt-2 text-xs text-ash">
          {snapshot.freshnessAt ? `Updated ${formatDateTime(snapshot.freshnessAt)}` : "Freshness not available"}
        </p>

        {snapshot.highlights.length > 0 ? (
          <ul className="mt-4 space-y-2 text-sm text-steel">
            {snapshot.highlights.map((highlight) => (
              <li key={highlight} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-secondary/45" />
                <span>{highlight}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 xl:justify-end">
        {snapshot.links.map((link) => (
          <Link key={`${snapshot.key}-${link.href}-${link.label}`} to={link.href} className="ui-button ui-button-secondary text-xs">
            {link.label}
          </Link>
        ))}
      </div>
    </div>

    <div className="mt-5">
      <MetricCardGrid items={snapshot.cards} />
    </div>
  </SectionCard>
);
