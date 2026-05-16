import type { FastifyInstance } from "fastify";

import { prisma } from "@rewards-audit/db";

import { resolveCurrentUser } from "../plugins/currentUser.js";
import { updateMeSchema } from "../schemas/users.js";

export async function registerUserRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.get("/v1/users/me", async (request) => {
    const user = await resolveCurrentUser(request);
    return user;
  });

  server.patch("/v1/users/me", async (request) => {
    const user = await resolveCurrentUser(request);
    const body = updateMeSchema.parse(request.body);

    return prisma.user.update({
      where: { id: user.id },
      data:
        body.displayName === undefined
          ? {}
          : {
              displayName: body.displayName,
            },
    });
  });
}
