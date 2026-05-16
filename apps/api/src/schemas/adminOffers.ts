import { z } from "zod";

import {
  confidenceSchema,
  decimalInputSchema,
  issuerOfferTypeSchema,
  merchantCategorySchema,
  optionalDateSchema,
} from "./adminShared.js";

export const adminOfferListQuerySchema = z.object({
  issuerId: z.string().min(1).optional(),
  cardId: z.string().min(1).optional(),
  merchantId: z.string().min(1).optional(),
  category: merchantCategorySchema.optional(),
  offerType: issuerOfferTypeSchema.optional(),
  confidence: confidenceSchema.optional(),
  activeAt: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

const offerBaseSchema = z.object({
  issuerId: z.string().min(1).nullable().optional(),
  cardId: z.string().min(1).nullable().optional(),
  merchantId: z.string().min(1).nullable().optional(),
  category: merchantCategorySchema.nullable().optional(),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  offerType: issuerOfferTypeSchema,
  valueCents: z.number().int().nonnegative().nullable().optional(),
  bonusPoints: z.number().int().positive().nullable().optional(),
  bonusCurrencyId: z.string().min(1).nullable().optional(),
  bonusMultiplier: decimalInputSchema.nullable().optional(),
  minSpendCents: z.number().int().nonnegative().nullable().optional(),
  maxRewardCents: z.number().int().nonnegative().nullable().optional(),
  activationRequired: z.boolean().optional(),
  startsAt: optionalDateSchema,
  endsAt: optionalDateSchema,
  confidence: confidenceSchema,
  sourceId: z.string().min(1).nullable().optional(),
  termsUrl: z.string().trim().url().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

export const adminOfferCreateSchema = offerBaseSchema.strict();

export const adminOfferUpdateSchema = offerBaseSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one update field is required.",
  });

export const adminOfferExpireSchema = z
  .object({
    endsAt: z.string().datetime().optional(),
    notes: z.string().trim().min(1).optional(),
  })
  .strict()
  .default({});
