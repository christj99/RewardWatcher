import type { AdminAuditAction, Prisma, User } from "@prisma/client";
import type { FastifyRequest } from "fastify";

import { prisma } from "@rewards-audit/db";

import { redactSensitive } from "../lib/redaction.js";

type AuditInput = {
  adminUserId?: string | null;
  action: AdminAuditAction;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  request?: FastifyRequest | undefined;
};

export async function recordAdminAuditLog(input: AuditInput) {
  const data: Prisma.AdminAuditLogUncheckedCreateInput = {
    adminUserId: input.adminUserId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    ipAddress: input.request?.ip ?? null,
    userAgent: input.request?.headers["user-agent"]?.toString() ?? null,
  };
  const before = toJson(input.before);
  const after = toJson(input.after);
  const metadata = toJson(input.metadata);
  if (before !== undefined) data.before = before;
  if (after !== undefined) data.after = after;
  if (metadata !== undefined) data.metadata = metadata;

  return prisma.adminAuditLog.create({
    data,
  });
}

export async function listAdminAuditLogs(
  _admin: User,
  input: {
    adminUserId?: string;
    entityType?: string;
    entityId?: string;
    action?: AdminAuditAction;
    startDate?: string;
    endDate?: string;
    limit: number;
  },
) {
  return prisma.adminAuditLog.findMany({
    where: {
      ...(input.adminUserId ? { adminUserId: input.adminUserId } : {}),
      ...(input.entityType ? { entityType: input.entityType } : {}),
      ...(input.entityId ? { entityId: input.entityId } : {}),
      ...(input.action ? { action: input.action } : {}),
      ...(input.startDate || input.endDate
        ? {
            createdAt: {
              ...(input.startDate ? { gte: new Date(input.startDate) } : {}),
              ...(input.endDate ? { lt: new Date(input.endDate) } : {}),
            },
          }
        : {}),
    },
    include: {
      adminUser: {
        select: { id: true, email: true, displayName: true },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: input.limit,
  });
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  return redactSensitive(value) as Prisma.InputJsonValue;
}
