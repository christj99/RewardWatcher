import type { User } from "@prisma/client";
import type { FastifyRequest } from "fastify";

import { forbidden } from "../lib/httpErrors.js";
import { resolveCurrentUser } from "./currentUser.js";

export async function requireAdminUser(request: FastifyRequest): Promise<User> {
  const user = await resolveCurrentUser(request);

  if (!user.isAdmin) {
    throw forbidden("Admin access is required.");
  }

  return user;
}
