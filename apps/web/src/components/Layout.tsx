import { Link, Outlet } from "react-router-dom";

import { Nav } from "./Nav.js";

export function Layout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">RA</span>
          <span>Rewards Audit</span>
        </div>
        <Nav />
      </aside>
      <main className="content">
        <Outlet />
      </main>
      <Link className="feedback-fab" to="/feedback">
        Feedback
      </Link>
    </div>
  );
}
