import { getAuditMetadataLabel } from "../selectors";
import type { GovernanceAuditItem } from "../types";

interface GovernanceAuditSectionProps {
  items: GovernanceAuditItem[];
}

export const GovernanceAuditSection = ({
  items,
}: GovernanceAuditSectionProps): JSX.Element => (
  <section className="rounded-[28px] border border-black/8 bg-white p-5 shadow-panel">
    <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-steel">Audit feed</p>
        <h3 className="mt-2 text-3xl font-semibold text-ink">Governance audit</h3>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-steel">
          Recent approval and override audit evidence from the support timeline. Actor identity is only shown where the backend DTO exposes it, so this audit stream focuses on what changed and when.
        </p>
      </div>
    </div>

    {items.length > 0 ? (
      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <details key={item.id} className="rounded-2xl bg-mist px-4 py-4">
            <summary className="cursor-pointer list-none">
              <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink">{item.title}</p>
                  <p className="mt-1 text-sm text-steel">{getAuditMetadataLabel(item)}</p>
                </div>
                <p className="text-sm text-steel">
                  {item.correlationId ? `Correlation ${item.correlationId}` : "No correlation id"}
                </p>
              </div>
            </summary>
            <p className="mt-4 text-sm leading-6 text-steel">{item.description}</p>
            <pre className="mt-4 overflow-x-auto rounded-2xl bg-ink p-3 text-xs text-cloud">
              {item.metadataPreview}
            </pre>
          </details>
        ))}
      </div>
    ) : (
      <div className="mt-5 rounded-2xl border border-dashed border-black/10 px-4 py-4 text-sm text-steel">
        No governance-specific audit entries are currently exposed by the support timeline for this tenant or filter scope.
      </div>
    )}
  </section>
);
