import { formatDateTime } from "../../../lib/utils/format";
import type { AdministrativeAuditItem } from "../types";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { EmptyState } from "../../../components/ui/EmptyState";
import { DataField } from "../../../components/ui/DataField";

interface AdministrativeAuditSectionProps {
  items: AdministrativeAuditItem[];
}

export const AdministrativeAuditSection = ({
  items,
}: AdministrativeAuditSectionProps): JSX.Element => (
  <section className="space-y-4">
    <PageHeader
      label="Admin audit"
      title="Administrative audit and accountability"
      description="The support audit timeline provides event summaries, entity references, payload previews, and correlation ids. It does not expose actor identity in this DTO, so accountability evidence is partial rather than complete."
    />

    <SectionCard>
      {items.length === 0 ? (
        <EmptyState title="No audit events" message="No organization-prefixed audit events are currently exposed through the support timeline for this tenant." />
      ) : (
        <div className="space-y-4">
          {items.slice(0, 12).map((item) => (
            <article
              key={item.id}
              className="rounded-radius-lg border border-slate-200/60 bg-slate-50/50 p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-steel">{item.eventType}</p>
                  <h4 className="mt-1 text-lg font-semibold text-ink">{item.summary}</h4>
                </div>
                <span className="text-xs font-medium text-steel tabular-nums pt-1">{formatDateTime(item.createdAt)}</span>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <DataField
                  label="Entity"
                  value={
                    <>
                      {item.entityType ?? "Not exposed"}
                      {item.entityId ? ` • ${item.entityId}` : ""}
                    </>
                  }
                />
                <DataField
                  label="Correlation"
                  value={
                    <span className="break-all">{item.correlationId ?? "Not exposed"}</span>
                  }
                />
                <DataField
                  label="Actor"
                  value="Not exposed by this audit timeline DTO"
                />
              </div>

              <div className="mt-5 rounded-radius-md border border-slate-100 bg-white p-4 text-sm shadow-sm">
                <p className="font-semibold text-ink">Payload preview</p>
                <p className="mt-1.5 break-words font-mono text-xs leading-relaxed text-steel">{item.payloadPreview}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </SectionCard>
  </section>
);
