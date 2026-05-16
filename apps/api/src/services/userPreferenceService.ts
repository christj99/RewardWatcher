import type {
  Card,
  MerchantCategory,
  PreferenceType,
  RecommendationEvent,
  User,
} from "@prisma/client";

import { prisma } from "@rewards-audit/db";

type PreferenceInput = {
  preferenceType: PreferenceType;
  reason?: string | undefined;
  suggestedCard?: Card | null | undefined;
  suggestedMerchantId?: string | undefined;
  suggestedCategory?: MerchantCategory | undefined;
};

type PreferenceResult = {
  userPreferenceRule: Awaited<
    ReturnType<typeof prisma.userPreferenceRule.findFirst>
  >;
  message: string;
};

export async function createPersonalPreferenceRuleIfUseful(
  user: User,
  recommendation: RecommendationEvent,
  input: PreferenceInput,
): Promise<PreferenceResult> {
  if (
    (input.preferenceType === "PREFER_CARD" ||
      input.preferenceType === "AVOID_CARD") &&
    !input.suggestedCard
  ) {
    return {
      userPreferenceRule: null,
      message:
        "Correction saved. No preference rule was created because a card was not provided.",
    };
  }

  if (input.preferenceType === "CUSTOM_NOTE" && !input.reason) {
    return {
      userPreferenceRule: null,
      message:
        "Correction saved. No preference rule was created because a note was not provided.",
    };
  }

  const cardId = input.suggestedCard?.id ?? null;
  const merchantId = input.suggestedMerchantId ?? recommendation.merchantId;
  const category = input.suggestedCategory ?? recommendation.expectedCategory;
  const reason = input.reason ?? null;

  const existing = await prisma.userPreferenceRule.findFirst({
    where: {
      userId: user.id,
      cardId,
      merchantId,
      category,
      preferenceType: input.preferenceType,
      reason,
    },
  });

  if (existing) {
    return {
      userPreferenceRule: existing,
      message:
        "Correction saved. Matching personal preference rule already existed.",
    };
  }

  const created = await prisma.userPreferenceRule.create({
    data: {
      userId: user.id,
      cardId,
      merchantId,
      category,
      preferenceType: input.preferenceType,
      reason,
    },
  });

  return {
    userPreferenceRule: created,
    message: "Correction saved and personal preference rule created.",
  };
}
