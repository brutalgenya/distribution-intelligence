import { SectionCard } from "../../../components/ui/SectionCard";
import type { Decision } from "../types";
import { DecisionListItem } from "./DecisionListItem";

interface DecisionListProps {
  decisions: Decision[];
  selectedDecisionId: string | null;
  onSelect: (decisionId: string) => void;
}

export const DecisionList = ({
  decisions,
  selectedDecisionId,
  onSelect,
}: DecisionListProps): JSX.Element => (
  <SectionCard className="space-y-3">
    {decisions.map((decision) => (
      <DecisionListItem
        key={decision.id}
        decision={decision}
        selected={selectedDecisionId === decision.id}
        onSelect={onSelect}
      />
    ))}
  </SectionCard>
);
