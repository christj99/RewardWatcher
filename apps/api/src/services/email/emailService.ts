import type { EmailLog, EmailStatus, EmailType, Prisma } from "@prisma/client";

import { prisma } from "@rewards-audit/db";

import { redactSensitive } from "../../lib/redaction.js";
import { getEmailProvider } from "./emailProvider.js";
import type { SendTransactionalEmailInput } from "./types.js";

export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput,
): Promise<EmailLog> {
  if (input.idempotencyKey) {
    const existing = await prisma.emailLog.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing?.status === "SENT" || existing?.status === "SKIPPED") {
      return existing;
    }
  }

  const provider = getEmailProvider();
  const baseData: Prisma.EmailLogUncheckedCreateInput = {
    userId: input.userId ?? null,
    toEmailRedacted: redactEmail(input.to),
    emailType: input.emailType,
    subject: input.subject,
    provider: provider.name,
    status: "QUEUED",
  };
  if (input.idempotencyKey) baseData.idempotencyKey = input.idempotencyKey;
  const metadata = toJson(input.metadata);
  if (metadata !== undefined) baseData.metadata = metadata;
  const log = input.idempotencyKey
    ? await prisma.emailLog.upsert({
        where: { idempotencyKey: input.idempotencyKey },
        create: baseData,
        update: { ...baseData, errorMessage: null },
      })
    : await prisma.emailLog.create({
        data: baseData,
      });

  try {
    const result = await provider.sendEmail(input);
    return prisma.emailLog.update({
      where: { id: log.id },
      data: {
        status: "SENT",
        provider: result.provider,
        providerMessageId: result.providerMessageId ?? null,
        sentAt: new Date(),
        errorMessage: null,
      },
    });
  } catch (error) {
    return prisma.emailLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        errorMessage:
          error instanceof Error ? error.message : "Email send failed.",
      },
    });
  }
}

export async function createSkippedEmailLog(
  input: Omit<SendTransactionalEmailInput, "text"> & { reason: string },
) {
  if (input.idempotencyKey) {
    const existing = await prisma.emailLog.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;
  }
  const data: Prisma.EmailLogUncheckedCreateInput = {
    userId: input.userId ?? null,
    toEmailRedacted: redactEmail(input.to),
    emailType: input.emailType,
    subject: input.subject,
    status: "SKIPPED",
    provider: getEmailProvider().name,
  };
  if (input.idempotencyKey) data.idempotencyKey = input.idempotencyKey;
  const baseMetadata =
    input.metadata && typeof input.metadata === "object" ? input.metadata : {};
  const metadata = toJson({ ...baseMetadata, reason: input.reason });
  if (metadata !== undefined) data.metadata = metadata;
  return prisma.emailLog.create({ data });
}

export async function listEmailLogs(input: {
  userId?: string | undefined;
  emailType?: EmailType | undefined;
  status?: EmailStatus | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  limit: number;
}) {
  return prisma.emailLog.findMany({
    where: {
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.emailType ? { emailType: input.emailType } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.startDate || input.endDate
        ? {
            createdAt: {
              ...(input.startDate ? { gte: new Date(input.startDate) } : {}),
              ...(input.endDate ? { lt: new Date(input.endDate) } : {}),
            },
          }
        : {}),
    },
    include: { user: { select: { id: true, email: true, displayName: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: input.limit,
  });
}

export function redactEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "[REDACTED]";
  return `${local.slice(0, 1)}***@${domain}`;
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return redactSensitive(value) as Prisma.InputJsonValue;
}
