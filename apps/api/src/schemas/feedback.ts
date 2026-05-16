import {
  BetaUserStatus,
  FeedbackSeverity,
  FeedbackStatus,
  FeedbackType,
} from "@prisma/client";
import { z } from "zod";

const contextSchema = z
  .record(z.unknown())
  .optional()
  .refine(
    (value) => !value || JSON.stringify(value).length <= 8_000,
    "Feedback context is too large.",
  );

export const createFeedbackSchema = z
  .object({
    feedbackType: z.nativeEnum(FeedbackType),
    severity: z.nativeEnum(FeedbackSeverity).default("MEDIUM"),
    title: z.string().trim().min(1).max(160),
    message: z.string().trim().min(1).max(4_000),
    pageUrl: z.string().trim().url().max(1_000).optional(),
    context: contextSchema,
    linkedRecommendationEventId: z.string().min(1).optional(),
    linkedTransactionId: z.string().min(1).optional(),
    linkedOutcomeId: z.string().min(1).optional(),
  })
  .strict();

export const feedbackListQuerySchema = z.object({
  status: z.nativeEnum(FeedbackStatus).optional(),
  feedbackType: z.nativeEnum(FeedbackType).optional(),
  severity: z.nativeEnum(FeedbackSeverity).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const adminFeedbackListQuerySchema = feedbackListQuerySchema.extend({
  userId: z.string().min(1).optional(),
  assignedAdminUserId: z.string().min(1).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

export const updateFeedbackSchema = z
  .object({
    status: z.nativeEnum(FeedbackStatus).optional(),
    severity: z.nativeEnum(FeedbackSeverity).optional(),
    assignedAdminUserId: z.string().min(1).nullable().optional(),
    resolutionNotes: z.string().trim().max(4_000).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one update field is required.",
  });

export const feedbackParamsSchema = z.object({
  id: z.string().min(1),
});

export const betaUserListQuerySchema = z.object({
  status: z.nativeEnum(BetaUserStatus).optional(),
  cohortId: z.string().min(1).optional(),
  tag: z.string().min(1).optional(),
  q: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

export const updateBetaUserSchema = z
  .object({
    status: z.nativeEnum(BetaUserStatus).optional(),
    cohortId: z.string().min(1).nullable().optional(),
    notes: z.string().trim().max(4_000).nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one update field is required.",
  });

export const createBetaCohortSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    slug: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(1_000).nullable().optional(),
    startsAt: z.string().datetime().nullable().optional(),
    endsAt: z.string().datetime().nullable().optional(),
  })
  .strict();

export const updateBetaCohortSchema = createBetaCohortSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one update field is required.",
  });

export const betaCohortParamsSchema = z.object({
  id: z.string().min(1),
});

export const betaUserParamsSchema = z.object({
  userId: z.string().min(1),
});

export const createSupportNoteSchema = z
  .object({
    note: z.string().trim().min(1).max(4_000),
  })
  .strict();
