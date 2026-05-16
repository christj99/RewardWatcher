import { z } from "zod";

const nullableDateString = z.string().datetime().nullable().optional();

export const createWalletCardSchema = z
  .object({
    cardId: z.string().min(1),
    nickname: z.string().trim().min(1).max(120).optional(),
    openedAt: z.string().datetime().optional(),
    annualFeeDueMonth: z.number().int().min(1).max(12).optional(),
    welcomeBonusDeadline: z.string().datetime().optional(),
  })
  .strict();

export const updateWalletCardSchema = z
  .object({
    nickname: z.string().trim().min(1).max(120).nullable().optional(),
    openedAt: nullableDateString,
    annualFeeDueMonth: z.number().int().min(1).max(12).nullable().optional(),
    welcomeBonusDeadline: nullableDateString,
    isActive: z.boolean().optional(),
  })
  .strict();

export const walletParamsSchema = z.object({
  userCardId: z.string().min(1),
});
