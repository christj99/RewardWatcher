import { z } from "zod";

import {
  capPeriodSchema,
  confidenceSchema,
  decimalInputSchema,
  merchantCategorySchema,
  optionalDateSchema,
} from "./adminShared.js";

export const adminEarningRuleListQuerySchema = z.object({
  cardId: z.string().min(1).optional(),
  merchantId: z.string().min(1).optional(),
  category: merchantCategorySchema.optional(),
  confidence: confidenceSchema.optional(),
  activeAt: z.string().datetime().optional(),
  sourceId: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

const earningRuleBaseSchema = z.object({
  cardId: z.string().min(1),
  cardVersionId: z.string().min(1).nullable().optional(),
  rewardCurrencyId: z.string().min(1),
  category: merchantCategorySchema.nullable().optional(),
  merchantId: z.string().min(1).nullable().optional(),
  multiplier: decimalInputSchema,
  baseRateMultiplier: decimalInputSchema.nullable().optional(),
  capAmountCents: z.number().int().min(0).nullable().optional(),
  capPeriod: capPeriodSchema.nullable().optional(),
  activationRequired: z.boolean().optional(),
  startsAt: optionalDateSchema,
  endsAt: optionalDateSchema,
  confidence: confidenceSchema,
  sourceId: z.string().min(1).nullable().optional(),
  notes: z.string().trim().min(1).nullable().optional(),
  isBaseRule: z.boolean().optional(),
});

export const adminEarningRuleCreateSchema = earningRuleBaseSchema
  .strict()
  .superRefine(validateEarningRuleShape);

export const adminEarningRuleUpdateSchema = earningRuleBaseSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one update field is required.",
  });

export const adminEarningRuleRetireSchema = z
  .object({
    endsAt: z.string().datetime().optional(),
    notes: z.string().trim().min(1).optional(),
  })
  .strict();

function validateEarningRuleShape(
  value: z.infer<typeof earningRuleBaseSchema>,
  ctx: z.RefinementCtx,
) {
  if ((value.capAmountCents ?? null) !== null && !value.capPeriod) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "capPeriod is required when capAmountCents is provided.",
      path: ["capPeriod"],
    });
  }

  if (value.capPeriod && (value.capAmountCents ?? null) === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "capAmountCents is required when capPeriod is provided.",
      path: ["capAmountCents"],
    });
  }

  if (
    value.startsAt &&
    value.endsAt &&
    new Date(value.endsAt) <= new Date(value.startsAt)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "endsAt must be after startsAt.",
      path: ["endsAt"],
    });
  }

  const hasScope = Boolean(value.category || value.merchantId);
  const isExplicitBase =
    value.isBaseRule === true || value.notes?.toLowerCase().includes("base");
  if (!hasScope && !isExplicitBase) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "Base/everywhere rules require isBaseRule=true or notes mentioning base.",
      path: ["isBaseRule"],
    });
  }

  if (!value.sourceId && !value.notes) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "notes must explain the source gap when sourceId is omitted.",
      path: ["notes"],
    });
  }
}
