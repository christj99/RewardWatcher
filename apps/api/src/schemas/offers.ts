import { z } from "zod";

import {
  merchantCategorySchema,
  userOfferStatusSchema,
} from "./adminShared.js";

export const offerListQuerySchema = z.object({
  status: userOfferStatusSchema.optional(),
  cardId: z.string().min(1).optional(),
  merchantId: z.string().min(1).optional(),
  category: merchantCategorySchema.optional(),
  activeOnly: z.coerce.boolean().default(true),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const offerActivationSchema = z
  .object({
    userCardId: z.string().min(1).nullable().optional(),
    status: userOfferStatusSchema,
    notes: z.string().trim().nullable().optional(),
  })
  .strict();
