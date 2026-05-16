import { describe, expect, it } from "vitest";

import { buildSeededServer } from "./testUtils.js";
import {
  adminHeaders,
  betaHeaders,
  createAdminIssuer,
  uniqueSlug,
} from "./adminPhase8Utils.js";

describe("admin issuer API", () => {
  it("requires admin access", async () => {
    const server = await buildSeededServer();
    const response = await server.inject({
      method: "GET",
      url: "/v1/admin/issuers",
      headers: betaHeaders,
    });

    expect(response.statusCode).toBe(403);
    await server.close();
  });

  it("creates, rejects duplicate slug, lists, gets, and updates issuers", async () => {
    const server = await buildSeededServer();
    const slug = uniqueSlug("issuer");
    const create = await server.inject({
      method: "POST",
      url: "/v1/admin/issuers",
      headers: adminHeaders,
      payload: {
        name: "Phase 8 Issuer",
        slug,
        websiteUrl: "https://issuer.example.com",
      },
    });
    const duplicate = await server.inject({
      method: "POST",
      url: "/v1/admin/issuers",
      headers: adminHeaders,
      payload: { name: "Duplicate", slug },
    });
    const list = await server.inject({
      method: "GET",
      url: `/v1/admin/issuers?q=${slug}`,
      headers: adminHeaders,
    });
    const detail = await server.inject({
      method: "GET",
      url: `/v1/admin/issuers/${create.json().id}`,
      headers: adminHeaders,
    });
    const update = await server.inject({
      method: "PATCH",
      url: `/v1/admin/issuers/${create.json().id}`,
      headers: adminHeaders,
      payload: { name: "Phase 8 Issuer Updated", websiteUrl: null },
    });

    expect(create.statusCode).toBe(201);
    expect(duplicate.statusCode).toBe(409);
    expect(list.json()[0].slug).toBe(slug);
    expect(detail.json().cards).toEqual([]);
    expect(update.json().name).toBe("Phase 8 Issuer Updated");

    await server.close();
  });

  it("generates slug when omitted", async () => {
    const server = await buildSeededServer();
    const issuer = await createAdminIssuer(server);

    expect(issuer.id).toBeDefined();
    await server.close();
  });
});
