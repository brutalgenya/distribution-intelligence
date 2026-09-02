import { AuditTimeline } from "../../../components/ui/AuditTimeline";
import { EmptyState } from "../../../components/ui/EmptyState";
import { SectionBlock } from "../../../components/ui/SectionBlock";
import type { CommandCenterRecentActivityItem } from "../types";

const toneMap: Record<
  CommandCenterRecentActivityItem["tone"],
  "critical" | "warning" | "positive" | "neutral" | "info"
> = {
  critical: "critical",
  warning: "warning",
  positive: "positive",
  neutral: "neutral",
};

interface RecentActivitySectionProps {
  items: CommandCenterRecentActivityItem[];
}

export const RecentActivitySection = ({
  items,
}: RecentActivitySectionProps): JSX.Element => (
  <SectionBlock
    label="System Ledger"
    title="Recent activity"
    description="Latest changes across onboarding, forecast, workflow, supply, and support."
  >
    <AuditTimeline
      items={items.map((item) => ({
        id: item.id,
        eyebrow: item.categoryLabel,
        title: item.title,
        description: item.description,
        timestamp: item.timestamp,
        href: item.href,
        linkLabel: item.linkLabel,
        tone: toneMap[item.tone],
      }))}
      empty={
        <EmptyState
          title="No recent activity"
          message="The backend did not return recent cross-system activity for this tenant."
        />
      }
    />
  </SectionBlock>
);
