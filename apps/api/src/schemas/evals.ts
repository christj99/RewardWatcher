import { z } from "zod";

const maxRangeMs = 120 * 24 * 60 * 60 * 1000;

export const killTestQuerySchema = z
  .object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    meaningfulMissThresholdCents: z.coerce.number().int().min(0).default(500),
    annualSubscriptionPriceCents: z.coerce.number().int().min(0).default(6900),
    primaryKillTestUserShare: z.coerce.number().min(0).max(1).default(0.5),
    maxRecommendationErrorRate: z.coerce.number().min(0).max(1).default(0.1),
    maxInconclusiveRate: z.coerce.number().min(0).max(1).default(0.25),
  })
  .superRefine((value, ctx) => {
    if (
      (value.startDate && !value.endDate) ||
      (!value.startDate && value.endDate)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "startDate and endDate must be provided together.",
      });
      return;
    }

    if (!value.startDate || !value.endDate) {
      return;
    }

    const startDate = new Date(value.startDate);
    const endDate = new Date(value.endDate);

    if (startDate >= endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "startDate must be before endDate.",
      });
    }

    if (endDate.getTime() - startDate.getTime() > maxRangeMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Kill-test evaluation ranges may not exceed 120 days.",
      });
    }
  });

export type KillTestQuery = z.infer<typeof killTestQuerySchema>;
