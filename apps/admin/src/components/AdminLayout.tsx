import { Outlet } from "react-router-dom";

import { AdminNav } from "./AdminNav";

export function AdminLayout() {
  return (
    <div className="admin-shell">
      <aside>
        <div className="brand">
          <span>RA</span>
          <strong>Rewards Audit Admin</strong>
        </div>
        <AdminNav />
      </aside>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
