import { z } from "zod";

import {
  cardNetworkSchema,
  listQuerySchema,
  optionalDateSchema,
} from "./adminShared.js";

export const adminCardListQuerySchema = listQuerySchema.extend({
  issuerId: z.string().min(1).optional(),
  isActive: z.coerce.boolean().optional(),
});

export const adminCardCreateSchema = z
  .object({
    issuerId: z.string().min(1),
    name: z.string().trim().min(1),
    slug: z.string().trim().min(1).optional(),
    network: cardNetworkSchema.nullable().optional(),
    annualFeeCents: z.number().int().min(0).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const adminCardUpdateSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    slug: z.string().trim().min(1).optional(),
    network: cardNetworkSchema.nullable().optional(),
    annualFeeCents: z.number().int().min(0).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one update field is required.",
  });

const cardVersionBaseSchema = z.object({
  versionName: z.string().trim().min(1),
  effectiveFrom: z.string().datetime(),
  effectiveTo: optionalDateSchema,
  annualFeeCents: z.number().int().min(0).nullable().optional(),
  notes: z.string().trim().min(1).nullable().optional(),
});

export const adminCardVersionCreateSchema = cardVersionBaseSchema
  .strict()
  .refine(
    (value) =>
      !value.effectiveTo ||
      new Date(value.effectiveTo) > new Date(value.effectiveFrom),
    { message: "effectiveTo must be after effectiveFrom." },
  );

export const adminCardVersionUpdateSchema = cardVersionBaseSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one update field is required.",
  });
