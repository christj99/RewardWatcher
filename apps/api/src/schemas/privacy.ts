import { z } from "zod";

export const deletePlaidDataSchema = z
  .object({
    confirmation: z.literal("DELETE_PLAID_DATA"),
  })
  .strict();

export const deleteTransactionsSchema = z
  .object({
    confirmation: z.literal("DELETE_TRANSACTIONS"),
    source: z
      .enum(["PLAID", "MANUAL", "CSV_IMPORT", "TEST_FIXTURE", "ALL"])
      .default("ALL"),
  })
  .strict();

export const deleteAccountSchema = z
  .object({
    confirmation: z.literal("DELETE_MY_ACCOUNT"),
  })
  .strict();
