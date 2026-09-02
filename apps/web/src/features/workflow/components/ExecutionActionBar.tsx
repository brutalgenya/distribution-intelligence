import {
  uiButtonPrimaryClassName,
  uiButtonSecondaryClassName,
} from "../../../components/ui/classes";

interface ExecutionActionBarProps {
  canRetry: boolean;
  canCancel: boolean;
  isPending: boolean;
  onRefresh: () => void;
  onRetry: () => void;
  onCancel: () => void;
}

export const ExecutionActionBar = ({
  canRetry,
  canCancel,
  isPending,
  onRefresh,
  onRetry,
  onCancel,
}: ExecutionActionBarProps): JSX.Element => (
  <div className="flex flex-wrap gap-3">
    <button
      type="button"
      onClick={onRefresh}
      disabled={isPending}
      className={uiButtonSecondaryClassName}
    >
      Refresh state
    </button>

    {canRetry ? (
      <button
        type="button"
        onClick={onRetry}
        disabled={isPending}
        className={uiButtonPrimaryClassName}
      >
        Retry execution
      </button>
    ) : null}

    {canCancel ? (
      <button
        type="button"
        onClick={onCancel}
        disabled={isPending}
        className={uiButtonSecondaryClassName}
      >
        Cancel task
      </button>
    ) : null}
  </div>
);
