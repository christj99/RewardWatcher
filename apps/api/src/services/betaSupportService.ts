import type { BetaUserStatus, Prisma, User } from "@prisma/client";
import type { FastifyRequest } from "fastify";

import { prisma } from "@rewards-audit/db";

import { conflict, notFound } from "../lib/httpErrors.js";
import { redactSensitive } from "../lib/redaction.js";
import { recordAdminAuditLog } from "./adminAuditLogService.js";

export async function listBetaUsers(input: {
  status?: BetaUserStatus | undefined;
  cohortId?: string | undefined;
  tag?: string | undefined;
  q?: string | undefined;
  limit: number;
}) {
  const users = await prisma.user.findMany({
    where: {
      ...(input.q
        ? {
            OR: [
              { email: { contains: input.q, mode: "insensitive" } },
              { displayName: { contains: input.q, mode: "insensitive" } },
            ],
          }
        : {}),
      betaProfile: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.cohortId ? { cohortId: input.cohortId } : {}),
        ...(input.tag ? { tags: { has: input.tag } } : {}),
      },
    },
    include: {
      betaProfile: { include: { cohort: true } },
      subscriptions: { orderBy: { updatedAt: "desc" }, take: 1 },
      _count: {
        select: {
          recommendationEvents: true,
          recommendationOutcomes: true,
          feedbackReports: true,
          supportNotes: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: input.limit,
  });
  const userIds = users.map((user) => user.id);
  const [lastEvents, plaidConnections] = await Promise.all([
    prisma.betaEvent.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds } },
      _max: { createdAt: true },
    }),
    prisma.plaidConnection.groupBy({
      by: ["userId", "status"],
      where: { userId: { in: userIds } },
      _count: { _all: true },
    }),
  ]);
  const lastEventByUser = new Map(
    lastEvents.map((event) => [event.userId, event._max.createdAt]),
  );
  return users.map((user) => ({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    plaidBetaEnabled: user.plaidBetaEnabled,
    createdAt: user.createdAt,
    betaProfile: user.betaProfile,
    milestones: {
      recommendationCount: user._count.recommendationEvents,
      transactionAuditCount: user._count.recommendationOutcomes,
      feedbackCount: user._count.feedbackReports,
      supportNoteCount: user._count.supportNotes,
      lastActiveAt: lastEventByUser.get(user.id) ?? null,
    },
    subscriptionStatus: user.subscriptions[0]?.status ?? null,
    plaidStatusCounts: Object.fromEntries(
      plaidConnections
        .filter((connection) => connection.userId === user.id)
        .map((connection) => [connection.status, connection._count._all]),
    ),
  }));
}

export async function updateBetaUserProfile(
  admin: User,
  userId: string,
  input: {
    status?: BetaUserStatus | undefined;
    cohortId?: string | null | undefined;
    notes?: string | null | undefined;
    tags?: string[] | undefined;
  },
  request?: FastifyRequest,
) {
  await assertUserExists(userId);
  if (input.cohortId) {
    await assertCohortExists(input.cohortId);
  }
  const before = await prisma.userBetaProfile.findUnique({ where: { userId } });
  const after = await prisma.userBetaProfile.upsert({
    where: { userId },
    update: {
      ...(input.status ? { status: input.status } : {}),
      ...(input.cohortId !== undefined ? { cohortId: input.cohortId } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.tags !== undefined ? { tags: input.tags } : {}),
    },
    create: {
      userId,
      status: input.status ?? "INVITED",
      cohortId: input.cohortId ?? null,
      notes: input.notes ?? null,
      tags: input.tags ?? [],
      invitedAt: new Date(),
    },
    include: { cohort: true, user: true },
  });
  await recordAdminAuditLog({
    adminUserId: admin.id,
    action: "UPDATE",
    entityType: "UserBetaProfile",
    entityId: after.id,
    before,
    after,
    request,
  });
  return after;
}

export async function listBetaCohorts() {
  return prisma.betaCohort.findMany({
    include: { _count: { select: { betaProfiles: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
}

export async function createBetaCohort(
  admin: User,
  input: CohortInput & { name: string },
  request?: FastifyRequest,
) {
  const slug = input.slug ? slugify(input.slug) : slugify(input.name);
  const existing = await prisma.betaCohort.findUnique({ where: { slug } });
  if (existing) throw conflict("Beta cohort slug already exists.");
  const cohort = await prisma.betaCohort.create({
    data: cohortData({ ...input, slug }),
  });
  await recordAdminAuditLog({
    adminUserId: admin.id,
    action: "CREATE",
    entityType: "BetaCohort",
    entityId: cohort.id,
    after: cohort,
    request,
  });
  return cohort;
}

export async function updateBetaCohort(
  admin: User,
  id: string,
  input: Partial<CohortInput>,
  request?: FastifyRequest,
) {
  const before = await assertCohortExists(id);
  const slug = input.slug ? slugify(input.slug) : undefined;
  if (slug && slug !== before.slug) {
    const existing = await prisma.betaCohort.findUnique({ where: { slug } });
    if (existing) throw conflict("Beta cohort slug already exists.");
  }
  const data = cohortData(input);
  if (slug) data.slug = slug;
  const after = await prisma.betaCohort.update({
    where: { id },
    data,
  });
  await recordAdminAuditLog({
    adminUserId: admin.id,
    action: "UPDATE",
    entityType: "BetaCohort",
    entityId: id,
    before,
    after,
    request,
  });
  return after;
}

export async function listSupportNotes(userId: string) {
  await assertUserExists(userId);
  return prisma.supportNote.findMany({
    where: { userId },
    include: {
      adminUser: { select: { id: true, email: true, displayName: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
}

export async function createSupportNote(
  admin: User,
  userId: string,
  note: string,
  request?: FastifyRequest,
) {
  await assertUserExists(userId);
  const created = await prisma.supportNote.create({
    data: {
      userId,
      adminUserId: admin.id,
      note: redactNote(note),
    },
    include: {
      adminUser: { select: { id: true, email: true, displayName: true } },
    },
  });
  await recordAdminAuditLog({
    adminUserId: admin.id,
    action: "CREATE",
    entityType: "SupportNote",
    entityId: created.id,
    after: created,
    request,
  });
  return created;
}

type CohortInput = {
  name?: string | undefined;
  slug?: string | undefined;
  description?: string | null | undefined;
  startsAt?: string | null | undefined;
  endsAt?: string | null | undefined;
};

function cohortData(input: CohortInput): Prisma.BetaCohortUncheckedCreateInput {
  return {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.slug !== undefined ? { slug: input.slug } : {}),
    ...(input.description !== undefined
      ? { description: input.description }
      : {}),
    ...(input.startsAt !== undefined
      ? { startsAt: input.startsAt ? new Date(input.startsAt) : null }
      : {}),
    ...(input.endsAt !== undefined
      ? { endsAt: input.endsAt ? new Date(input.endsAt) : null }
      : {}),
  } as Prisma.BetaCohortUncheckedCreateInput;
}

async function assertUserExists(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw notFound("User was not found.");
  return user;
}

async function assertCohortExists(id: string) {
  const cohort = await prisma.betaCohort.findUnique({ where: { id } });
  if (!cohort) throw notFound("Beta cohort was not found.");
  return cohort;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function redactNote(note: string): string {
  const redacted = redactSensitive({ note }) as { note?: unknown };
  return typeof redacted.note === "string" ? redacted.note : note;
}
