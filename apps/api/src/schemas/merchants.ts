import { z } from "zod";

export const merchantSearchQuerySchema = z.object({
  q: z.string().trim().min(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export const merchantByUrlQuerySchema = z.object({
  url: z.string().trim().min(1),
});
