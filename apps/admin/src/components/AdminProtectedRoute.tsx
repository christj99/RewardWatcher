import { Navigate, Outlet } from "react-router-dom";

import { useAdminAuth } from "../hooks/useAdminAuth";
import { LoadingState } from "./LoadingState";

export function AdminProtectedRoute() {
  const auth = useAdminAuth();

  if (auth.loading) {
    return <LoadingState label="Checking admin session" />;
  }

  if (!auth.user) {
    return <Navigate to="/login" replace />;
  }

  if (!auth.user.isAdmin) {
    return (
      <main className="content">
        <section className="panel state state-error">
          <h1>Admin access required</h1>
          <p>This account is signed in but is not an admin.</p>
        </section>
      </main>
    );
  }

  return <Outlet />;
}
