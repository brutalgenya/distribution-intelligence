import {
  formatIntegrationType,
  getConnectionConfigHelp,
} from "../selectors";
import type {
  ConnectionEditorState,
  ConnectionRow,
  IntegrationActionFeedback,
} from "../types";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { uiButtonPrimaryClassName, uiButtonSecondaryClassName, uiInputClassName } from "../../../components/ui/classes";
import { StatusChip } from "../../../components/ui/StatusChip";

interface ConnectionEditorSectionProps {
  selectedConnection: ConnectionRow | null;
  draft: ConnectionEditorState;
  pending: boolean;
  feedback: IntegrationActionFeedback | null;
  onFieldChange: <K extends keyof ConnectionEditorState>(
    field: K,
    value: ConnectionEditorState[K],
  ) => void;
  onSubmit: () => void;
  onResetToCreate: () => void;
}

export const ConnectionEditorSection = ({
  selectedConnection,
  draft,
  pending,
  feedback,
  onFieldChange,
  onSubmit,
  onResetToCreate,
}: ConnectionEditorSectionProps): JSX.Element => {
  const isEditMode = selectedConnection !== null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
      label="Configuration"
          title={isEditMode ? "Configure connection" : "Create connection"}
          description="Use the real connection create and update APIs. The backend owns config validation, stored status, and credentials reference handling."
        />

        {isEditMode ? (
          <button
            type="button"
            onClick={onResetToCreate}
            className={uiButtonSecondaryClassName}
          >
            Switch to create mode
          </button>
        ) : null}
      </div>

      <SectionCard>
        {feedback ? (
          <div className="mb-6 rounded-radius-md border border-slate-100 bg-slate-50 p-4 text-sm text-steel shadow-sm">
            <p className="font-semibold text-ink">{feedback.title}</p>
            <p className="mt-1.5 leading-relaxed">{feedback.message}</p>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-1">
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Connection name</span>
            <input
              value={draft.name}
              onChange={(event) => onFieldChange("name", event.target.value)}
              placeholder="Acme ERP"
              className={`w-full ${uiInputClassName}`}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Integration type</span>
            <select
              value={draft.integrationType}
              disabled={isEditMode}
              onChange={(event) =>
                onFieldChange("integrationType", event.target.value as ConnectionEditorState["integrationType"])
              }
              className={`w-full ${uiInputClassName} disabled:cursor-not-allowed disabled:bg-slate-50`}
            >
              <option value="erp">ERP</option>
              <option value="wms">WMS</option>
              <option value="csv_import">CSV import</option>
              <option value="manual_bridge">Manual bridge</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Status</span>
            <select
              value={draft.status}
              onChange={(event) =>
                onFieldChange("status", event.target.value as ConnectionEditorState["status"])
              }
              className={`w-full ${uiInputClassName}`}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="error">Error</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Credentials ref</span>
            <input
              value={draft.credentialsRef}
              onChange={(event) => onFieldChange("credentialsRef", event.target.value)}
              placeholder="vault://customer/acme/erp"
              className={`w-full ${uiInputClassName}`}
            />
          </label>
        </div>

        <div className="mt-8 rounded-radius-md border border-slate-200/60 bg-slate-50/50 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-ink">Config fields</p>
              <p className="mt-1.5 text-sm leading-relaxed text-steel">
                {formatIntegrationType(draft.integrationType)} configuration uses only the fields the backend schema currently exposes.
              </p>
            </div>
            {(draft.integrationType === "erp" || draft.integrationType === "wms") ? (
              <StatusChip tone="neutral">
                Adapter mode fixed to fake
              </StatusChip>
            ) : null}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2 2xl:grid-cols-1">
            {draft.integrationType === "erp" ? (
              <>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-ink">Endpoint base URL</span>
                  <input
                    value={draft.endpointBaseUrl}
                    onChange={(event) => onFieldChange("endpointBaseUrl", event.target.value)}
                    placeholder="https://erp.example.com"
                    className={`w-full ${uiInputClassName}`}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-ink">External system code</span>
                  <input
                    value={draft.externalSystemCode}
                    onChange={(event) => onFieldChange("externalSystemCode", event.target.value)}
                    placeholder="acme-erp"
                    className={`w-full ${uiInputClassName}`}
                  />
                </label>
              </>
            ) : null}

            {draft.integrationType === "wms" ? (
              <>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-ink">Endpoint base URL</span>
                  <input
                    value={draft.endpointBaseUrl}
                    onChange={(event) => onFieldChange("endpointBaseUrl", event.target.value)}
                    placeholder="https://wms.example.com"
                    className={`w-full ${uiInputClassName}`}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-ink">Warehouse group</span>
                  <input
                    value={draft.warehouseGroup}
                    onChange={(event) => onFieldChange("warehouseGroup", event.target.value)}
                    placeholder="north-region"
                    className={`w-full ${uiInputClassName}`}
                  />
                </label>
              </>
            ) : null}

            {draft.integrationType === "csv_import" ? (
              <>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-ink">Delimiter</span>
                  <input
                    value={draft.delimiter}
                    onChange={(event) => onFieldChange("delimiter", event.target.value)}
                    placeholder=","
                    maxLength={1}
                    className={`w-full ${uiInputClassName}`}
                  />
                </label>
                <label className="flex items-center gap-3 rounded-radius-md border border-slate-200/60 bg-white px-4 py-3 shadow-sm">
                  <input
                    type="checkbox"
                    checked={draft.hasHeaderRow}
                    onChange={(event) => onFieldChange("hasHeaderRow", event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-pine focus:ring-pine"
                  />
                  <span className="text-sm font-medium text-ink">CSV has a header row</span>
                </label>
              </>
            ) : null}

            {draft.integrationType === "manual_bridge" ? (
              <label className="space-y-2 lg:col-span-2 2xl:col-span-1">
                <span className="text-sm font-medium text-ink">Source label</span>
                <input
                  value={draft.sourceLabel}
                  onChange={(event) => onFieldChange("sourceLabel", event.target.value)}
                  placeholder="Partner onboarding spreadsheet"
                  className={`w-full ${uiInputClassName}`}
                />
              </label>
            ) : null}
          </div>

          <p className="mt-6 text-sm leading-relaxed text-steel">{getConnectionConfigHelp(draft.integrationType)}</p>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-6 border-t border-slate-200/60 pt-6">
          <p className="max-w-3xl text-sm leading-relaxed text-steel">
            Secret entry, credential validation, and connection test flows are not exposed by the backend today. This workspace only manages the safe metadata and reference fields that the current APIs accept.
          </p>
          <button
            type="button"
            onClick={onSubmit}
            disabled={pending}
            className={`${uiButtonPrimaryClassName} justify-center disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            {pending
              ? isEditMode
                ? "Saving..."
                : "Creating..."
              : isEditMode
                ? "Save connection"
                : "Create connection"}
          </button>
        </div>
      </SectionCard>
    </section>
  );
};
