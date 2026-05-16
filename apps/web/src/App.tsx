import { useRoutes } from "react-router-dom";

import { AuthProvider } from "./hooks/useAuth.js";
import { routes } from "./routes.js";

export function App() {
  const element = useRoutes(routes);
  return <AuthProvider>{element}</AuthProvider>;
}
