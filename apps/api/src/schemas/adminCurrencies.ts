import { z } from "zod";

import {
  confidenceSchema,
  currencyTypeSchema,
  decimalInputSchema,
  lensSchema,
  optionalDateSchema,
} from "./adminShared.js";

export const adminCurrencyListQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const adminCurrencyCreateSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2)
      .transform((value) => value.toUpperCase()),
    name: z.string().trim().min(1),
    currencyType: currencyTypeSchema,
  })
  .strict();

export const adminCurrencyUpdateSchema = adminCurrencyCreateSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one update field is required.",
  });

const valuationBaseSchema = z.object({
  lens: lensSchema,
  centsPerPoint: decimalInputSchema,
  confidence: confidenceSchema,
  sourceId: z.string().min(1).nullable().optional(),
  effectiveFrom: z.string().datetime(),
  effectiveTo: optionalDateSchema,
  notes: z.string().trim().min(1).nullable().optional(),
});

export const adminCurrencyValuationCreateSchema = valuationBaseSchema
  .strict()
  .refine(
    (value) =>
      !value.effectiveTo ||
      new Date(value.effectiveTo) > new Date(value.effectiveFrom),
    { message: "effectiveTo must be after effectiveFrom." },
  );

export const adminCurrencyValuationUpdateSchema = valuationBaseSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one update field is required.",
  });
