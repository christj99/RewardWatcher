import { z } from "zod";

import { correctionStatusSchema, correctionTypeSchema } from "./corrections.js";

export const adminCorrectionListQuerySchema = z.object({
  status: correctionStatusSchema.optional(),
  correctionType: correctionTypeSchema.optional(),
  userId: z.string().min(1).optional(),
  recommendationEventId: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const adminCorrectionUpdateSchema = z
  .object({
    status: correctionStatusSchema.optional(),
    resolutionNotes: z.string().trim().min(1).nullable().optional(),
  })
  .strict()
  .refine((value) => value.status || value.resolutionNotes !== undefined, {
    message: "At least one update field is required.",
  });

export const adminCorrectionParamsSchema = z.object({
  id: z.string().min(1),
});
