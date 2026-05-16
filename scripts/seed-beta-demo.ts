import {
  ConfidenceLevel,
  CorrectionStatus,
  CorrectionType,
  EmailStatus,
  EmailType,
  EntitlementKey,
  EntitlementSource,
  Lens,
  MerchantCategory,
  OutcomeType,
  Prisma,
  RecommendationContext,
  ReminderRecurrence,
  ReminderSource,
  ReminderStatus,
  ReminderType,
  ReviewTaskType,
  ScheduledJobName,
  ScheduledJobStatus,
  ScheduledJobTrigger,
  StatementCreditUsageSource,
  StatementCreditUsageStatus,
  TransactionSource,
  UserOfferStatus,
} from "@prisma/client";

import { prisma, seedDatabase } from "@rewards-audit/db";

import { hashPassword } from "../apps/api/src/lib/password.js";

const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "DemoPassword12345!";

export async function seedBetaDemo() {
  if (
    (process.env.APP_ENV === "production" ||
      process.env.NODE_ENV === "production") &&
    process.env.ALLOW_BETA_DEMO_SEED !== "true"
  ) {
    throw new Error(
      "Refusing to seed beta demo data in production without ALLOW_BETA_DEMO_SEED=true.",
    );
  }

  await seedDatabase();

  const demo = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {
      displayName: "Demo User",
      plaidBetaEnabled: true,
    },
    create: {
      email: DEMO_EMAIL,
      displayName: "Demo User",
      plaidBetaEnabled: true,
    },
  });

  await prisma.authCredential.upsert({
    where: { userId: demo.id },
    update: {},
    create: {
      userId: demo.id,
      passwordHash: await hashPassword(DEMO_PASSWORD),
      passwordUpdatedAt: new Date(),
    },
  });

  for (const key of Object.values(EntitlementKey)) {
    if (key === EntitlementKey.BASIC_RECOMMENDATIONS) continue;
    const existing = await prisma.entitlementGrant.findFirst({
      where: { userId: demo.id, key, source: EntitlementSource.FOUNDING_BETA },
    });
    if (existing) {
      await prisma.entitlementGrant.update({
        where: { id: existing.id },
        data: { active: true, expiresAt: null, notes: "Demo beta access." },
      });
    } else {
      await prisma.entitlementGrant.create({
        data: {
          userId: demo.id,
          key,
          source: EntitlementSource.FOUNDING_BETA,
          notes: "Demo beta access.",
        },
      });
    }
  }

  const [amexGold, freedomUnlimited, target, starbucks] = await Promise.all([
    prisma.card.findUniqueOrThrow({ where: { slug: "amex-gold" } }),
    prisma.card.findUniqueOrThrow({
      where: { slug: "chase-freedom-unlimited" },
    }),
    prisma.merchant.findUniqueOrThrow({ where: { slug: "target" } }),
    prisma.merchant.findUniqueOrThrow({ where: { slug: "starbucks" } }),
  ]);

  const [amexUserCard, cfuUserCard] = await Promise.all([
    prisma.userCard.upsert({
      where: { userId_cardId: { userId: demo.id, cardId: amexGold.id } },
      update: {
        isActive: true,
        annualFeeDueMonth: 6,
        welcomeBonusDeadline: new Date("2026-06-15T12:00:00.000Z"),
      },
      create: {
        userId: demo.id,
        cardId: amexGold.id,
        nickname: "Demo Amex Gold",
        openedAt: new Date("2026-01-15T12:00:00.000Z"),
        annualFeeDueMonth: 6,
        welcomeBonusDeadline: new Date("2026-06-15T12:00:00.000Z"),
      },
    }),
    prisma.userCard.upsert({
      where: {
        userId_cardId: { userId: demo.id, cardId: freedomUnlimited.id },
      },
      update: { isActive: true, annualFeeDueMonth: 10 },
      create: {
        userId: demo.id,
        cardId: freedomUnlimited.id,
        nickname: "Demo Freedom Unlimited",
        openedAt: new Date("2025-10-01T12:00:00.000Z"),
        annualFeeDueMonth: 10,
      },
    }),
  ]);

  const recommendation = await prisma.recommendationEvent.upsert({
    where: { id: "demo-recommendation-target-2026-05-01" },
    update: {
      userId: demo.id,
      merchantId: target.id,
      recommendedUserCardId: amexUserCard.id,
      recommendedCardId: amexGold.id,
    },
    create: {
      id: "demo-recommendation-target-2026-05-01",
      userId: demo.id,
      merchantId: target.id,
      merchantNameInput: "Target",
      purchaseAmountCents: 2295,
      context: RecommendationContext.MANUAL_LOOKUP,
      lens: Lens.PRACTICAL,
      recommendedUserCardId: amexUserCard.id,
      recommendedCardId: amexGold.id,
      expectedCategory: MerchantCategory.GENERAL,
      expectedValueCents: new Prisma.Decimal("280.0"),
      confidence: ConfidenceLevel.MEDIUM,
      explanation:
        "Demo fixture: Amex Gold wins because a curated activated offer contributes extra expected value.",
      inputSnapshot: { source: "beta-demo", merchant: "Target" },
      rankingSnapshot: {
        rankedCards: [
          { cardSlug: "amex-gold", expectedValueCents: "280.0" },
          { cardSlug: "chase-freedom-unlimited", expectedValueCents: "34.4" },
        ],
      },
      ruleSnapshot: {
        source: "beta-demo",
        appliedOfferIds: ["seed-offer-amex-gold-uber-eats-credit"],
      },
    },
  });

  const transaction = await prisma.transaction.upsert({
    where: { id: "demo-transaction-starbucks-2026-05-02" },
    update: {
      userId: demo.id,
      userCardId: cfuUserCard.id,
      merchantId: starbucks.id,
    },
    create: {
      id: "demo-transaction-starbucks-2026-05-02",
      userId: demo.id,
      userCardId: cfuUserCard.id,
      merchantId: starbucks.id,
      rawMerchantName: "STARBUCKS",
      normalizedMerchantName: "Starbucks",
      amountCents: 1825,
      transactionDate: new Date("2026-05-02T14:00:00.000Z"),
      postedDate: new Date("2026-05-03T14:00:00.000Z"),
      source: TransactionSource.TEST_FIXTURE,
      externalId: "demo-starbucks-2026-05-02",
      observedCategory: MerchantCategory.DINING,
      rawData: { fixture: "beta-demo" },
    },
  });

  await prisma.recommendationOutcome.upsert({
    where: { id: "demo-outcome-starbucks-2026-05-02" },
    update: {
      userId: demo.id,
      transactionId: transaction.id,
      recommendationEventId: recommendation.id,
    },
    create: {
      id: "demo-outcome-starbucks-2026-05-02",
      userId: demo.id,
      recommendationEventId: recommendation.id,
      transactionId: transaction.id,
      outcomeType: OutcomeType.USER_MISSED_VALUE,
      actualUserCardId: cfuUserCard.id,
      bestUserCardId: amexUserCard.id,
      recommendedUserCardId: amexUserCard.id,
      expectedValueCents: new Prisma.Decimal("116.8"),
      capturedValueCents: new Prisma.Decimal("27.4"),
      missedValueCents: new Prisma.Decimal("89.4"),
      recommendationWasCorrect: true,
      confidence: ConfidenceLevel.MEDIUM,
      explanation:
        "Demo fixture: using Freedom Unlimited plausibly missed higher dining rewards.",
      computedAt: new Date("2026-05-04T12:00:00.000Z"),
    },
  });

  await prisma.reminder.upsert({
    where: { id: "demo-reminder-welcome-bonus" },
    update: {
      userId: demo.id,
      userCardId: amexUserCard.id,
      status: ReminderStatus.SCHEDULED,
    },
    create: {
      id: "demo-reminder-welcome-bonus",
      userId: demo.id,
      userCardId: amexUserCard.id,
      reminderType: ReminderType.WELCOME_BONUS_DEADLINE,
      title: "Check welcome bonus deadline for Amex Gold",
      description: "Demo reminder tied to wallet value.",
      dueAt: new Date("2026-06-01T12:00:00.000Z"),
      status: ReminderStatus.SCHEDULED,
      recurrence: ReminderRecurrence.NONE,
      source: ReminderSource.WELCOME_BONUS,
    },
  });

  const statementCredit = await prisma.statementCredit.findFirst({
    where: { cardId: amexGold.id },
    orderBy: [{ createdAt: "asc" }],
  });
  if (statementCredit) {
    await prisma.statementCreditUsage.upsert({
      where: {
        userCardId_statementCreditId_periodStart_periodEnd: {
          userCardId: amexUserCard.id,
          statementCreditId: statementCredit.id,
          periodStart: new Date("2026-05-01T00:00:00.000Z"),
          periodEnd: new Date("2026-05-31T23:59:59.000Z"),
        },
      },
      update: {
        userId: demo.id,
        status: StatementCreditUsageStatus.PARTIALLY_USED,
        amountUsedCents: 500,
        estimatedRemainingCents: Math.max(statementCredit.amountCents - 500, 0),
      },
      create: {
        userId: demo.id,
        userCardId: amexUserCard.id,
        statementCreditId: statementCredit.id,
        periodStart: new Date("2026-05-01T00:00:00.000Z"),
        periodEnd: new Date("2026-05-31T23:59:59.000Z"),
        status: StatementCreditUsageStatus.PARTIALLY_USED,
        amountUsedCents: 500,
        estimatedRemainingCents: Math.max(statementCredit.amountCents - 500, 0),
        source: StatementCreditUsageSource.GENERATED,
        matchedTransactionIds: [],
        evidence: { fixture: "beta-demo", caveat: "Estimated usage only." },
      },
    });
  }

  const offer = await prisma.issuerOffer.findFirst({
    where: { cardId: amexGold.id },
    orderBy: [{ createdAt: "asc" }],
  });
  if (offer) {
    const existingActivation = await prisma.userOfferActivation.findFirst({
      where: {
        userId: demo.id,
        issuerOfferId: offer.id,
        userCardId: amexUserCard.id,
      },
    });
    if (existingActivation) {
      await prisma.userOfferActivation.update({
        where: { id: existingActivation.id },
        data: { status: UserOfferStatus.ACTIVATED, activatedAt: new Date() },
      });
    } else {
      await prisma.userOfferActivation.create({
        data: {
          userId: demo.id,
          issuerOfferId: offer.id,
          userCardId: amexUserCard.id,
          status: UserOfferStatus.ACTIVATED,
          activatedAt: new Date(),
          notes: "Demo activated offer.",
        },
      });
    }
  }

  const correction = await prisma.recommendationCorrection.upsert({
    where: { id: "demo-correction-starbucks" },
    update: {
      userId: demo.id,
      recommendationEventId: recommendation.id,
      transactionId: transaction.id,
      status: CorrectionStatus.OPEN,
    },
    create: {
      id: "demo-correction-starbucks",
      userId: demo.id,
      recommendationEventId: recommendation.id,
      transactionId: transaction.id,
      correctionType: CorrectionType.WRONG_CATEGORY,
      userNote: "Demo correction: confirm Starbucks category mapping.",
      status: CorrectionStatus.OPEN,
    },
  });

  await prisma.curatorReviewTask.upsert({
    where: { id: "demo-review-starbucks" },
    update: {
      correctionId: correction.id,
      status: "OPEN",
      priority: "HIGH",
    },
    create: {
      id: "demo-review-starbucks",
      correctionId: correction.id,
      taskType: ReviewTaskType.MERCHANT_MAPPING_REVIEW,
      priority: "HIGH",
      title: "Demo review: Starbucks posting/category",
      description: "Seeded private beta readiness review task.",
    },
  });

  await prisma.emailLog.upsert({
    where: { idempotencyKey: "demo-email-log-weekly-audit" },
    update: {
      userId: demo.id,
      status: EmailStatus.SENT,
      sentAt: new Date("2026-05-05T12:00:00.000Z"),
    },
    create: {
      userId: demo.id,
      toEmailRedacted: "d***@example.com",
      emailType: EmailType.WEEKLY_AUDIT,
      subject: "Your weekly rewards audit",
      status: EmailStatus.SENT,
      provider: "console",
      idempotencyKey: "demo-email-log-weekly-audit",
      metadata: { fixture: "beta-demo" },
      sentAt: new Date("2026-05-05T12:00:00.000Z"),
    },
  });

  await prisma.scheduledJobRun.upsert({
    where: { idempotencyKey: "demo-job-run-weekly-audit" },
    update: {
      status: ScheduledJobStatus.SUCCEEDED,
      result: { fixture: "beta-demo", sentCount: 1 },
    },
    create: {
      jobName: ScheduledJobName.WEEKLY_AUDIT_EMAIL,
      status: ScheduledJobStatus.SUCCEEDED,
      triggeredBy: ScheduledJobTrigger.MANUAL,
      startedAt: new Date("2026-05-05T12:00:00.000Z"),
      finishedAt: new Date("2026-05-05T12:00:02.000Z"),
      durationMs: 2000,
      idempotencyKey: "demo-job-run-weekly-audit",
      result: { fixture: "beta-demo", sentCount: 1 },
    },
  });

  return {
    user: { id: demo.id, email: DEMO_EMAIL, password: DEMO_PASSWORD },
  };
}

if (process.argv[1]?.endsWith("seed-beta-demo.ts")) {
  seedBetaDemo()
    .then((result) => {
      console.log(
        `Seeded beta demo user ${result.user.email} / ${result.user.password}`,
      );
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
