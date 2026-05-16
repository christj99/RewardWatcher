import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { useAdminAuth } from "../hooks/useAdminAuth";

export function AdminLoginPage() {
  const auth = useAdminAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await auth.login(email, password);
      navigate("/", { replace: true });
    } catch (loginError) {
      setError(
        loginError instanceof Error ? loginError.message : "Login failed.",
      );
    }
  }

  return (
    <main className="auth-page">
      <form className="panel auth-panel" onSubmit={submit}>
        <h1>Admin sign in</h1>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit">Sign in</button>
      </form>
    </main>
  );
}
