import { useEffect, useState } from "react";
import { uiButtonSecondaryClassName } from "../../../components/ui/classes";

interface ActionConfirmationDialogProps {
  open: boolean;
  eyebrow?: string;
  title: string;
  description: string;
  confirmLabel: string;
  pending: boolean;
  tone?: "default" | "critical";
  showReasonInput?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}

export const ActionConfirmationDialog = ({
  open,
  eyebrow = "Confirm support action",
  title,
  description,
  confirmLabel,
  pending,
  tone = "default",
  showReasonInput = false,
  reasonLabel = "Reason",
  reasonPlaceholder = "Optional context for the audit trail.",
  onClose,
  onConfirm,
}: ActionConfirmationDialogProps): JSX.Element | null => {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) {
      setReason("");
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-radius-lg border border-slate-200 bg-white p-6 shadow-xl relative animate-in fade-in zoom-in duration-200">
        <p className="text-[10px] sm:text-xs uppercase tracking-widest text-steel font-bold">{eyebrow}</p>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-steel">{description}</p>

        {showReasonInput ? (
          <label className="mt-5 block">
            <span className="text-sm font-semibold text-ink">{reasonLabel}</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              placeholder={reasonPlaceholder}
              className="mt-2 w-full rounded-radius-md border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition-colors duration-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-sm"
            />
          </label>
        ) : null}

        <div className="mt-8 flex flex-wrap justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className={`${uiButtonSecondaryClassName} disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            Keep as-is
          </button>
          <button
            type="button"
            onClick={() => {
              void onConfirm(reason.trim());
            }}
            disabled={pending}
            className={`rounded-radius-md px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none ${
              tone === "critical"
                ? "bg-rose-600 hover:bg-rose-700 focus:ring-rose-500"
                : "bg-slate-900 hover:bg-slate-800 focus:ring-slate-900"
            }`}
          >
            {pending ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
