import { describe, expect, it, vi } from "vitest";

import { createApiClient } from "../api/client.js";

describe("api client", () => {
  it("builds requests with base URL and sends the dev user header", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: "user-1" }));
    const client = createApiClient({
      baseUrl: "http://api.test",
      devUserEmail: "beta@example.com",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await client.getCurrentUser();

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://api.test/v1/users/me",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
    const firstCall = fetchImpl.mock.calls[0] as unknown as [
      string,
      { headers: Headers },
    ];
    const headers = firstCall[1].headers;
    expect(headers.get("x-user-email")).toBe("beta@example.com");
  });

  it("handles structured API errors", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ message: "Bad input" }, 400),
    );
    const client = createApiClient({
      baseUrl: "http://api.test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(client.getCurrentUser()).rejects.toMatchObject({
      message: "Bad input",
      status: 400,
    });
  });

  it("handles empty 204 responses", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const client = createApiClient({
      baseUrl: "http://api.test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(client.request<void>("/empty")).resolves.toBeUndefined();
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
