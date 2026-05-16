import { describe, expect, it } from "vitest";

import { env } from "../src/config/env.js";
import { buildSeededServer, prisma } from "./testUtils.js";

describe("auth API", () => {
  it("registers, creates a session cookie, returns session, and logs out", async () => {
    const server = await buildSeededServer();
    const email = `phase17-register-${Date.now()}@example.com`;

    const register = await server.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email,
        password: "Password12345!",
        displayName: "Phase 17",
      },
    });
    const cookie = sessionCookie(register);
    const session = await server.inject({
      method: "GET",
      url: "/v1/auth/session",
      headers: { cookie },
    });
    const logout = await server.inject({
      method: "POST",
      url: "/v1/auth/logout",
      headers: { cookie },
    });
    const afterLogout = await server.inject({
      method: "GET",
      url: "/v1/auth/session",
      headers: { cookie },
    });

    expect(register.statusCode).toBe(200);
    expect(register.json().user.email).toBe(email);
    expect(cookie).toContain("rewards_audit_session=");
    expect(session.json().user.email).toBe(email);
    expect(logout.statusCode).toBe(200);
    expect(afterLogout.statusCode).toBe(401);
    expect(
      await prisma.authEvent.count({
        where: { email, eventType: "REGISTER" },
      }),
    ).toBeGreaterThan(0);

    await server.close();
  });

  it("rejects duplicate registration and supports seeded login", async () => {
    const server = await buildSeededServer();

    const login = await server.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: "beta@example.com", password: "Password12345!" },
    });
    const duplicate = await server.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email: "beta@example.com", password: "Password12345!" },
    });
    const failed = await server.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: "beta@example.com", password: "wrong" },
    });

    expect(login.statusCode).toBe(200);
    expect(sessionCookie(login)).toContain("rewards_audit_session=");
    expect(duplicate.statusCode).toBe(409);
    expect(failed.statusCode).toBe(401);
    expect(failed.json().error.message).toBe("Invalid email or password.");

    await server.close();
  });

  it("issues dev password reset tokens and revokes old sessions", async () => {
    const server = await buildSeededServer();
    const email = `phase17-reset-${Date.now()}@example.com`;
    await server.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: { email, password: "Password12345!" },
    });
    const oldLogin = await server.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email, password: "Password12345!" },
    });
    const oldCookie = sessionCookie(oldLogin);
    const reset = await server.inject({
      method: "POST",
      url: "/v1/auth/password-reset/request",
      payload: { email },
    });
    const confirm = await server.inject({
      method: "POST",
      url: "/v1/auth/password-reset/confirm",
      payload: {
        token: reset.json().devResetToken,
        newPassword: "NewPassword12345!",
      },
    });
    const oldSession = await server.inject({
      method: "GET",
      url: "/v1/auth/session",
      headers: { cookie: oldCookie },
    });
    const newLogin = await server.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email, password: "NewPassword12345!" },
    });

    expect(reset.statusCode).toBe(200);
    expect(reset.json().devResetToken).toBeTruthy();
    expect(confirm.statusCode).toBe(200);
    expect(oldSession.statusCode).toBe(401);
    expect(newLogin.statusCode).toBe(200);

    await server.close();
  });

  it("lists user/admin auth events and supports extension pairing bearer auth", async () => {
    const server = await buildSeededServer();
    const login = await server.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: "beta@example.com", password: "Password12345!" },
    });
    const cookie = sessionCookie(login);
    const events = await server.inject({
      method: "GET",
      url: "/v1/auth/events",
      headers: { cookie },
    });
    const pairing = await server.inject({
      method: "POST",
      url: "/v1/auth/extension-token",
      headers: { cookie },
    });
    const extensionSession = await server.inject({
      method: "POST",
      url: "/v1/auth/extension-session",
      payload: { token: pairing.json().token },
    });
    const reused = await server.inject({
      method: "POST",
      url: "/v1/auth/extension-session",
      payload: { token: pairing.json().token },
    });
    const bearerUser = await server.inject({
      method: "GET",
      url: "/v1/users/me",
      headers: {
        authorization: `Bearer ${extensionSession.json().extensionToken}`,
      },
    });
    const adminEvents = await server.inject({
      method: "GET",
      url: "/v1/admin/auth/events",
      headers: { "x-user-email": "admin@example.com" },
    });
    const nonAdminEvents = await server.inject({
      method: "GET",
      url: "/v1/admin/auth/events",
      headers: { "x-user-email": "beta@example.com" },
    });

    expect(events.statusCode).toBe(200);
    expect(Array.isArray(events.json())).toBe(true);
    expect(pairing.statusCode).toBe(200);
    expect(extensionSession.json().extensionToken).toBeTruthy();
    expect(reused.statusCode).toBe(401);
    expect(bearerUser.json().email).toBe("beta@example.com");
    expect(adminEvents.statusCode).toBe(200);
    expect(nonAdminEvents.statusCode).toBe(403);

    await server.close();
  });

  it("enforces password policy and production ignores dev header auth", async () => {
    const originalNodeEnv = env.NODE_ENV;
    const originalDevAuth = env.ALLOW_DEV_AUTH_HEADER;
    const server = await buildSeededServer();
    const weak = await server.inject({
      method: "POST",
      url: "/v1/auth/register",
      payload: {
        email: `phase17-weak-${Date.now()}@example.com`,
        password: "short",
      },
    });

    env.NODE_ENV = "production";
    env.ALLOW_DEV_AUTH_HEADER = true;
    const devHeader = await server.inject({
      method: "GET",
      url: "/v1/users/me",
      headers: { "x-user-email": "beta@example.com" },
    });
    env.NODE_ENV = originalNodeEnv;
    env.ALLOW_DEV_AUTH_HEADER = originalDevAuth;

    expect(weak.statusCode).toBe(400);
    expect(devHeader.statusCode).toBe(401);

    await server.close();
  });
});

function sessionCookie(response: { headers: Record<string, unknown> }): string {
  const value = response.headers["set-cookie"];
  if (Array.isArray(value)) return value[0] as string;
  return String(value);
}
