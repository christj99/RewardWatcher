import { z } from "zod";

import { listQuerySchema, nullableUrlSchema } from "./adminShared.js";

export const adminIssuerListQuerySchema = listQuerySchema;

export const adminIssuerCreateSchema = z
  .object({
    name: z.string().trim().min(1),
    slug: z.string().trim().min(1).optional(),
    websiteUrl: nullableUrlSchema,
  })
  .strict();

export const adminIssuerUpdateSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    slug: z.string().trim().min(1).optional(),
    websiteUrl: nullableUrlSchema,
  })
  .strict()
  .refine(
    (value) =>
      value.name !== undefined ||
      value.slug !== undefined ||
      value.websiteUrl !== undefined,
    { message: "At least one update field is required." },
  );
