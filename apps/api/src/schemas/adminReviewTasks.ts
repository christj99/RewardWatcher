import { z } from "zod";

export const reviewTaskStatusSchema = z.enum([
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "REJECTED",
]);

export const reviewTaskTypeSchema = z.enum([
  "CARD_RULE_REVIEW",
  "MERCHANT_MAPPING_REVIEW",
  "POSTING_PROFILE_REVIEW",
  "OFFER_REVIEW",
  "OTHER",
]);

export const prioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const adminReviewTaskListQuerySchema = z.object({
  status: reviewTaskStatusSchema.optional(),
  taskType: reviewTaskTypeSchema.optional(),
  priority: prioritySchema.optional(),
  correctionId: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const adminReviewTaskUpdateSchema = z
  .object({
    status: reviewTaskStatusSchema.optional(),
    priority: prioritySchema.optional(),
    resolutionNotes: z.string().trim().min(1).nullable().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.status || value.priority || value.resolutionNotes !== undefined,
    {
      message: "At least one update field is required.",
    },
  );

export const adminReviewTaskParamsSchema = z.object({
  id: z.string().min(1),
});
