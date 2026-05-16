import { z } from "zod";

export const statementCreditUsageStatusSchema = z.enum([
  "UNUSED",
  "PARTIALLY_USED",
  "USED",
  "UNKNOWN",
]);

export const listStatementCreditUsageQuerySchema = z.object({
  userCardId: z.string().min(1).optional(),
  statementCreditId: z.string().min(1).optional(),
  status: statementCreditUsageStatusSchema.optional(),
  periodStart: z.string().datetime().optional(),
  periodEnd: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const updateStatementCreditUsageSchema = z
  .object({
    status: statementCreditUsageStatusSchema.optional(),
    amountUsedCents: z.number().int().min(0).nullable().optional(),
    estimatedRemainingCents: z.number().int().min(0).nullable().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();

export const generateStatementCreditUsageSchema = z
  .object({
    userCardId: z.string().min(1).optional(),
    periodStart: z.string().datetime().optional(),
    periodEnd: z.string().datetime().optional(),
    inferFromTransactions: z.boolean().default(true),
  })
  .strict()
  .default({});

export const statementCreditUsageParamsSchema = z.object({
  id: z.string().min(1),
});
