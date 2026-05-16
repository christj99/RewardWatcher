import { z } from "zod";

export const outcomeTypeSchema = z.enum([
  "CAPTURED_OPTIMAL",
  "USER_MISSED_VALUE",
  "RECOMMENDATION_ERROR",
  "UNMATCHED",
  "USER_OVERRIDE",
  "INCONCLUSIVE",
]);

export const outcomeListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(25),
  outcomeType: outcomeTypeSchema.optional(),
  transactionId: z.string().min(1).optional(),
});

export const outcomeParamsSchema = z.object({
  id: z.string().min(1),
});
