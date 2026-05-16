import { z } from "zod";

export const updateMeSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
  })
  .strict();
