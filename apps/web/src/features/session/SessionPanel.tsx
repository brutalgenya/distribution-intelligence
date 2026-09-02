import { StatusChip } from "../../components/ui/StatusChip";
import { useSession } from "./SessionProvider";

interface SessionPanelProps {
  compact?: boolean;
}

export const SessionPanel = ({ compact = false }: SessionPanelProps): JSX.Element => {
  const { userId, organizationId, isConfigured, setSession, resetSession } = useSession();

  return (
    <section className="rounded-radius-lg bg-[rgba(248,249,250,0.9)] p-3 shadow-sm ring-1 ring-slate-200/70">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="text-micro uppercase text-steel">Demo session</p>
            <StatusChip tone={isConfigured ? "success" : "danger"}>
              {isConfigured ? "Ready" : "Required"}
            </StatusChip>
          </div>

          <button
            type="button"
            onClick={resetSession}
            className="ui-button ui-button-quiet !min-h-0 !px-2.5 !py-1 text-xs"
          >
            Reset
          </button>
        </div>

        <div className={compact ? "grid gap-2 sm:grid-cols-2" : "grid gap-2 lg:grid-cols-2"}>
          <label className="block">
            <span className="ui-label mb-1">User id</span>
            <input
              className="ui-input !py-2 text-xs"
              value={userId}
              onChange={(event) => setSession({ userId: event.target.value.trim() })}
              placeholder="Seeded demo user id"
            />
          </label>

          <label className="block">
            <span className="ui-label mb-1">Organization id</span>
            <input
              className="ui-input !py-2 text-xs"
              value={organizationId}
              onChange={(event) => setSession({ organizationId: event.target.value.trim() })}
              placeholder="Seeded demo organization id"
            />
          </label>
        </div>
      </div>
    </section>
  );
};
