import { AdminAuthProvider } from "./hooks/useAdminAuth";
import { AdminRoutes } from "./routes";

export function App() {
  return (
    <AdminAuthProvider>
      <AdminRoutes />
    </AdminAuthProvider>
  );
}
