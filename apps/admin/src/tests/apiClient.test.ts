import { describe, expect, it, vi } from "vitest";

import { AdminApiClient } from "../api/client";
import { AdminApiError } from "../api/errors";

describe("AdminApiClient", () => {
  it("uses session credentials by default and sends dev header only when enabled", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify([]),
    });
    vi.stubGlobal("fetch", fetchMock);

    await new AdminApiClient(
      "http://api.local",
      "curator@example.com",
    ).listCards();
    const devClient = new AdminApiClient(
      "http://api.local",
      "curator@example.com",
      true,
    );
    await devClient.listCards();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.local/v1/admin/cards",
      expect.objectContaining({
        credentials: "include",
      }),
    );
    expect(
      fetchMock.mock.calls[0]?.[1].headers["x-user-email"],
    ).toBeUndefined();
    expect(fetchMock.mock.calls[1]?.[1].headers["x-user-email"]).toBe(
      "curator@example.com",
    );
  });

  it("handles 403 admin access error clearly", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () =>
        JSON.stringify({ error: { message: "Admin access required." } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = new AdminApiClient("http://api.local", "beta@example.com");
    await expect(client.listCards()).rejects.toBeInstanceOf(AdminApiError);
    await expect(client.listCards()).rejects.toThrow("Admin access required.");
  });

  it("creates correct request body for createCard", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      text: async () => JSON.stringify({ id: "card_1" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const body = {
      issuerId: "issuer_1",
      name: "Test Card",
      annualFeeCents: 95,
    };

    await new AdminApiClient("http://api.local").createCard(body);

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual(body);
  });

  it("creates correct request body for createEarningRule", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      text: async () => JSON.stringify({ id: "rule_1" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const body = {
      cardId: "card_1",
      rewardCurrencyId: "cur_1",
      multiplier: "3",
      confidence: "HIGH",
    };

    await new AdminApiClient("http://api.local").createEarningRule(body);

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual(body);
  });

  it("creates correct request body for expireOffer", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: "offer_1" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const body = { notes: "Expired after verification." };

    await new AdminApiClient("http://api.local").expireOffer("offer_1", body);

    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe("http://api.local/v1/admin/offers/offer_1/expire");
    const init = call?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual(body);
  });
});
