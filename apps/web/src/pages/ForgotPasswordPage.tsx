import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { apiClient } from "../api/client.js";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await apiClient.requestPasswordReset(email);
    setMessage("If an account exists, a password reset link will be sent.");
    setDevToken(result.devResetToken ?? null);
  }

  return (
    <main className="auth-page">
      <form className="panel auth-panel" onSubmit={submit}>
        <h1>Reset password</h1>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <button type="submit">Request reset</button>
        {message ? <p>{message}</p> : null}
        {devToken ? (
          <p className="dev-token">
            Dev reset token:{" "}
            <Link to={`/reset-password?token=${devToken}`}>
              open reset link
            </Link>
          </p>
        ) : null}
      </form>
    </main>
  );
}
