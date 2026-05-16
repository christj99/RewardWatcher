import type { Prisma, User } from "@prisma/client";

import { prisma } from "@rewards-audit/db";

import { conflict, notFound } from "../lib/httpErrors.js";

const walletInclude = {
  card: {
    include: {
      issuer: true,
    },
  },
} satisfies Prisma.UserCardInclude;

export async function listWallet(user: User) {
  return prisma.userCard.findMany({
    where: {
      userId: user.id,
      isActive: true,
    },
    include: walletInclude,
    orderBy: {
      createdAt: "asc",
    },
  });
}

export async function addWalletCard(
  user: User,
  input: {
    cardId: string;
    nickname?: string | undefined;
    openedAt?: string | undefined;
    annualFeeDueMonth?: number | undefined;
    welcomeBonusDeadline?: string | undefined;
  },
) {
  const card = await prisma.card.findFirst({
    where: {
      id: input.cardId,
      isActive: true,
    },
  });

  if (!card) {
    throw notFound("Active card was not found.");
  }

  const existing = await prisma.userCard.findUnique({
    where: {
      userId_cardId: {
        userId: user.id,
        cardId: input.cardId,
      },
    },
  });

  if (existing?.isActive) {
    throw conflict("This card is already active in the user's wallet.");
  }

  const data = {
    ...(input.nickname !== undefined ? { nickname: input.nickname } : {}),
    ...(input.openedAt !== undefined
      ? { openedAt: new Date(input.openedAt) }
      : {}),
    ...(input.annualFeeDueMonth !== undefined
      ? { annualFeeDueMonth: input.annualFeeDueMonth }
      : {}),
    ...(input.welcomeBonusDeadline !== undefined
      ? { welcomeBonusDeadline: new Date(input.welcomeBonusDeadline) }
      : {}),
    isActive: true,
  };

  if (existing) {
    return prisma.userCard.update({
      where: { id: existing.id },
      data,
      include: walletInclude,
    });
  }

  return prisma.userCard.create({
    data: {
      ...data,
      userId: user.id,
      cardId: input.cardId,
    },
    include: walletInclude,
  });
}

export async function updateWalletCard(
  user: User,
  userCardId: string,
  input: {
    nickname?: string | null | undefined;
    openedAt?: string | null | undefined;
    annualFeeDueMonth?: number | null | undefined;
    welcomeBonusDeadline?: string | null | undefined;
    isActive?: boolean | undefined;
  },
) {
  await assertOwnsUserCard(user.id, userCardId);
  const data = {
    ...(input.nickname !== undefined ? { nickname: input.nickname } : {}),
    ...(input.openedAt !== undefined
      ? {
          openedAt: input.openedAt === null ? null : new Date(input.openedAt),
        }
      : {}),
    ...(input.annualFeeDueMonth !== undefined
      ? { annualFeeDueMonth: input.annualFeeDueMonth }
      : {}),
    ...(input.welcomeBonusDeadline !== undefined
      ? {
          welcomeBonusDeadline:
            input.welcomeBonusDeadline === null
              ? null
              : new Date(input.welcomeBonusDeadline),
        }
      : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
  };

  return prisma.userCard.update({
    where: { id: userCardId },
    data,
    include: walletInclude,
  });
}

export async function deactivateWalletCard(user: User, userCardId: string) {
  await assertOwnsUserCard(user.id, userCardId);

  return prisma.userCard.update({
    where: { id: userCardId },
    data: { isActive: false },
    include: walletInclude,
  });
}

async function assertOwnsUserCard(
  userId: string,
  userCardId: string,
): Promise<void> {
  const userCard = await prisma.userCard.findFirst({
    where: {
      id: userCardId,
      userId,
    },
  });

  if (!userCard) {
    throw notFound("Wallet card was not found for the current user.");
  }
}
