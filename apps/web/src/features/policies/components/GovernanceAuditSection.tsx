import { formatDateTime } from "../../../lib/utils/format";
import type { PolicyAuditItem } from "../types";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { EmptyState } from "../../../components/ui/EmptyState";

interface GovernanceAuditSectionProps {
  items: PolicyAuditItem[];
}

export const GovernanceAuditSection = ({
  items,
}: GovernanceAuditSectionProps): JSX.Element => (
  <section className="space-y-4 w-full flex flex-col items-stretch">
    <PageHeader
      label="Audit trail"
      title="Governance audit and guardrails"
      description="Governance audit evidence comes from the support timeline. Separate AI guardrail or policy-history read models are not exposed today, so this section stays explicit about that limitation."
    />

    <SectionCard>
       <div className="rounded-radius-md bg-slate-50/50 p-6 border border-slate-100 mb-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-ink mb-2">Guardrail visibility</p>
        <p className="text-sm leading-relaxed text-steel">
          The backend currently exposes policy records, workflow approvals, outcomes effectiveness, and support timeline evidence. It does not expose a separate AI guardrail or policy-history timeline endpoint for this workspace.
        </p>
      </div>

      {items.length > 0 ? (
        <div className="space-y-4">
          {items.map((item) => (
             <details key={item.id} className="group rounded-radius-md border border-slate-200/60 bg-white shadow-sm overflow-hidden open:pb-4">
               <summary className="cursor-pointer list-none p-5 transition-colors group-hover:bg-slate-50/50">
                 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                   <div>
                      <p className="font-semibold text-ink">{item.title}</p>
                      <p className="mt-1 text-sm text-steel">{item.description}</p>
                   </div>
                   <div className="sm:text-right text-sm text-steel">
                      <p className="font-medium text-ink">{formatDateTime(item.createdAt)}</p>
                      <p className="mt-1 font-mono text-[11px] opacity-70 uppercase tracking-widest">{item.correlationId ? `Corr: ${item.correlationId}` : "No correlation id"}</p>
                   </div>
                 </div>
               </summary>
               <div className="px-5">
                   <pre className="overflow-x-auto rounded-radius-sm bg-slate-900 p-4 text-xs leading-relaxed text-slate-300 font-mono shadow-inner border border-slate-950">
                     {item.metadataPreview}
                   </pre>
               </div>
             </details>
          ))}
        </div>
      ) : (
         <div className="bg-slate-50 rounded-radius-md p-6 border border-slate-200/60 shadow-sm text-center">
             <EmptyState title="No audit entries" message="No governance-specific audit or outbox entries are currently visible in the support timeline for this scope." />
        </div>
      )}
    </SectionCard>
  </section>
);
