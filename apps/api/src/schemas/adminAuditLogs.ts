import { z } from "zod";

import { adminAuditActionSchema } from "./adminShared.js";

export const adminAuditLogListQuerySchema = z.object({
  adminUserId: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  action: adminAuditActionSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});
