import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { apiClient } from "../api/client.js";
import { useAuth } from "../hooks/useAuth.js";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const auth = useAuth();
  const navigate = useNavigate();
  const [token, setToken] = useState(params.get("token") ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await apiClient.confirmPasswordReset({ token, newPassword });
      await auth.refresh();
      navigate("/", { replace: true });
    } catch (resetError) {
      setError(
        resetError instanceof Error ? resetError.message : "Reset failed.",
      );
    }
  }

  return (
    <main className="auth-page">
      <form className="panel auth-panel" onSubmit={submit}>
        <h1>Set new password</h1>
        <label>
          Reset token
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            required
          />
        </label>
        <label>
          New password
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            minLength={10}
            required
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit">Update password</button>
      </form>
    </main>
  );
}
