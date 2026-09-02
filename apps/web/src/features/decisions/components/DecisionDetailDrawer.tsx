import {
  uiDrawerBackdropClassName,
  uiDrawerSurfaceClassName,
} from "../../../components/ui/classes";
import { DecisionDetailContent } from "./DecisionDetailContent";

interface DecisionDetailDrawerProps {
  decisionId: string | null;
  onClose: () => void;
}

export const DecisionDetailDrawer = ({
  decisionId,
  onClose,
}: DecisionDetailDrawerProps): JSX.Element | null => {
  if (decisionId === null) {
    return null;
  }

  return (
    <div className={uiDrawerBackdropClassName}>
      <div className={`${uiDrawerSurfaceClassName} max-w-[44rem]`}>
        <DecisionDetailContent decisionId={decisionId} mode="drawer" onClose={onClose} />
      </div>
    </div>
  );
};
