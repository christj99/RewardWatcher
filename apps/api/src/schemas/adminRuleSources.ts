import { z } from "zod";

import {
  listQuerySchema,
  optionalDateSchema,
  sourceTypeSchema,
} from "./adminShared.js";

export const adminRuleSourceListQuerySchema = listQuerySchema.extend({
  sourceType: sourceTypeSchema.optional(),
  staleOnly: z.coerce.boolean().optional(),
});

const ruleSourceBaseSchema = z.object({
  sourceType: sourceTypeSchema,
  title: z.string().trim().min(1),
  url: z.string().trim().url().nullable().optional(),
  retrievedAt: optionalDateSchema,
  verifiedAt: optionalDateSchema,
  notes: z.string().trim().min(1).nullable().optional(),
  createdBy: z.string().trim().min(1).nullable().optional(),
});

export const adminRuleSourceCreateSchema = ruleSourceBaseSchema.strict();

export const adminRuleSourceUpdateSchema = ruleSourceBaseSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one update field is required.",
  });
