import { apiClient } from "../api/client.js";
import { useAsync } from "./useAsync.js";

export function useCurrentUser() {
  return useAsync(() => apiClient.getCurrentUser(), []);
}
