import { describe, expect, it } from "vitest";

import { buildSeededServer } from "./testUtils.js";

describe("merchants API", () => {
  it("GET /v1/merchants/search?q=uber returns Uber merchants", async () => {
    const server = await buildSeededServer();
    const response = await server.inject({
      method: "GET",
      url: "/v1/merchants/search?q=uber",
    });

    expect(response.statusCode).toBe(200);
    expect(
      response.json().map((merchant: { slug: string }) => merchant.slug),
    ).toEqual(expect.arrayContaining(["uber", "uber-eats"]));

    await server.close();
  });

  it("GET /v1/merchants/by-url resolves Amazon domain", async () => {
    const server = await buildSeededServer();
    const response = await server.inject({
      method: "GET",
      url: "/v1/merchants/by-url?url=https%3A%2F%2Fwww.amazon.com%2Fcheckout",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      merchant: { slug: "amazon" },
      matchedPattern: { pattern: "amazon.com" },
    });

    await server.close();
  });

  it("GET /v1/merchants/by-url returns 404 for unknown URL", async () => {
    const server = await buildSeededServer();
    const response = await server.inject({
      method: "GET",
      url: "/v1/merchants/by-url?url=https%3A%2F%2Funknown.example.com",
    });

    expect(response.statusCode).toBe(404);

    await server.close();
  });
});
