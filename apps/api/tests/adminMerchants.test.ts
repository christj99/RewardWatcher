import { describe, expect, it } from "vitest";

import { buildSeededServer } from "./testUtils.js";
import {
  adminHeaders,
  createAdminIssuer,
  createAdminRuleSource,
  uniqueSlug,
} from "./adminPhase8Utils.js";

describe("admin merchant API", () => {
  it("creates, rejects duplicate slug, updates, and details merchants", async () => {
    const server = await buildSeededServer();
    const slug = uniqueSlug("merchant");
    const create = await server.inject({
      method: "POST",
      url: "/v1/admin/merchants",
      headers: adminHeaders,
      payload: {
        name: "Phase 8 Merchant",
        slug,
        category: "GENERAL",
        websiteUrl: "https://merchant.example.com",
      },
    });
    const duplicate = await server.inject({
      method: "POST",
      url: "/v1/admin/merchants",
      headers: adminHeaders,
      payload: { name: "Duplicate", slug, category: "GENERAL" },
    });
    const update = await server.inject({
      method: "PATCH",
      url: `/v1/admin/merchants/${create.json().id}`,
      headers: adminHeaders,
      payload: { category: "DINING" },
    });
    const detail = await server.inject({
      method: "GET",
      url: `/v1/admin/merchants/${create.json().id}`,
      headers: adminHeaders,
    });

    expect(create.statusCode).toBe(201);
    expect(duplicate.statusCode).toBe(409);
    expect(update.json().category).toBe("DINING");
    expect(detail.json().urlPatterns).toEqual([]);
    await server.close();
  });

  it("creates URL patterns, supports public resolution, rejects protocol domains, and deletes patterns", async () => {
    const server = await buildSeededServer();
    const merchant = await server.inject({
      method: "POST",
      url: "/v1/admin/merchants",
      headers: adminHeaders,
      payload: {
        name: "Pattern Merchant",
        slug: uniqueSlug("pattern-merchant"),
        category: "GENERAL",
      },
    });
    const domain = `${uniqueSlug("pattern")}.example.com`;
    const pattern = await server.inject({
      method: "POST",
      url: `/v1/admin/merchants/${merchant.json().id}/url-patterns`,
      headers: adminHeaders,
      payload: {
        pattern: domain,
        patternType: "DOMAIN",
        confidence: "HIGH",
      },
    });
    const badDomain = await server.inject({
      method: "POST",
      url: `/v1/admin/merchants/${merchant.json().id}/url-patterns`,
      headers: adminHeaders,
      payload: {
        pattern: `https://${domain}`,
        patternType: "DOMAIN",
        confidence: "HIGH",
      },
    });
    const resolved = await server.inject({
      method: "GET",
      url: `/v1/merchants/by-url?url=${encodeURIComponent(`https://www.${domain}/checkout`)}`,
    });
    const deleted = await server.inject({
      method: "DELETE",
      url: `/v1/admin/merchant-url-patterns/${pattern.json().id}`,
      headers: adminHeaders,
    });

    expect(pattern.statusCode).toBe(201);
    expect(badDomain.statusCode).toBe(400);
    expect(resolved.statusCode).toBe(200);
    expect(resolved.json().merchant.id).toBe(merchant.json().id);
    expect(deleted.statusCode).toBe(200);
    await server.close();
  });

  it("creates posting profiles and validates merchant and issuer", async () => {
    const server = await buildSeededServer();
    const issuer = await createAdminIssuer(server, "posting-issuer");
    const source = await createAdminRuleSource(server);
    const merchant = await server.inject({
      method: "POST",
      url: "/v1/admin/merchants",
      headers: adminHeaders,
      payload: {
        name: "Posting Merchant",
        slug: uniqueSlug("posting-merchant"),
        category: "GENERAL",
      },
    });
    const profile = await server.inject({
      method: "POST",
      url: "/v1/admin/merchant-posting-profiles",
      headers: adminHeaders,
      payload: {
        merchantId: merchant.json().id,
        issuerId: issuer.id,
        observedCategory: "GROCERY",
        dataSource: "CURATOR_RESEARCH",
        confidence: "MEDIUM",
        observationCount: 2,
        sourceId: source.id,
      },
    });
    const badMerchant = await server.inject({
      method: "POST",
      url: "/v1/admin/merchant-posting-profiles",
      headers: adminHeaders,
      payload: {
        merchantId: "missing",
        observedCategory: "GROCERY",
        dataSource: "CURATOR_RESEARCH",
        confidence: "MEDIUM",
      },
    });
    const badIssuer = await server.inject({
      method: "POST",
      url: "/v1/admin/merchant-posting-profiles",
      headers: adminHeaders,
      payload: {
        merchantId: merchant.json().id,
        issuerId: "missing",
        observedCategory: "GROCERY",
        dataSource: "CURATOR_RESEARCH",
        confidence: "MEDIUM",
      },
    });

    expect(profile.statusCode).toBe(201);
    expect(badMerchant.statusCode).toBe(404);
    expect(badIssuer.statusCode).toBe(404);
    await server.close();
  });
});
