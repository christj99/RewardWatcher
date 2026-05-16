import {
  ScheduledJobName,
  ScheduledJobStatus,
  ScheduledJobTrigger,
} from "@prisma/client";
import { z } from "zod";

export const adminJobRunsQuerySchema = z.object({
  jobName: z.nativeEnum(ScheduledJobName).optional(),
  status: z.nativeEnum(ScheduledJobStatus).optional(),
  trigger: z.nativeEnum(ScheduledJobTrigger).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

export const adminJobRunParamsSchema = z.object({
  id: z.string().min(1),
});

export const adminRunJobSchema = z.object({
  jobName: z.nativeEnum(ScheduledJobName),
  input: z.record(z.unknown()).optional(),
  dryRun: z.boolean().optional(),
  idempotencyKey: z.string().min(1).optional(),
});
