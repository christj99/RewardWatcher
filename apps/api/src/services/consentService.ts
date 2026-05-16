import type { ConsentType, Prisma, User } from "@prisma/client";

import { prisma } from "@rewards-audit/db";

import { forbidden, notFound } from "../lib/httpErrors.js";

export async function listConsents(user: User) {
  return prisma.consentRecord.findMany({
    where: { userId: user.id },
    orderBy: [{ grantedAt: "desc" }, { id: "desc" }],
  });
}

export async function createConsent(
  user: User,
  input: { consentType: ConsentType; version: string; metadata?: unknown },
) {
  const existing = await prisma.consentRecord.findFirst({
    where: {
      userId: user.id,
      consentType: input.consentType,
      version: input.version,
      revokedAt: null,
    },
    orderBy: [{ grantedAt: "desc" }, { id: "desc" }],
  });
  if (existing) {
    return existing;
  }

  const data: Prisma.ConsentRecordUncheckedCreateInput = {
    userId: user.id,
    consentType: input.consentType,
    version: input.version,
    grantedAt: new Date(),
  };
  if (input.metadata !== undefined) {
    data.metadata = input.metadata as Prisma.InputJsonValue;
  }

  return prisma.consentRecord.create({ data });
}

export async function revokeConsent(user: User, id: string) {
  const consent = await prisma.consentRecord.findFirst({
    where: { id, userId: user.id },
  });
  if (!consent) {
    throw notFound("Consent record was not found for the current user.");
  }
  if (consent.revokedAt) {
    return consent;
  }

  return prisma.consentRecord.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
}

export async function hasActiveConsent(
  userId: string,
  consentType: ConsentType,
): Promise<boolean> {
  const consent = await prisma.consentRecord.findFirst({
    where: { userId, consentType, revokedAt: null },
  });
  return Boolean(consent);
}

export async function requireConsent(
  userId: string,
  consentType: ConsentType,
): Promise<void> {
  if (!(await hasActiveConsent(userId, consentType))) {
    throw forbidden(`${consentType} consent is required.`);
  }
}
