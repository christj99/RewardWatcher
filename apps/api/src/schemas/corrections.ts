import { z } from "zod";

export const correctionTypeSchema = z.enum([
  "WRONG_MERCHANT",
  "WRONG_CATEGORY",
  "WRONG_CARD_RULE",
  "MISSED_OFFER",
  "CAP_NOT_HANDLED",
  "PERSONAL_PREFERENCE",
  "OTHER",
]);

export const correctionStatusSchema = z.enum([
  "OPEN",
  "IN_REVIEW",
  "RESOLVED",
  "REJECTED",
]);

export const merchantCategorySchema = z.enum([
  "DINING",
  "GROCERY",
  "TRAVEL",
  "AIRFARE",
  "HOTEL",
  "RIDESHARE",
  "GAS",
  "DRUGSTORE",
  "STREAMING",
  "ONLINE_RETAIL",
  "WHOLESALE_CLUB",
  "GENERAL",
  "OTHER",
  "UNKNOWN",
]);

export const createCorrectionSchema = z
  .object({
    correctionType: correctionTypeSchema,
    userNote: z.string().trim().min(1).optional(),
    suggestedMerchantId: z.string().min(1).optional(),
    suggestedCategory: merchantCategorySchema.optional(),
    suggestedCardId: z.string().min(1).optional(),
    preferenceAction: z
      .enum(["PREFER_CARD", "AVOID_CARD", "CUSTOM_NOTE"])
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.preferenceAction &&
      value.correctionType !== "PERSONAL_PREFERENCE"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["preferenceAction"],
        message:
          "preferenceAction is only allowed for PERSONAL_PREFERENCE corrections.",
      });
    }

    if (
      value.correctionType === "PERSONAL_PREFERENCE" &&
      (value.preferenceAction === "PREFER_CARD" ||
        value.preferenceAction === "AVOID_CARD") &&
      !value.suggestedCardId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["suggestedCardId"],
        message:
          "suggestedCardId is required when preferring or avoiding a card.",
      });
    }
  });

export const correctionListQuerySchema = z.object({
  status: correctionStatusSchema.optional(),
  correctionType: correctionTypeSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).default(25),
});

export const correctionParamsSchema = z.object({
  id: z.string().min(1),
});

export type CreateCorrectionInput = z.infer<typeof createCorrectionSchema>;
