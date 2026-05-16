import { z } from "zod";

const maxRangeMs = 31 * 24 * 60 * 60 * 1000;
const queryBoolean = z.preprocess((value) => {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return value;
}, z.boolean());

export const weeklyAuditQuerySchema = z
  .object({
    weekStart: z.string().datetime().optional(),
    weekEnd: z.string().datetime().optional(),
    minMissedValueCents: z.coerce.number().int().min(0).default(100),
    includeInconclusive: queryBoolean.default(false),
    includeUnmatched: queryBoolean.default(true),
    limitItems: z.coerce.number().int().positive().max(100).default(50),
  })
  .superRefine((value, ctx) => {
    if (
      (value.weekStart && !value.weekEnd) ||
      (!value.weekStart && value.weekEnd)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "weekStart and weekEnd must be provided together.",
      });
      return;
    }

    if (!value.weekStart || !value.weekEnd) {
      return;
    }

    const weekStart = new Date(value.weekStart);
    const weekEnd = new Date(value.weekEnd);
    if (weekStart >= weekEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "weekStart must be before weekEnd.",
      });
    }

    if (weekEnd.getTime() - weekStart.getTime() > maxRangeMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Weekly audit ranges may not exceed 31 days.",
      });
    }
  });
