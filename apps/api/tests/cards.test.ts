import { describe, expect, it } from "vitest";

import { buildSeededServer, prisma } from "./testUtils.js";

describe("cards API", () => {
  it("GET /v1/cards returns seeded cards", async () => {
    const server = await buildSeededServer();
    const response = await server.inject({ method: "GET", url: "/v1/cards" });

    expect(response.statusCode).toBe(200);
    expect(response.json().length).toBeGreaterThanOrEqual(6);

    await server.close();
  });

  it("GET /v1/cards?q=gold returns Amex Gold", async () => {
    const server = await buildSeededServer();
    const response = await server.inject({
      method: "GET",
      url: "/v1/cards?q=gold",
    });

    expect(response.statusCode).toBe(200);
    expect(
      response.json().map((card: { slug: string }) => card.slug),
    ).toContain("amex-gold");

    await server.close();
  });

  it("GET /v1/cards/:id returns card details with issuer and rules", async () => {
    const server = await buildSeededServer();
    const card = await prisma.card.findUniqueOrThrow({
      where: { slug: "amex-gold" },
    });
    const response = await server.inject({
      method: "GET",
      url: `/v1/cards/${card.id}`,
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.issuer.name).toBe("American Express");
    expect(body.earningRules.length).toBeGreaterThan(0);
    expect(body.versions.length).toBe(1);

    await server.close();
  });
});
