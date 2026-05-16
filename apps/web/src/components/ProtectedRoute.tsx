import { Navigate, Outlet, useLocation } from "react-router-dom";

import { LoadingState } from "./LoadingState.js";
import { useAuth } from "../hooks/useAuth.js";

export function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.loading) {
    return <LoadingState label="Checking session" />;
  }

  if (!auth.user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
