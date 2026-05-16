import { z } from "zod";

const queryBoolean = z.preprocess((value) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean());

export const reminderTypeSchema = z.enum([
  "ANNUAL_FEE",
  "WELCOME_BONUS_DEADLINE",
  "STATEMENT_CREDIT",
  "CUSTOM",
]);

export const reminderStatusSchema = z.enum([
  "SCHEDULED",
  "DUE",
  "COMPLETED",
  "DISMISSED",
]);

export const reminderRecurrenceSchema = z.enum([
  "NONE",
  "MONTHLY",
  "QUARTERLY",
  "SEMIANNUAL",
  "ANNUAL",
]);

export const reminderSourceSchema = z.enum([
  "MANUAL",
  "GENERATED",
  "STATEMENT_CREDIT",
  "WELCOME_BONUS",
  "ANNUAL_FEE",
]);

export const listRemindersQuerySchema = z.object({
  status: reminderStatusSchema.optional(),
  reminderType: reminderTypeSchema.optional(),
  dueBefore: z.string().datetime().optional(),
  dueAfter: z.string().datetime().optional(),
  includeDismissed: queryBoolean.default(false),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const createReminderSchema = z
  .object({
    userCardId: z.string().min(1).optional(),
    statementCreditId: z.string().min(1).optional(),
    reminderType: reminderTypeSchema,
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(1000).nullable().optional(),
    dueAt: z.string().datetime(),
    recurrence: reminderRecurrenceSchema.default("NONE"),
    source: reminderSourceSchema.default("MANUAL"),
  })
  .strict();

export const updateReminderSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    dueAt: z.string().datetime().optional(),
    status: reminderStatusSchema.optional(),
    recurrence: reminderRecurrenceSchema.nullable().optional(),
  })
  .strict();

export const generateDefaultRemindersSchema = z
  .object({
    overwriteExisting: z.boolean().default(false),
  })
  .strict()
  .default({});

export const reminderParamsSchema = z.object({
  id: z.string().min(1),
});
