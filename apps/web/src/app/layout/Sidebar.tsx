import clsx from "clsx";
import { NavLink } from "react-router-dom";

import { Icon } from "../../components/ui/Icon";

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "Command",
    items: [
      { to: "/overview", label: "Overview", icon: "dashboard" },
      { to: "/decisions", label: "Decisions", icon: "inbox" },
      { to: "/workflow", label: "Workflow", icon: "workflow" },
      { to: "/outcomes", label: "Outcomes", icon: "chart" },
      { to: "/investigation", label: "Investigation", icon: "search" },
    ],
  },
  {
    title: "Operations",
    items: [
      { to: "/data-ops", label: "Data Ops", icon: "database" },
      { to: "/support-actions", label: "Support Actions", icon: "wrench" },
      { to: "/supply-execution", label: "Supply Execution", icon: "truck" },
      { to: "/buyer-actions", label: "Buyer Actions", icon: "package" },
      { to: "/integrations", label: "Integrations", icon: "link" },
    ],
  },
  {
    title: "Governance",
    items: [
      { to: "/policies", label: "Policies", icon: "shield" },
      { to: "/approval-governance", label: "Approval Governance", icon: "check" },
      { to: "/activation", label: "Activation", icon: "rocket" },
      { to: "/tenant-admin", label: "Tenant Admin", icon: "users" },
    ],
  },
];

export const Sidebar = (): JSX.Element => (
  <aside className="lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
    <div className="flex h-full flex-col rounded-radius-xl bg-[rgba(248,249,250,0.92)] px-3 py-4 shadow-soft ring-1 ring-slate-200/70 backdrop-blur-xl lg:py-5">
      <div className="px-3 pb-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-radius-md bg-gradient-to-b from-secondary to-secondary-dim text-white shadow-whisper">
            <Icon name="zap" size={18} />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-[-0.03em] text-ink">Distribution Intelligence</h1>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-steel">
              Decision Automation Platform
            </p>
          </div>
        </div>
      </div>

      <nav className="custom-scrollbar flex-1 space-y-6 overflow-y-auto px-1">
        {navSections.map((section) => (
          <div key={section.title}>
            <p className="px-3 text-micro uppercase text-steel/70">{section.title}</p>
            <div className="mt-2 space-y-1">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    clsx(
                      "ui-nav-link",
                      isActive ? "ui-nav-link-active" : "ui-nav-link-inactive",
                    )
                  }
                >
                  <Icon name={item.icon} size={16} className="flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-4 rounded-radius-lg bg-white/88 px-4 py-4 shadow-sm ring-1 ring-slate-200/70">
        <p className="text-micro uppercase text-steel">Operating Mode</p>
        <p className="mt-2 text-sm font-semibold text-ink">Portfolio prototype</p>
        <p className="mt-2 text-sm leading-relaxed text-steel">
          Inspectable workflows, real queries and deterministic demo behaviour.
        </p>
      </div>
    </div>
  </aside>
);
