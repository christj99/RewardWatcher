import type { Prisma, ScheduledJobName } from "@prisma/client";

import { prisma } from "@rewards-audit/db";

type LockHandle = {
  id: string;
  jobName: ScheduledJobName;
  lockedBy: string;
};

export async function acquireJobLock(input: {
  jobName: ScheduledJobName;
  lockedBy: string;
  ttlMs: number;
  metadata?: Prisma.InputJsonValue | undefined;
}): Promise<LockHandle | null> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + input.ttlMs);
  const existing = await prisma.scheduledJobLock.findUnique({
    where: { jobName: input.jobName },
  });

  if (existing && existing.expiresAt > now) {
    return null;
  }

  if (existing) {
    try {
      const data: Prisma.ScheduledJobLockUpdateInput = {
        lockedAt: now,
        lockedBy: input.lockedBy,
        expiresAt,
      };
      if (input.metadata !== undefined) {
        data.metadata = input.metadata;
      }
      const replaced = await prisma.scheduledJobLock.update({
        where: { id: existing.id },
        data,
      });
      return {
        id: replaced.id,
        jobName: replaced.jobName,
        lockedBy: replaced.lockedBy,
      };
    } catch {
      return null;
    }
  }

  try {
    const data: Prisma.ScheduledJobLockUncheckedCreateInput = {
      jobName: input.jobName,
      lockedAt: now,
      lockedBy: input.lockedBy,
      expiresAt,
    };
    if (input.metadata !== undefined) {
      data.metadata = input.metadata;
    }
    const created = await prisma.scheduledJobLock.create({
      data,
    });
    return {
      id: created.id,
      jobName: created.jobName,
      lockedBy: created.lockedBy,
    };
  } catch {
    return null;
  }
}

export async function releaseJobLock(handle: LockHandle): Promise<void> {
  await prisma.scheduledJobLock.deleteMany({
    where: {
      id: handle.id,
      jobName: handle.jobName,
      lockedBy: handle.lockedBy,
    },
  });
}
