import { z } from "zod";

const queryBoolean = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .transform((value) =>
    typeof value === "boolean" ? value : value === "true",
  );

export const listCardsQuerySchema = z.object({
  q: z.string().trim().optional(),
  issuerId: z.string().trim().optional(),
  activeOnly: queryBoolean.default(true),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const cardParamsSchema = z.object({
  id: z.string().min(1),
});
