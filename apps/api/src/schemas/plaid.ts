import { z } from "zod";

export const exchangePublicTokenSchema = z
  .object({
    publicToken: z.string().trim().min(1),
    metadata: z
      .object({
        institution: z
          .object({
            institution_id: z.string().nullable().optional(),
            name: z.string().nullable().optional(),
          })
          .nullable()
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .strict();

export const linkPlaidAccountSchema = z
  .object({
    userCardId: z.string().trim().min(1),
  })
  .strict();

export const plaidSyncSchema = z
  .object({
    audit: z.boolean().default(true),
  })
  .strict()
  .default({ audit: true });

export const plaidConnectionParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export const plaidAccountParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export const disconnectPlaidSchema = z
  .object({
    deleteTransactions: z.boolean().default(false),
  })
  .strict()
  .default({ deleteTransactions: false });
