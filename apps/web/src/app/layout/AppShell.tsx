import { Outlet } from "react-router-dom";

import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export const AppShell = (): JSX.Element => (
  <div className="min-h-screen bg-cloud text-ink">
    <div className="mx-auto grid min-h-screen max-w-[1760px] gap-5 px-3 py-3 sm:px-4 lg:grid-cols-[17rem_minmax(0,1fr)] lg:px-5 lg:py-4">
      <Sidebar />

      <div className="min-w-0">
        <Topbar />
        <main className="min-w-0 px-1 pb-10 pt-6 sm:px-2 lg:px-3">
          <Outlet />
        </main>
      </div>
    </div>
  </div>
);
