import { describe, expect, it } from "vitest";

import { buildSeededServer, prisma } from "./testUtils.js";
import {
  adminHeaders,
  betaHeaders,
  createAdminCard,
  seededCurrency,
  seededMerchant,
} from "./adminPhase8Utils.js";
import { betaUserCard } from "./phase5TestUtils.js";

describe("issuer offer APIs and recommendation integration", () => {
  it("admin can create, update, list, and expire offers with validation", async () => {
    const server = await buildSeededServer();
    const card = await createAdminCard(server);
    const merchant = await seededMerchant("starbucks");
    const currency = await seededCurrency();

    const nonAdmin = await server.inject({
      method: "POST",
      url: "/v1/admin/offers",
      headers: betaHeaders,
      payload: offerPayload({ cardId: card.id, merchantId: merchant.id }),
    });
    const missingTarget = await server.inject({
      method: "POST",
      url: "/v1/admin/offers",
      headers: adminHeaders,
      payload: offerPayload({ cardId: null, merchantId: null, category: null }),
    });
    const created = await server.inject({
      method: "POST",
      url: "/v1/admin/offers",
      headers: adminHeaders,
      payload: offerPayload({ cardId: card.id, merchantId: merchant.id }),
    });
    const bonusMissingCurrency = await server.inject({
      method: "POST",
      url: "/v1/admin/offers",
      headers: adminHeaders,
      payload: {
        ...offerPayload({ cardId: card.id, merchantId: merchant.id }),
        offerType: "BONUS_POINTS",
        valueCents: null,
        bonusPoints: 1000,
      },
    });
    const bonus = await server.inject({
      method: "POST",
      url: "/v1/admin/offers",
      headers: adminHeaders,
      payload: {
        ...offerPayload({ cardId: card.id, merchantId: merchant.id }),
        title: "Bonus points offer",
        offerType: "BONUS_POINTS",
        valueCents: null,
        bonusPoints: 1000,
        bonusCurrencyId: currency.id,
      },
    });
    const updated = await server.inject({
      method: "PATCH",
      url: `/v1/admin/offers/${created.json().id}`,
      headers: adminHeaders,
      payload: { confidence: "LOW" },
    });
    const expired = await server.inject({
      method: "POST",
      url: `/v1/admin/offers/${created.json().id}/expire`,
      headers: adminHeaders,
      payload: { notes: "Retired in test." },
    });
    const list = await server.inject({
      method: "GET",
      url: `/v1/admin/offers?cardId=${card.id}`,
      headers: adminHeaders,
    });

    expect(nonAdmin.statusCode).toBe(403);
    expect(missingTarget.statusCode).toBe(400);
    expect(created.statusCode).toBe(201);
    expect(bonusMissingCurrency.statusCode).toBe(400);
    expect(bonus.statusCode).toBe(201);
    expect(updated.json().confidence).toBe("LOW");
    expect(expired.json().endsAt).toBeDefined();
    expect(list.json().length).toBeGreaterThanOrEqual(1);
    await server.close();
  });

  it("user can list and update relevant offer activation states", async () => {
    const server = await buildSeededServer();
    const offers = await server.inject({
      method: "GET",
      url: "/v1/offers",
      headers: betaHeaders,
    });
    const amexOffer = offers
      .json()
      .find((item: { offer: { id: string } }) =>
        item.offer.id.includes("amex-gold-uber-eats"),
      );
    const dismissed = await server.inject({
      method: "PATCH",
      url: `/v1/offers/${amexOffer.offer.id}/activation`,
      headers: betaHeaders,
      payload: {
        userCardId: amexOffer.userActivation.userCardId,
        status: "DISMISSED",
        notes: "Not useful this month.",
      },
    });
    const used = await server.inject({
      method: "PATCH",
      url: `/v1/offers/${amexOffer.offer.id}/activation`,
      headers: betaHeaders,
      payload: {
        userCardId: amexOffer.userActivation.userCardId,
        status: "USED",
      },
    });

    expect(offers.statusCode).toBe(200);
    expect(amexOffer.userActivation.status).toBe("ACTIVATED");
    expect(dismissed.json().status).toBe("DISMISSED");
    expect(used.json().status).toBe("USED");
    await server.close();
  });

  it("prevents activating offers for cards outside the user's wallet", async () => {
    const server = await buildSeededServer();
    const card = await createAdminCard(server);
    const merchant = await seededMerchant("starbucks");
    const created = await server.inject({
      method: "POST",
      url: "/v1/admin/offers",
      headers: adminHeaders,
      payload: offerPayload({ cardId: card.id, merchantId: merchant.id }),
    });
    const activation = await server.inject({
      method: "PATCH",
      url: `/v1/offers/${created.json().id}/activation`,
      headers: betaHeaders,
      payload: { status: "ACTIVATED" },
    });

    expect(activation.statusCode).toBe(404);
    await server.close();
  });

  it("activated offers affect recommendations while unactivated offers warn", async () => {
    const server = await buildSeededServer();
    const uberEats = await prisma.merchant.findUniqueOrThrow({
      where: { slug: "uber-eats" },
    });
    const airbnb = await prisma.merchant.findUniqueOrThrow({
      where: { slug: "airbnb" },
    });
    const activated = await server.inject({
      method: "POST",
      url: "/v1/recommendations",
      headers: betaHeaders,
      payload: {
        merchantId: uberEats.id,
        purchaseAmountCents: 2000,
        lens: "PRACTICAL",
      },
    });
    const available = await server.inject({
      method: "POST",
      url: "/v1/recommendations",
      headers: betaHeaders,
      payload: {
        merchantId: airbnb.id,
        purchaseAmountCents: 15000,
        lens: "PRACTICAL",
      },
    });

    expect(activated.statusCode).toBe(201);
    expect(activated.json().ruleSnapshot.appliedOfferIds as string[]).toContain(
      "seed-offer-amex-gold-uber-eats-credit",
    );
    expect(
      activated.json().primaryRecommendation.expectedValueCents,
    ).toBeGreaterThan(1000);
    expect(available.statusCode).toBe(201);
    expect(
      available.json().ruleSnapshot
        .availableButNotActivatedOfferIds as string[],
    ).toContain("seed-offer-csp-airbnb-credit");
    expect(available.json().warnings.join(" ")).toContain("must be activated");
    await server.close();
  });

  it("audit includes missed value from activated offers", async () => {
    const server = await buildSeededServer();
    const userCard = await betaUserCard("chase-freedom-unlimited");
    const merchant = await prisma.merchant.findUniqueOrThrow({
      where: { slug: "uber-eats" },
    });
    const transaction = await prisma.transaction.create({
      data: {
        userId: userCard.userId,
        userCardId: userCard.id,
        merchantId: merchant.id,
        rawMerchantName: "UBER EATS",
        normalizedMerchantName: "uber eats",
        amountCents: 2000,
        transactionDate: new Date("2026-06-01T12:00:00.000Z"),
        source: "TEST_FIXTURE",
        observedCategory: "DINING",
      },
    });

    const response = await server.inject({
      method: "POST",
      url: `/v1/transactions/${transaction.id}/audit`,
      headers: betaHeaders,
    });

    expect(response.statusCode).toBe(200);
    expect(Number(response.json().missedValueCents)).toBeGreaterThan(1000);
    expect(response.json().explanation.toLowerCase()).toContain("offer");
    await server.close();
  });
});

function offerPayload(input: {
  cardId?: string | null;
  merchantId?: string | null;
  category?: string | null;
}) {
  return {
    cardId: input.cardId,
    merchantId: input.merchantId,
    category: input.category === undefined ? "DINING" : input.category,
    title: "Admin test offer",
    description: "Admin test offer description.",
    offerType: "STATEMENT_CREDIT",
    valueCents: 500,
    minSpendCents: 1000,
    maxRewardCents: 500,
    activationRequired: true,
    startsAt: "2026-01-01T00:00:00.000Z",
    endsAt: "2026-12-31T23:59:59.000Z",
    confidence: "HIGH",
  };
}
