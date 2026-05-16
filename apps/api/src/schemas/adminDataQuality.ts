import { z } from "zod";

export const ruleFreshnessQuerySchema = z.object({
  staleDays: z.coerce.number().int().positive().max(3650).default(180),
  limit: z.coerce.number().int().positive().max(200).default(100),
});

export const recommendationErrorsQuerySchema = z
  .object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    limit: z.coerce.number().int().positive().max(200).default(100),
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

    if (
      value.startDate &&
      value.endDate &&
      new Date(value.startDate) >= new Date(value.endDate)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "startDate must be before endDate.",
      });
    }
  });
