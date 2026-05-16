import type { Prisma, TransactionSource, User } from "@prisma/client";

import { prisma } from "@rewards-audit/db";

import { deletePlaidData as deletePlaidServiceData } from "./plaidService.js";

export async function listPrivacyRequests(user: User) {
  return prisma.privacyRequest.findMany({
    where: { userId: user.id },
    orderBy: [{ requestedAt: "desc" }, { id: "desc" }],
  });
}

export async function deleteUserPlaidData(user: User) {
  const request = await startPrivacyRequest(user.id, "DELETE_PLAID_DATA");
  try {
    const summary = user.plaidBetaEnabled
      ? await deletePlaidServiceData(user)
      : await deleteLocalPlaidData(user.id);
    return completePrivacyRequest(request.id, summary);
  } catch (error) {
    await failPrivacyRequest(request.id, error);
    throw error;
  }
}

async function deleteLocalPlaidData(userId: string) {
  const deleted = await deleteTransactionsForUser(userId, "PLAID");
  const accounts = await prisma.plaidAccount.deleteMany({ where: { userId } });
  const connections = await prisma.plaidConnection.updateMany({
    where: { userId },
    data: { status: "DISCONNECTED", cursor: null },
  });
  return {
    ...deleted,
    deletedPlaidAccountCount: accounts.count,
    disconnectedCount: connections.count,
  };
}

export async function deleteUserTransactions(
  user: User,
  source: TransactionSource | "ALL",
) {
  const request = await startPrivacyRequest(user.id, "DELETE_TRANSACTIONS");
  try {
    const summary = await deleteTransactionsForUser(user.id, source);
    return completePrivacyRequest(request.id, summary);
  } catch (error) {
    await failPrivacyRequest(request.id, error);
    throw error;
  }
}

export async function deleteUserAccount(user: User) {
  const request = await startPrivacyRequest(user.id, "DELETE_ACCOUNT");
  try {
    const transactionSummary = await deleteTransactionsForUser(user.id, "ALL");
    const [corrections, reviewTasks] = await deleteCorrectionsAndReviewTasks(
      user.id,
    );

    await prisma.$transaction([
      prisma.plaidAccount.deleteMany({ where: { userId: user.id } }),
      prisma.plaidSyncRun.deleteMany({ where: { userId: user.id } }),
      prisma.plaidConnection.deleteMany({ where: { userId: user.id } }),
      prisma.reminder.deleteMany({ where: { userId: user.id } }),
      prisma.statementCreditUsage.deleteMany({ where: { userId: user.id } }),
      prisma.userOfferActivation.deleteMany({ where: { userId: user.id } }),
      prisma.extensionAuthToken.deleteMany({ where: { userId: user.id } }),
      prisma.notificationPreference.deleteMany({ where: { userId: user.id } }),
      prisma.feedbackReport.deleteMany({ where: { userId: user.id } }),
      prisma.feedbackReport.updateMany({
        where: { assignedAdminUserId: user.id },
        data: { assignedAdminUserId: null },
      }),
      prisma.supportNote.deleteMany({
        where: { OR: [{ userId: user.id }, { adminUserId: user.id }] },
      }),
      prisma.betaEvent.deleteMany({ where: { userId: user.id } }),
      prisma.userBetaProfile.deleteMany({ where: { userId: user.id } }),
      prisma.emailLog.updateMany({
        where: { userId: user.id },
        data: { userId: null },
      }),
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
      prisma.authSession.deleteMany({ where: { userId: user.id } }),
      prisma.authCredential.deleteMany({ where: { userId: user.id } }),
      prisma.recommendationEvent.deleteMany({ where: { userId: user.id } }),
      prisma.capLedger.deleteMany({ where: { userId: user.id } }),
      prisma.userPreferenceRule.deleteMany({ where: { userId: user.id } }),
      prisma.userCard.deleteMany({ where: { userId: user.id } }),
      prisma.consentRecord.deleteMany({ where: { userId: user.id } }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          email: `deleted-user-${user.id}@deleted.local`,
          displayName: "Deleted User",
          plaidBetaEnabled: false,
          isAdmin: false,
        },
      }),
    ]);

    const summary = {
      ...transactionSummary,
      deletedCorrectionCount: corrections.count,
      deletedReviewTaskCount: reviewTasks.count,
      anonymizedUser: true,
      preservedSharedRewardsData: true,
    };
    return completePrivacyRequest(request.id, summary);
  } catch (error) {
    await failPrivacyRequest(request.id, error);
    throw error;
  }
}

export async function createExportRequest(user: User) {
  return prisma.privacyRequest.create({
    data: {
      userId: user.id,
      requestType: "EXPORT_DATA",
      status: "REQUESTED",
      requestedAt: new Date(),
      summary: {
        message: "Full portable export is queued for a later hardening phase.",
      },
    },
  });
}

async function startPrivacyRequest(
  userId: string,
  requestType: "DELETE_ACCOUNT" | "DELETE_PLAID_DATA" | "DELETE_TRANSACTIONS",
) {
  return prisma.privacyRequest.create({
    data: {
      userId,
      requestType,
      status: "PROCESSING",
      requestedAt: new Date(),
    },
  });
}

async function completePrivacyRequest(id: string, summary: unknown) {
  return prisma.privacyRequest.update({
    where: { id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      summary: summary as Prisma.InputJsonValue,
    },
  });
}

async function failPrivacyRequest(id: string, error: unknown) {
  await prisma.privacyRequest.update({
    where: { id },
    data: {
      status: "FAILED",
      completedAt: new Date(),
      summary: {
        message: error instanceof Error ? error.message : "Unknown error",
      },
    },
  });
}

async function deleteTransactionsForUser(
  userId: string,
  source: TransactionSource | "ALL",
) {
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      ...(source === "ALL" ? {} : { source }),
    },
    select: { id: true },
  });
  const transactionIds = transactions.map((transaction) => transaction.id);

  if (transactionIds.length === 0) {
    return { deletedTransactionCount: 0, deletedOutcomeCount: 0 };
  }

  const deletedOutcomes = await prisma.recommendationOutcome.deleteMany({
    where: { transactionId: { in: transactionIds } },
  });
  const deletedTransactions = await prisma.transaction.deleteMany({
    where: { id: { in: transactionIds } },
  });

  return {
    deletedTransactionCount: deletedTransactions.count,
    deletedOutcomeCount: deletedOutcomes.count,
  };
}

async function deleteCorrectionsAndReviewTasks(userId: string) {
  const corrections = await prisma.recommendationCorrection.findMany({
    where: { userId },
    select: { id: true },
  });
  const correctionIds = corrections.map((correction) => correction.id);
  const reviewTasks = await prisma.curatorReviewTask.deleteMany({
    where: { correctionId: { in: correctionIds } },
  });
  const deletedCorrections = await prisma.recommendationCorrection.deleteMany({
    where: { id: { in: correctionIds } },
  });
  return [deletedCorrections, reviewTasks] as const;
}
