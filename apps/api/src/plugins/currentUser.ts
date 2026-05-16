import type { User } from "@prisma/client";
import type { FastifyRequest } from "fastify";

import { prisma } from "@rewards-audit/db";

import { env } from "../config/env.js";
import { unauthorized } from "../lib/httpErrors.js";
import {
  getAuthSessionUser,
  readBearerToken,
  readSessionCookie,
} from "../services/authService.js";

export async function resolveCurrentUser(
  request: FastifyRequest,
): Promise<User> {
  const presentedAuthToken =
    readSessionCookie(request) ?? readBearerToken(request);
  const sessionUser = await getAuthSessionUser(request);
  if (sessionUser) {
    (request as FastifyRequest & { currentUser?: User }).currentUser =
      sessionUser;
    return sessionUser;
  }
  if (presentedAuthToken) {
    throw unauthorized("Authentication required.");
  }

  if (env.NODE_ENV === "production" || !env.ALLOW_DEV_AUTH_HEADER) {
    throw unauthorized("Authentication required.");
  }

  const headerValue = request.headers["x-user-email"];
  const headerEmail = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const email = headerEmail ?? env.DEV_USER_EMAIL;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw unauthorized(`Current development user ${email} was not found.`);
  }

  (request as FastifyRequest & { currentUser?: User }).currentUser = user;
  return user;
}
