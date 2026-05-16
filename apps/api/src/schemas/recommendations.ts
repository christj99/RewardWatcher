import { z } from "zod";

export const createRecommendationSchema = z
  .object({
    merchantId: z.string().min(1).optional(),
    merchantUrl: z.string().trim().min(1).optional(),
    merchantName: z.string().trim().min(1).optional(),
    purchaseAmountCents: z.number().int().positive().optional(),
    lens: z
      .enum(["CASH_OUT", "PRACTICAL", "ASPIRATIONAL"])
      .default("PRACTICAL"),
    context: z
      .enum([
        "ONLINE_CHECKOUT",
        "MANUAL_LOOKUP",
        "IMPORTED_TRANSACTION_REPLAY",
        "OTHER",
      ])
      .default("MANUAL_LOOKUP"),
  })
  .strict()
  .refine(
    (value) => value.merchantId || value.merchantUrl || value.merchantName,
    "At least one of merchantId, merchantUrl, or merchantName is required.",
  );

export const recommendationHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(25),
  merchantId: z.string().min(1).optional(),
});

export const recommendationParamsSchema = z.object({
  id: z.string().min(1),
});
