import { EmailStatus, EmailType } from "@prisma/client";
import { z } from "zod";

export const adminEmailLogListQuerySchema = z.object({
  userId: z.string().optional(),
  emailType: z.nativeEnum(EmailType).optional(),
  status: z.nativeEnum(EmailStatus).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});
