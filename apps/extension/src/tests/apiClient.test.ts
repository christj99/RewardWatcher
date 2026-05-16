import { describe, expect, it, vi } from "vitest";

import { createExtensionApiClient } from "../apiClient.js";

describe("extension API client", () => {
  it("resolves merchants by encoded URL and sends the dev auth header", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            merchant: { id: "merchant_1", name: "Amazon", slug: "amazon" },
            confidence: "HIGH",
          }),
          { status: 200 },
        ),
    );
    const client = createExtensionApiClient({
      apiBaseUrl: "http://localhost:3000",
      devUserEmail: "beta@example.com",
      fetchImpl,
    });

    await client.resolveMerchantByUrl("https://www.amazon.com/checkout?a=1");

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      "http://localhost:3000/v1/merchants/by-url?url=https%3A%2F%2Fwww.amazon.com%2Fcheckout%3Fa%3D1",
    );
    expect(new Headers(init.headers).get("x-user-email")).toBe(
      "beta@example.com",
    );
  });

  it("creates checkout recommendations with ONLINE_CHECKOUT context", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ id: "rec_1" }), { status: 201 }),
    );
    const client = createExtensionApiClient({ fetchImpl });

    await client.createCheckoutRecommendation({
      merchantUrl: "https://www.amazon.com/checkout",
      purchaseAmountCents: 12345,
    });

    const [, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(init.body as string)).toMatchObject({
      merchantUrl: "https://www.amazon.com/checkout",
      purchaseAmountCents: 12345,
      lens: "PRACTICAL",
      context: "ONLINE_CHECKOUT",
    });
  });

  it("throws typed errors for failed API responses", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ message: "No current user" }), {
          status: 401,
        }),
    );
    const client = createExtensionApiClient({ fetchImpl });

    await expect(client.getCurrentUser()).rejects.toMatchObject({
      name: "ExtensionApiError",
      message: "No current user",
      status: 401,
    });
  });
});
