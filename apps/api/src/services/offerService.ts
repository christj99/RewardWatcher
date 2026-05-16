import type { MerchantCategory, User, UserOfferStatus } from "@prisma/client";

import { prisma } from "@rewards-audit/db";

import { badRequest, notFound } from "../lib/httpErrors.js";

const offerInclude = {
  issuer: true,
  card: { include: { issuer: true } },
  merchant: true,
  bonusCurrency: true,
  source: true,
  userActivations: true,
};

export async function listUserOffers(
  user: User,
  input: {
    status?: UserOfferStatus | undefined;
    cardId?: string | undefined;
    merchantId?: string | undefined;
    category?: MerchantCategory | undefined;
    activeOnly: boolean;
    limit: number;
  },
) {
  const wallet = await loadWallet(user.id);
  const offers = await loadRelevantOffers(user.id, wallet, {
    cardId: input.cardId,
    merchantId: input.merchantId,
    category: input.category,
    activeOnly: input.activeOnly,
    limit: input.limit,
  });

  return offers
    .map((offer) => toUserOfferResponse(offer, wallet))
    .filter(
      (offer) => !input.status || offer.userActivation.status === input.status,
    )
    .filter(
      (offer) =>
        !input.activeOnly || offer.userActivation.status !== "DISMISSED",
    )
    .slice(0, input.limit);
}

export async function getUserOffer(user: User, id: string) {
  const wallet = await loadWallet(user.id);
  const offer = await prisma.issuerOffer.findUnique({
    where: { id },
    include: offerInclude,
  });
  if (!offer || matchingWalletCards(offer, wallet).length === 0) {
    throw notFound("Offer was not found for the current user's wallet.");
  }
  return toUserOfferResponse(offer, wallet);
}

export async function updateUserOfferActivation(
  user: User,
  offerId: string,
  input: {
    userCardId?: string | null | undefined;
    status: UserOfferStatus;
    notes?: string | null | undefined;
  },
) {
  const wallet = await loadWallet(user.id);
  const offer = await prisma.issuerOffer.findUnique({
    where: { id: offerId },
    include: offerInclude,
  });
  if (!offer) {
    throw notFound("Offer was not found.");
  }

  const matchingCards = matchingWalletCards(offer, wallet);
  if (matchingCards.length === 0) {
    throw notFound("Offer was not found for the current user's wallet.");
  }
  const userCard = input.userCardId
    ? matchingCards.find((candidate) => candidate.id === input.userCardId)
    : matchingCards[0];
  if (!userCard) {
    throw badRequest("User card is not eligible for this offer.");
  }

  const now = new Date();
  const activation = await prisma.userOfferActivation.upsert({
    where: {
      userId_issuerOfferId_userCardId: {
        userId: user.id,
        issuerOfferId: offer.id,
        userCardId: userCard.id,
      },
    },
    update: activationData(input.status, input.notes, now, offer.endsAt),
    create: {
      userId: user.id,
      issuerOfferId: offer.id,
      userCardId: userCard.id,
      ...activationData(input.status, input.notes, now, offer.endsAt),
    },
    include: {
      issuerOffer: { include: offerInclude },
      userCard: { include: { card: { include: { issuer: true } } } },
    },
  });

  return activation;
}

async function loadWallet(userId: string) {
  return prisma.userCard.findMany({
    where: { userId, isActive: true },
    include: { card: { include: { issuer: true } } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

async function loadRelevantOffers(
  userId: string,
  wallet: Awaited<ReturnType<typeof loadWallet>>,
  input: {
    cardId?: string | undefined;
    merchantId?: string | undefined;
    category?: MerchantCategory | undefined;
    activeOnly: boolean;
    limit: number;
  },
) {
  const now = new Date();
  const cardIds = wallet.map((userCard) => userCard.cardId);
  const issuerIds = [
    ...new Set(wallet.map((userCard) => userCard.card.issuerId)),
  ];
  return prisma.issuerOffer.findMany({
    where: {
      ...(input.cardId ? { cardId: input.cardId } : {}),
      ...(input.merchantId ? { merchantId: input.merchantId } : {}),
      ...(input.category ? { category: input.category } : {}),
      ...(input.activeOnly
        ? {
            AND: [
              { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
              { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
            ],
          }
        : {}),
      OR: [
        { cardId: { in: cardIds } },
        { issuerId: { in: issuerIds } },
        { cardId: null, issuerId: null },
      ],
    },
    include: {
      ...offerInclude,
      userActivations: {
        where: { userId },
      },
    },
    orderBy: [{ endsAt: "asc" }, { title: "asc" }, { id: "asc" }],
    take: input.limit * 2,
  });
}

function matchingWalletCards(
  offer: {
    cardId: string | null;
    issuerId: string | null;
  },
  wallet: Awaited<ReturnType<typeof loadWallet>>,
) {
  return wallet.filter((userCard) => {
    const cardMatches = !offer.cardId || offer.cardId === userCard.cardId;
    const issuerMatches =
      !offer.issuerId || offer.issuerId === userCard.card.issuerId;
    return cardMatches && issuerMatches;
  });
}

function toUserOfferResponse(
  offer: Awaited<ReturnType<typeof loadRelevantOffers>>[number],
  wallet: Awaited<ReturnType<typeof loadWallet>>,
) {
  const matchingCards = matchingWalletCards(offer, wallet);
  const activation =
    offer.userActivations.find((item) =>
      matchingCards.some((userCard) => userCard.id === item.userCardId),
    ) ?? offer.userActivations[0];
  return {
    offer,
    userActivation: activation
      ? {
          id: activation.id,
          status: activation.status,
          userCardId: activation.userCardId,
          activatedAt: activation.activatedAt,
          usedAt: activation.usedAt,
          dismissedAt: activation.dismissedAt,
          expiresAt: activation.expiresAt,
          notes: activation.notes,
        }
      : {
          id: null,
          status: "AVAILABLE" as const,
          userCardId: matchingCards[0]?.id ?? null,
          activatedAt: null,
          usedAt: null,
          dismissedAt: null,
          expiresAt: offer.endsAt,
          notes: null,
        },
    relevance: {
      matchingUserCards: matchingCards.map((userCard) => ({
        id: userCard.id,
        cardId: userCard.cardId,
        cardName: userCard.card.name,
        issuerName: userCard.card.issuer.name,
      })),
      reason: offer.cardId
        ? "Card-specific offer"
        : offer.issuerId
          ? "Issuer-level offer"
          : "Merchant or category offer",
    },
  };
}

function activationData(
  status: UserOfferStatus,
  notes: string | null | undefined,
  now: Date,
  offerEndsAt: Date | null,
) {
  return {
    status,
    ...(status === "ACTIVATED" ? { activatedAt: now } : {}),
    ...(status === "USED" ? { usedAt: now } : {}),
    ...(status === "DISMISSED" ? { dismissedAt: now } : {}),
    expiresAt: status === "EXPIRED" ? (offerEndsAt ?? now) : offerEndsAt,
    notes: notes ?? null,
  };
}
