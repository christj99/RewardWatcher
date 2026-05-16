import { z } from "zod";

import {
  cardNetworkSchema,
  confidenceSchema,
  listQuerySchema,
  merchantCategorySchema,
  nullableUrlSchema,
  optionalDateSchema,
  postingDataSourceSchema,
  urlPatternTypeSchema,
} from "./adminShared.js";

export const adminMerchantListQuerySchema = listQuerySchema.extend({
  category: merchantCategorySchema.optional(),
});

export const adminMerchantCreateSchema = z
  .object({
    name: z.string().trim().min(1),
    slug: z.string().trim().min(1).optional(),
    category: merchantCategorySchema,
    websiteUrl: nullableUrlSchema,
  })
  .strict();

export const adminMerchantUpdateSchema = adminMerchantCreateSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one update field is required.",
  });

const merchantUrlPatternBaseSchema = z.object({
  pattern: z.string().trim().min(1),
  patternType: urlPatternTypeSchema,
  confidence: confidenceSchema,
  sourceId: z.string().min(1).nullable().optional(),
});

export const adminMerchantUrlPatternCreateSchema = merchantUrlPatternBaseSchema
  .strict()
  .superRefine(validateUrlPattern);

export const adminMerchantUrlPatternUpdateSchema = merchantUrlPatternBaseSchema
  .partial()
  .strict()
  .superRefine(validateUrlPattern)
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one update field is required.",
  });

export const adminPostingProfileListQuerySchema = z.object({
  merchantId: z.string().min(1).optional(),
  issuerId: z.string().min(1).optional(),
  network: cardNetworkSchema.optional(),
  observedCategory: merchantCategorySchema.optional(),
  confidence: confidenceSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

const postingProfileBaseSchema = z.object({
  merchantId: z.string().min(1),
  issuerId: z.string().min(1).nullable().optional(),
  network: cardNetworkSchema.nullable().optional(),
  observedCategory: merchantCategorySchema,
  observedMcc: z.string().trim().min(1).nullable().optional(),
  dataSource: postingDataSourceSchema,
  confidence: confidenceSchema,
  observationCount: z.number().int().min(0).optional(),
  lastObservedAt: optionalDateSchema,
  sourceId: z.string().min(1).nullable().optional(),
  notes: z.string().trim().min(1).nullable().optional(),
});

export const adminPostingProfileCreateSchema =
  postingProfileBaseSchema.strict();

export const adminPostingProfileUpdateSchema = postingProfileBaseSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one update field is required.",
  });

function validateUrlPattern(
  value: {
    pattern?: string | undefined;
    patternType?: "DOMAIN" | "URL_CONTAINS" | "REGEX" | undefined;
  },
  ctx: z.RefinementCtx,
) {
  if (!value.pattern || !value.patternType) {
    return;
  }

  if (
    value.patternType === "DOMAIN" &&
    /^[a-z][a-z\d+\-.]*:\/\//i.test(value.pattern)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "DOMAIN patterns must not include a protocol.",
      path: ["pattern"],
    });
  }

  if (value.patternType === "REGEX") {
    try {
      new RegExp(value.pattern);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "REGEX pattern must compile.",
        path: ["pattern"],
      });
    }
  }
}
