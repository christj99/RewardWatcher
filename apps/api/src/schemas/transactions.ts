import { z } from "zod";

import { merchantCategorySchema } from "./corrections.js";

export const transactionSourceSchema = z.enum([
  "MANUAL",
  "CSV_IMPORT",
  "TEST_FIXTURE",
]);

const rawDataSchema = z
  .record(z.unknown())
  .optional()
  .refine(
    (value) => !value || JSON.stringify(value).length <= 10_000,
    "rawData is too large.",
  );

export const importTransactionsSchema = z
  .object({
    source: transactionSourceSchema.default("MANUAL"),
    audit: z.boolean().default(false),
    transactions: z
      .array(
        z
          .object({
            externalId: z.string().trim().min(1).optional(),
            rawMerchantName: z.string().trim().min(1),
            amountCents: z.number().int().positive(),
            transactionDate: z.string().datetime(),
            postedDate: z.string().datetime().optional(),
            userCardId: z.string().min(1).optional(),
            observedCategory: merchantCategorySchema.optional(),
            observedMcc: z.string().trim().min(1).optional(),
            rawData: rawDataSchema,
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();

export const transactionListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(25),
  source: z.enum(["MANUAL", "CSV_IMPORT", "PLAID", "TEST_FIXTURE"]).optional(),
  merchantId: z.string().min(1).optional(),
  userCardId: z.string().min(1).optional(),
});

export const transactionParamsSchema = z.object({
  id: z.string().min(1),
});

export type ImportTransactionsInput = z.infer<typeof importTransactionsSchema>;
