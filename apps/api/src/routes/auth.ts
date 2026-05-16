import type { FastifyInstance } from "fastify";
import { BetaEventSource, BetaEventType } from "@prisma/client";

import { requireAdminUser } from "../plugins/adminGuard.js";
import { resolveCurrentUser } from "../plugins/currentUser.js";
import {
  adminAuthEventsQuerySchema,
  extensionSessionSchema,
  loginSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  registerSchema,
} from "../schemas/auth.js";
import {
  buildClearSessionCookie,
  buildSessionCookie,
  confirmPasswordReset,
  consumeExtensionPairingToken,
  createExtensionPairingToken,
  listAdminAuthEvents,
  listUserAuthEvents,
  loginUser,
  readBearerToken,
  readSessionCookie,
  registerUser,
  requestPasswordReset,
  revokeSession,
} from "../services/authService.js";
import { recordBetaEvent } from "../services/betaEventService.js";

export async function registerAuthRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.post("/v1/auth/register", async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const session = await registerUser({ ...body, request });
    reply.header(
      "set-cookie",
      buildSessionCookie(session.rawToken, session.expiresAt),
    );
    void recordBetaEvent({
      userId: session.user.id,
      eventType: BetaEventType.USER_REGISTERED,
      source: BetaEventSource.API,
    });
    return { user: session.user };
  });

  server.post("/v1/auth/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const session = await loginUser({ ...body, request });
    reply.header(
      "set-cookie",
      buildSessionCookie(session.rawToken, session.expiresAt),
    );
    void recordBetaEvent({
      userId: session.user.id,
      eventType: BetaEventType.USER_LOGGED_IN,
      source: BetaEventSource.API,
    });
    return { user: session.user };
  });

  server.post("/v1/auth/logout", async (request, reply) => {
    await revokeSession(readSessionCookie(request) ?? readBearerToken(request));
    reply.header("set-cookie", buildClearSessionCookie());
    return { ok: true };
  });

  server.get("/v1/auth/session", async (request) => {
    const user = await resolveCurrentUser(request);
    return { user };
  });

  server.post("/v1/auth/password-reset/request", async (request) => {
    const body = passwordResetRequestSchema.parse(request.body);
    const result = await requestPasswordReset({ ...body, request });
    return { ok: true, ...result };
  });

  server.post("/v1/auth/password-reset/confirm", async (request, reply) => {
    const body = passwordResetConfirmSchema.parse(request.body);
    const session = await confirmPasswordReset({ ...body, request });
    reply.header(
      "set-cookie",
      buildSessionCookie(session.rawToken, session.expiresAt),
    );
    return { user: session.user };
  });

  server.get("/v1/auth/events", async (request) => {
    const user = await resolveCurrentUser(request);
    return listUserAuthEvents(user.id);
  });

  server.post("/v1/auth/extension-token", async (request) => {
    const user = await resolveCurrentUser(request);
    const token = await createExtensionPairingToken(user, request);
    return { token: token.token, expiresAt: token.expiresAt.toISOString() };
  });

  server.post("/v1/auth/extension-session", async (request) => {
    const body = extensionSessionSchema.parse(request.body);
    const session = await consumeExtensionPairingToken(body.token, request);
    return {
      extensionToken: session.rawToken,
      expiresAt: session.expiresAt.toISOString(),
      user: session.user,
    };
  });

  server.get("/v1/admin/auth/events", async (request) => {
    await requireAdminUser(request);
    const query = adminAuthEventsQuerySchema.parse(request.query);
    return listAdminAuthEvents(query);
  });
}
