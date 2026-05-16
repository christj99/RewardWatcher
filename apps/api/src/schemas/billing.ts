import {
  EntitlementKey,
  EntitlementSource,
  SubscriptionStatus,
} from "@prisma/client";
import { z } from "zod";

export const checkoutSessionSchema = z.object({
  interval: z.enum(["ANNUAL", "MONTHLY"]),
});

export const adminBillingUsersQuerySchema = z.object({
  q: z.string().optional(),
  subscriptionStatus: z.nativeEnum(SubscriptionStatus).optional(),
  entitlementKey: z.nativeEnum(EntitlementKey).optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});

export const grantEntitlementSchema = z.object({
  userId: z.string().min(1),
  key: z.nativeEnum(EntitlementKey),
  source: z.enum([
    EntitlementSource.MANUAL_GRANT,
    EntitlementSource.FOUNDING_BETA,
  ]),
  expiresAt: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const entitlementGrantParamsSchema = z.object({
  id: z.string().min(1),
});

export const updateEntitlementGrantSchema = z.object({
  active: z.boolean().optional(),
  expiresAt: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
});
