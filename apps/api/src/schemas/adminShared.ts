import { z } from "zod";

export const idParamSchema = z.object({
  id: z.string().min(1),
});

export const cardIdParamSchema = z.object({
  cardId: z.string().min(1),
});

export const currencyIdParamSchema = z.object({
  currencyId: z.string().min(1),
});

export const merchantIdParamSchema = z.object({
  merchantId: z.string().min(1),
});

export const listQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

export const listQueryMax200Schema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(100),
});

export const nullableUrlSchema = z.string().trim().url().nullable().optional();

export const optionalDateSchema = z.string().datetime().nullable().optional();

export const decimalInputSchema = z.union([
  z.number().positive(),
  z.string().trim().min(1),
]);

export const sourceTypeSchema = z.enum([
  "ISSUER_PAGE",
  "TERMS_DOC",
  "CURATOR_RESEARCH",
  "USER_CORRECTION",
  "TRANSACTION_OUTCOME",
  "COMMUNITY_REPORT",
  "OTHER",
]);

export const currencyTypeSchema = z.enum([
  "CASHBACK",
  "TRANSFERABLE_POINTS",
  "AIRLINE_MILES",
  "HOTEL_POINTS",
  "OTHER",
]);

export const lensSchema = z.enum(["CASH_OUT", "PRACTICAL", "ASPIRATIONAL"]);

export const confidenceSchema = z.enum(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]);

export const issuerOfferTypeSchema = z.enum([
  "STATEMENT_CREDIT",
  "BONUS_POINTS",
  "BONUS_MULTIPLIER",
  "DISCOUNT",
  "OTHER",
]);

export const userOfferStatusSchema = z.enum([
  "AVAILABLE",
  "ACTIVATED",
  "USED",
  "EXPIRED",
  "DISMISSED",
]);

export const adminAuditActionSchema = z.enum([
  "CREATE",
  "UPDATE",
  "DELETE",
  "RETIRE",
  "EXPIRE",
  "RESOLVE",
  "REJECT",
  "LINK",
  "UNLINK",
  "OTHER",
]);

export const cardNetworkSchema = z.enum([
  "VISA",
  "MASTERCARD",
  "AMEX",
  "DISCOVER",
  "OTHER",
]);

export const merchantCategorySchema = z.enum([
  "DINING",
  "GROCERY",
  "TRAVEL",
  "AIRFARE",
  "HOTEL",
  "RIDESHARE",
  "GAS",
  "DRUGSTORE",
  "STREAMING",
  "ONLINE_RETAIL",
  "WHOLESALE_CLUB",
  "GENERAL",
  "OTHER",
  "UNKNOWN",
]);

export const capPeriodSchema = z.enum([
  "MONTHLY",
  "QUARTERLY",
  "ANNUAL",
  "LIFETIME",
]);

export const benefitTypeSchema = z.enum([
  "TRAVEL_CREDIT",
  "PURCHASE_PROTECTION",
  "EXTENDED_WARRANTY",
  "LOUNGE_ACCESS",
  "TRIP_INSURANCE",
  "STATEMENT_CREDIT",
  "OTHER",
]);

export const recurrenceSchema = z.enum([
  "MONTHLY",
  "QUARTERLY",
  "SEMIANNUAL",
  "ANNUAL",
  "ONE_TIME",
]);

export const urlPatternTypeSchema = z.enum(["DOMAIN", "URL_CONTAINS", "REGEX"]);

export const postingDataSourceSchema = z.enum([
  "CURATOR_RESEARCH",
  "USER_CORRECTION",
  "TRANSACTION_OUTCOME",
  "IMPORTED_DATA",
  "OTHER",
]);
