import { describe, expect, it } from "vitest";

import { buildSeededServer, prisma } from "./testUtils.js";
import {
  adminHeaders,
  createAdminCard,
  createAdminIssuer,
  uniqueSlug,
} from "./adminPhase8Utils.js";

describe("admin card and card version API", () => {
  it("creates cards, rejects invalid issuer and duplicate slug, and updates card without mutating versions", async () => {
    const server = await buildSeededServer();
    const issuer = await createAdminIssuer(server, "card-create-issuer");
    const slug = uniqueSlug("card-create");
    const create = await server.inject({
      method: "POST",
      url: "/v1/admin/cards",
      headers: adminHeaders,
      payload: {
        issuerId: issuer.id,
        name: "Phase 8 Card",
        slug,
        network: "VISA",
        annualFeeCents: 1000,
      },
    });
    const invalidIssuer = await server.inject({
      method: "POST",
      url: "/v1/admin/cards",
      headers: adminHeaders,
      payload: {
        issuerId: "missing",
        name: "Bad Card",
        slug: uniqueSlug("bad"),
      },
    });
    const duplicate = await server.inject({
      method: "POST",
      url: "/v1/admin/cards",
      headers: adminHeaders,
      payload: { issuerId: issuer.id, name: "Duplicate", slug },
    });
    const version = await server.inject({
      method: "POST",
      url: `/v1/admin/cards/${create.json().id}/versions`,
      headers: adminHeaders,
      payload: {
        versionName: "Initial",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
        annualFeeCents: 1000,
      },
    });
    const update = await server.inject({
      method: "PATCH",
      url: `/v1/admin/cards/${create.json().id}`,
      headers: adminHeaders,
      payload: { annualFeeCents: 2000, isActive: false },
    });
    const unchangedVersion = await prisma.cardVersion.findUniqueOrThrow({
      where: { id: version.json().id },
    });

    expect(create.statusCode).toBe(201);
    expect(invalidIssuer.statusCode).toBe(404);
    expect(duplicate.statusCode).toBe(409);
    expect(update.json().annualFeeCents).toBe(2000);
    expect(unchangedVersion.annualFeeCents).toBe(1000);

    await server.close();
  });

  it("validates card version dates and exposes card detail", async () => {
    const server = await buildSeededServer();
    const card = await createAdminCard(server);
    const invalid = await server.inject({
      method: "POST",
      url: `/v1/admin/cards/${card.id}/versions`,
      headers: adminHeaders,
      payload: {
        versionName: "Bad",
        effectiveFrom: "2026-02-01T00:00:00.000Z",
        effectiveTo: "2026-01-01T00:00:00.000Z",
      },
    });
    const version = await server.inject({
      method: "POST",
      url: `/v1/admin/cards/${card.id}/versions`,
      headers: adminHeaders,
      payload: {
        versionName: "Good",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
      },
    });
    const detail = await server.inject({
      method: "GET",
      url: `/v1/admin/cards/${card.id}`,
      headers: adminHeaders,
    });

    expect(invalid.statusCode).toBe(400);
    expect(version.statusCode).toBe(201);
    expect(detail.json().versions.length).toBeGreaterThan(0);

    await server.close();
  });
});
