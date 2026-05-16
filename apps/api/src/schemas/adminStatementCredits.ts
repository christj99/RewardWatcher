import { z } from "zod";

import {
  confidenceSchema,
  merchantCategorySchema,
  optionalDateSchema,
  recurrenceSchema,
} from "./adminShared.js";

export const adminStatementCreditListQuerySchema = z.object({
  cardId: z.string().min(1).optional(),
  merchantId: z.string().min(1).optional(),
  category: merchantCategorySchema.optional(),
  recurrence: recurrenceSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

const statementCreditBaseSchema = z.object({
  cardId: z.string().min(1),
  cardVersionId: z.string().min(1).nullable().optional(),
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  amountCents: z.number().int().positive(),
  recurrence: recurrenceSchema,
  merchantId: z.string().min(1).nullable().optional(),
  category: merchantCategorySchema.nullable().optional(),
  activationRequired: z.boolean().optional(),
  confidence: confidenceSchema,
  sourceId: z.string().min(1).nullable().optional(),
  startsAt: optionalDateSchema,
  endsAt: optionalDateSchema,
});

export const adminStatementCreditCreateSchema =
  statementCreditBaseSchema.strict();

export const adminStatementCreditUpdateSchema = statementCreditBaseSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one update field is required.",
  });
