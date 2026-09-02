import { useLocation } from "react-router-dom";

import { SessionPanel } from "../../features/session/SessionPanel";

const titles: Record<string, { eyebrow: string; title: string; subtitle: string }> = {
  "/overview": {
    eyebrow: "Network / Command Center",
    title: "Command center",
    subtitle: "Cross-system priorities, risk signals, and next actions.",
  },
  "/activation": {
    eyebrow: "Commercial / Activation",
    title: "Tenant activation",
    subtitle: "Billing, onboarding milestones, and first-value evidence.",
  },
  "/tenant-admin": {
    eyebrow: "Governance / Tenant",
    title: "Tenant admin",
    subtitle: "Members, invitations, entitlements, and audit trail.",
  },
  "/policies": {
    eyebrow: "Governance / Policies",
    title: "Policy governance",
    subtitle: "Active policies, automation posture, and effectiveness.",
  },
  "/approval-governance": {
    eyebrow: "Governance / Approvals",
    title: "Approval governance",
    subtitle: "Approval bottlenecks, overrides, and intervention evidence.",
  },
  "/decisions": {
    eyebrow: "Inventory / Decisions",
    title: "Decision inbox",
    subtitle: "Recommendations, approval state, and outcome linkage.",
  },
  "/workflow": {
    eyebrow: "Infrastructure / Workflow",
    title: "Workflow operations",
    subtitle: "Execution tasks, retries, and failure diagnostics.",
  },
  "/outcomes": {
    eyebrow: "Decision Hub / Outcomes",
    title: "Outcomes and risk",
    subtitle: "Inventory risk, measurable impact, and quality trends.",
  },
  "/investigation": {
    eyebrow: "Inventory / Investigation",
    title: "Investigation workspace",
    subtitle: "SKU and location drill-in across all operational context.",
  },
  "/data-ops": {
    eyebrow: "Operations / Data Ops",
    title: "Data and forecast ops",
    subtitle: "Sync health, forecast jobs, and demand freshness.",
  },
  "/support-actions": {
    eyebrow: "Operations / Recovery",
    title: "Support actions",
    subtitle: "Safe retries, requeues, and remediation operations.",
  },
  "/supply-execution": {
    eyebrow: "Execution / Supply",
    title: "Supply execution",
    subtitle: "PO tracking, supplier coverage, and closure signals.",
  },
  "/buyer-actions": {
    eyebrow: "Execution / Buyer",
    title: "Buyer actions",
    subtitle: "Purchase-order submit, delay, and receipt flows.",
  },
  "/integrations": {
    eyebrow: "Operations / Integrations",
    title: "Data connections",
    subtitle: "Connection onboarding, sync readiness, and controls.",
  },
};

const getTitle = (
  pathname: string,
): { eyebrow: string; title: string; subtitle: string } => {
  const match = Object.entries(titles).find(([prefix]) => pathname.startsWith(prefix));

  return (
    match?.[1] ?? {
      eyebrow: "Distribution Intelligence",
      title: "Operational workspace",
      subtitle: "Inventory operations portfolio prototype.",
    }
  );
};

export const Topbar = (): JSX.Element => {
  const location = useLocation();
  const { eyebrow, title, subtitle } = getTitle(location.pathname);

  return (
    <header className="sticky top-4 z-20 rounded-radius-xl bg-white/82 px-5 py-4 shadow-soft ring-1 ring-slate-200/70 backdrop-blur-xl sm:px-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="text-micro uppercase text-steel">{eyebrow}</p>
          <h2 className="mt-2 text-heading text-ink">{title}</h2>
          <p className="mt-1 text-sm text-steel">{subtitle}</p>
        </div>

        <div className="w-full flex-shrink-0 xl:max-w-[40rem]">
          <SessionPanel compact />
        </div>
      </div>
    </header>
  );
};
