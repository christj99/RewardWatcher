import { z } from "zod";

import {
  benefitTypeSchema,
  confidenceSchema,
  optionalDateSchema,
} from "./adminShared.js";

export const adminBenefitListQuerySchema = z.object({
  cardId: z.string().min(1).optional(),
  benefitType: benefitTypeSchema.optional(),
  confidence: confidenceSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

const benefitBaseSchema = z.object({
  cardId: z.string().min(1),
  cardVersionId: z.string().min(1).nullable().optional(),
  benefitType: benefitTypeSchema,
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  estimatedValueCents: z.number().int().min(0).nullable().optional(),
  confidence: confidenceSchema,
  sourceId: z.string().min(1).nullable().optional(),
  startsAt: optionalDateSchema,
  endsAt: optionalDateSchema,
});

export const adminBenefitCreateSchema = benefitBaseSchema.strict();

export const adminBenefitUpdateSchema = benefitBaseSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one update field is required.",
  });
