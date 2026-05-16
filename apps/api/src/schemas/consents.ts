import { z } from "zod";

export const consentTypeSchema = z.enum([
  "PLAID_TRANSACTIONS",
  "EMAIL_REMINDERS",
  "TERMS_OF_SERVICE",
  "PRIVACY_POLICY",
  "WEEKLY_AUDIT",
  "OFFER_TRACKING",
]);

export const consentCreateSchema = z
  .object({
    consentType: consentTypeSchema,
    version: z.string().trim().min(1).max(100),
    metadata: z.record(z.unknown()).optional(),
  })
  .strict();

export const consentParamsSchema = z.object({
  id: z.string().min(1),
});
