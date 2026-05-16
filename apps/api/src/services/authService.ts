import type { AuthEventType, Prisma, User } from "@prisma/client";
import type { FastifyRequest } from "fastify";

import { prisma } from "@rewards-audit/db";

import { env } from "../config/env.js";
import { conflict, notFound, unauthorized } from "../lib/httpErrors.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import {
  addDays,
  addMinutes,
  generateRawToken,
  hashToken,
} from "../lib/tokens.js";
import { sendTransactionalEmail } from "./email/emailService.js";
import { passwordResetTemplate } from "./email/templates.js";

export type AuthSessionResult = {
  user: User;
  rawToken: string;
  expiresAt: Date;
};

const userSelect = {
  id: true,
  email: true,
  displayName: true,
  isAdmin: true,
  plaidBetaEnabled: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function sessionCookieName(): string {
  return env.SESSION_COOKIE_NAME;
}

export function buildSessionCookie(rawToken: string, expiresAt: Date): string {
  const parts = [
    `${sessionCookieName()}=${encodeURIComponent(rawToken)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${expiresAt.toUTCString()}`,
  ];
  if (env.COOKIE_DOMAIN) {
    parts.push(`Domain=${env.COOKIE_DOMAIN}`);
  }
  if (env.NODE_ENV === "production" || env.SESSION_COOKIE_SECURE) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function buildClearSessionCookie(): string {
  const parts = [
    `${sessionCookieName()}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];
  if (env.COOKIE_DOMAIN) {
    parts.push(`Domain=${env.COOKIE_DOMAIN}`);
  }
  if (env.NODE_ENV === "production" || env.SESSION_COOKIE_SECURE) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function readSessionCookie(request: FastifyRequest): string | null {
  const header = request.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const [rawName, ...rawValueParts] = part.trim().split("=");
    if (rawName === sessionCookieName()) {
      return decodeURIComponent(rawValueParts.join("="));
    }
  }
  return null;
}

export function readBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const value = Array.isArray(header) ? header[0] : header;
  const [scheme, token] = value.split(/\s+/, 2);
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

export async function registerUser(input: {
  email: string;
  password: string;
  displayName?: string | undefined;
  request?: FastifyRequest | undefined;
}): Promise<AuthSessionResult> {
  const email = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);
  const existing = await prisma.user.findUnique({
    where: { email },
    include: { authCredential: true },
  });

  if (existing?.authCredential) {
    await recordAuthEvent({
      eventType: "LOGIN_FAILURE",
      email,
      request: input.request,
      metadata: { reason: "duplicate_register" },
    });
    throw conflict("An account already exists for this email.");
  }

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          ...(input.displayName !== undefined
            ? { displayName: input.displayName }
            : {}),
          authCredential: {
            create: { passwordHash, passwordUpdatedAt: new Date() },
          },
        },
      })
    : await prisma.user.create({
        data: {
          email,
          ...(input.displayName !== undefined
            ? { displayName: input.displayName }
            : {}),
          authCredential: {
            create: { passwordHash, passwordUpdatedAt: new Date() },
          },
        },
      });

  await recordAuthEvent({
    userId: user.id,
    email,
    eventType: "REGISTER",
    request: input.request,
  });
  return createSession(user, input.request);
}

export async function loginUser(input: {
  email: string;
  password: string;
  request?: FastifyRequest | undefined;
}): Promise<AuthSessionResult> {
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({
    where: { email },
    include: { authCredential: true },
  });
  const valid =
    user?.authCredential &&
    (await verifyPassword(input.password, user.authCredential.passwordHash));

  if (!user || !valid) {
    await recordAuthEvent({
      eventType: "LOGIN_FAILURE",
      email,
      request: input.request,
    });
    throw unauthorized("Invalid email or password.");
  }

  await recordAuthEvent({
    userId: user.id,
    email,
    eventType: "LOGIN_SUCCESS",
    request: input.request,
  });
  return createSession(user, input.request);
}

export async function ensurePasswordCredential(
  userId: string,
  password: string,
): Promise<void> {
  const passwordHash = await hashPassword(password);
  await prisma.authCredential.upsert({
    where: { userId },
    update: { passwordHash, passwordUpdatedAt: new Date() },
    create: { userId, passwordHash, passwordUpdatedAt: new Date() },
  });
}

export async function createSession(
  user: User,
  request?: FastifyRequest,
): Promise<AuthSessionResult> {
  const rawToken = generateRawToken();
  const expiresAt = addDays(new Date(), env.SESSION_TTL_DAYS);
  await prisma.authSession.create({
    data: {
      userId: user.id,
      sessionTokenHash: hashToken(rawToken),
      userAgent: requestUserAgent(request),
      ipAddress: requestIp(request),
      expiresAt,
    },
  });
  return { user, rawToken, expiresAt };
}

export async function getUserForSessionToken(
  rawToken: string,
): Promise<User | null> {
  const session = await prisma.authSession.findUnique({
    where: { sessionTokenHash: hashToken(rawToken) },
    include: { user: true },
  });
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt.getTime() <= Date.now()
  ) {
    return null;
  }
  return session.user;
}

export async function revokeSession(rawToken: string | null): Promise<void> {
  if (!rawToken) return;
  const session = await prisma.authSession.findUnique({
    where: { sessionTokenHash: hashToken(rawToken) },
  });
  if (!session || session.revokedAt) return;
  await prisma.authSession.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });
  await recordAuthEvent({
    userId: session.userId,
    eventType: "LOGOUT",
    metadata: { sessionId: session.id },
  });
}

export async function requestPasswordReset(input: {
  email: string;
  request?: FastifyRequest | undefined;
}): Promise<{ devResetToken?: string | undefined }> {
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    await recordAuthEvent({
      eventType: "PASSWORD_RESET_REQUEST",
      email,
      request: input.request,
      metadata: { userFound: false },
    });
    return {};
  }

  const rawToken = generateRawToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: addMinutes(new Date(), env.PASSWORD_RESET_TTL_MINUTES),
    },
  });
  await recordAuthEvent({
    userId: user.id,
    email,
    eventType: "PASSWORD_RESET_REQUEST",
    request: input.request,
  });
  const template = passwordResetTemplate({
    resetToken: rawToken,
    expiresMinutes: env.PASSWORD_RESET_TTL_MINUTES,
  });
  await sendTransactionalEmail({
    userId: user.id,
    to: user.email,
    emailType: "PASSWORD_RESET",
    subject: template.subject,
    text: template.text,
    html: template.html,
    idempotencyKey: `password-reset:${user.id}:${hashToken(rawToken).slice(0, 16)}`,
    metadata: {
      expiresMinutes: env.PASSWORD_RESET_TTL_MINUTES,
      requestId: input.request?.id,
    },
  });

  return env.NODE_ENV === "production" ? {} : { devResetToken: rawToken };
}

export async function confirmPasswordReset(input: {
  token: string;
  newPassword: string;
  request?: FastifyRequest | undefined;
}): Promise<AuthSessionResult> {
  const passwordHash = await hashPassword(input.newPassword);
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(input.token) },
    include: { user: true },
  });
  if (
    !resetToken ||
    resetToken.usedAt ||
    resetToken.expiresAt.getTime() <= Date.now()
  ) {
    throw unauthorized("Password reset token is invalid or expired.");
  }

  await prisma.$transaction([
    prisma.authCredential.upsert({
      where: { userId: resetToken.userId },
      update: { passwordHash, passwordUpdatedAt: new Date() },
      create: {
        userId: resetToken.userId,
        passwordHash,
        passwordUpdatedAt: new Date(),
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
    prisma.authSession.updateMany({
      where: { userId: resetToken.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await recordAuthEvent({
    userId: resetToken.userId,
    email: resetToken.user.email,
    eventType: "PASSWORD_RESET_SUCCESS",
    request: input.request,
  });
  return createSession(resetToken.user, input.request);
}

export async function createExtensionPairingToken(
  user: User,
  request?: FastifyRequest,
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateRawToken(24);
  const expiresAt = addMinutes(
    new Date(),
    env.EXTENSION_PAIRING_TOKEN_TTL_MINUTES,
  );
  await prisma.extensionAuthToken.create({
    data: { userId: user.id, tokenHash: hashToken(token), expiresAt },
  });
  await recordAuthEvent({
    userId: user.id,
    email: user.email,
    eventType: "EXTENSION_TOKEN_CREATED",
    request,
  });
  return { token, expiresAt };
}

export async function consumeExtensionPairingToken(
  token: string,
  request?: FastifyRequest,
): Promise<AuthSessionResult> {
  const pairingToken = await prisma.extensionAuthToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (
    !pairingToken ||
    pairingToken.usedAt ||
    pairingToken.revokedAt ||
    pairingToken.expiresAt.getTime() <= Date.now()
  ) {
    throw unauthorized("Extension pairing token is invalid or expired.");
  }

  await prisma.extensionAuthToken.update({
    where: { id: pairingToken.id },
    data: { usedAt: new Date() },
  });
  await recordAuthEvent({
    userId: pairingToken.userId,
    email: pairingToken.user.email,
    eventType: "EXTENSION_TOKEN_USED",
    request,
  });
  return createSession(pairingToken.user, request);
}

export async function listUserAuthEvents(userId: string) {
  return prisma.authEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function listAdminAuthEvents(input: {
  userId?: string | undefined;
  email?: string | undefined;
  eventType?: AuthEventType | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  limit: number;
}) {
  return prisma.authEvent.findMany({
    where: {
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.email ? { email: normalizeEmail(input.email) } : {}),
      ...(input.eventType ? { eventType: input.eventType } : {}),
      ...(input.startDate || input.endDate
        ? {
            createdAt: {
              ...(input.startDate ? { gte: new Date(input.startDate) } : {}),
              ...(input.endDate ? { lt: new Date(input.endDate) } : {}),
            },
          }
        : {}),
    },
    include: { user: { select: userSelect } },
    orderBy: { createdAt: "desc" },
    take: input.limit,
  });
}

export async function recordAuthEvent(input: {
  eventType: AuthEventType;
  userId?: string | undefined;
  email?: string | undefined;
  request?: FastifyRequest | undefined;
  metadata?: Prisma.InputJsonValue | undefined;
}): Promise<void> {
  const data: Prisma.AuthEventUncheckedCreateInput = {
    eventType: input.eventType,
    ...(input.userId !== undefined ? { userId: input.userId } : {}),
    email: input.email ? normalizeEmail(input.email) : null,
    ipAddress: requestIp(input.request),
    userAgent: requestUserAgent(input.request),
    ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
  };
  await prisma.authEvent.create({
    data,
  });
}

export async function requireSessionUser(
  request: FastifyRequest,
): Promise<User> {
  const token = readSessionCookie(request) ?? readBearerToken(request);
  if (!token) throw unauthorized("Authentication required.");
  const user = await getUserForSessionToken(token);
  if (!user) throw unauthorized("Authentication required.");
  return user;
}

export async function getAuthSessionUser(
  request: FastifyRequest,
): Promise<User | null> {
  const token = readSessionCookie(request) ?? readBearerToken(request);
  return token ? getUserForSessionToken(token) : null;
}

export async function getUserOrThrow(userId: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound("User not found.");
  return user;
}

function requestIp(request?: FastifyRequest): string | null {
  return request?.ip ?? null;
}

function requestUserAgent(request?: FastifyRequest): string | null {
  const userAgent = request?.headers["user-agent"];
  return Array.isArray(userAgent) ? userAgent[0] : (userAgent ?? null);
}
