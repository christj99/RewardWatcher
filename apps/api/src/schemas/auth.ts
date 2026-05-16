import { AuthEventType } from "@prisma/client";
import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10).max(200),
  displayName: z.string().trim().min(1).max(120).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(20),
  newPassword: z.string().min(10).max(200),
});

export const extensionSessionSchema = z.object({
  token: z.string().min(20),
});

export const adminAuthEventsQuerySchema = z.object({
  userId: z.string().optional(),
  email: z.string().email().optional(),
  eventType: z.nativeEnum(AuthEventType).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
});
