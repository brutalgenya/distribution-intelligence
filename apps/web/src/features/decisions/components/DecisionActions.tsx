import {
  uiButtonPrimaryClassName,
  uiButtonSecondaryClassName,
} from "../../../components/ui/classes";

interface DecisionActionsProps {
  canRequestApproval: boolean;
  canApproveOrReject: boolean;
  isPending: boolean;
  onRequestApproval: () => void;
  onApprove: () => void;
  onReject: () => void;
}

export const DecisionActions = ({
  canRequestApproval,
  canApproveOrReject,
  isPending,
  onRequestApproval,
  onApprove,
  onReject,
}: DecisionActionsProps): JSX.Element | null => {
  if (!canRequestApproval && !canApproveOrReject) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-3">
      {canRequestApproval ? (
        <button
          type="button"
          onClick={onRequestApproval}
          disabled={isPending}
          className={uiButtonPrimaryClassName}
        >
          Request approval
        </button>
      ) : null}

      {canApproveOrReject ? (
        <>
          <button
            type="button"
            onClick={onApprove}
            disabled={isPending}
            className={uiButtonPrimaryClassName}
          >
            Approve
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={isPending}
            className={uiButtonSecondaryClassName}
          >
            Reject
          </button>
        </>
      ) : null}
    </div>
  );
};
