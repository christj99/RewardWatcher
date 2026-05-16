import { describe, expect, it } from "vitest";

import { buildSeededServer, prisma } from "./testUtils.js";

describe("users API", () => {
  it("GET /v1/users/me returns beta user by default", async () => {
    const server = await buildSeededServer();
    const response = await server.inject({
      method: "GET",
      url: "/v1/users/me",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      email: "beta@example.com",
      displayName: "Beta User",
      plaidBetaEnabled: true,
    });

    await server.close();
  });

  it("PATCH /v1/users/me updates displayName without allowing isAdmin mutation", async () => {
    const server = await buildSeededServer();
    const response = await server.inject({
      method: "PATCH",
      url: "/v1/users/me",
      payload: {
        displayName: "Phase 3 Beta",
        isAdmin: true,
      },
    });

    expect(response.statusCode).toBe(400);

    const updateResponse = await server.inject({
      method: "PATCH",
      url: "/v1/users/me",
      payload: {
        displayName: "Phase 3 Beta",
      },
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json()).toMatchObject({
      email: "beta@example.com",
      displayName: "Phase 3 Beta",
      isAdmin: false,
    });

    await prisma.user.update({
      where: { email: "beta@example.com" },
      data: { displayName: "Beta User" },
    });
    await server.close();
  });
});
