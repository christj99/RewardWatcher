import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { z } from "zod";

function loadLocalEnvFile(): void {
  const candidatePaths = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "..", ".env"),
    resolve(process.cwd(), "..", "..", ".env"),
  ];
  const envPath = candidatePaths.find((candidate) => existsSync(candidate));

  if (!envPath) {
    return;
  }

  const envFile = readFileSync(envPath, "utf8");

  for (const line of envFile.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();

    if (process.env[key] !== undefined) {
      continue;
    }

    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const quote = rawValue[0];
    const value =
      (quote === '"' || quote === "'") && rawValue.endsWith(quote)
        ? rawValue.slice(1, -1)
        : rawValue;

    process.env[key] = value;
  }
}

loadLocalEnvFile();

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }
  return value;
}, z.boolean());

const envSchemaBase = z.object({
  APP_ENV: z
    .enum(["development", "test", "production"])
    .default(
      (process.env.NODE_ENV as "development" | "test" | "production") ??
        "development",
    ),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  API_PUBLIC_URL: z.string().url().optional(),
  WEB_PUBLIC_URL: z.string().url().optional(),
  ADMIN_PUBLIC_URL: z.string().url().optional(),
  EXTENSION_PUBLIC_ID: z.string().optional(),
  COOKIE_DOMAIN: z.string().optional(),
  RELEASE_VERSION: z.string().optional(),
  COMMIT_SHA: z.string().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  HOST: z.string().min(1).default("0.0.0.0"),
  CORS_ORIGIN: z
    .string()
    .min(1)
    .default(
      "http://localhost:3000,http://localhost:5173,http://localhost:5174",
    ),
  DATABASE_URL: z.string().url(),
  DEV_USER_EMAIL: z.string().email().default("beta@example.com"),
  ALLOW_DEV_AUTH_HEADER: booleanFromEnv.default(true),
  SESSION_COOKIE_NAME: z.string().min(1).default("rewards_audit_session"),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  SESSION_COOKIE_SECURE: booleanFromEnv.default(false),
  ALLOW_INSECURE_PRODUCTION_COOKIES: booleanFromEnv.default(false),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  EXTENSION_PAIRING_TOKEN_TTL_MINUTES: z.coerce
    .number()
    .int()
    .positive()
    .default(10),
  EMAIL_PROVIDER: z.enum(["console", "postmark"]).default("console"),
  EMAIL_FROM: z.string().min(1).default("Rewards Audit <no-reply@example.com>"),
  EMAIL_REPLY_TO: z.string().optional(),
  POSTMARK_SERVER_TOKEN: z.string().optional(),
  APP_WEB_URL: z.string().url().default("http://localhost:5173"),
  ADMIN_WEB_URL: z.string().url().default("http://localhost:5174"),
  ADMIN_ALERT_EMAILS: z.string().optional(),
  ADMIN_RECOMMENDATION_ERROR_ALERT_THRESHOLD: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(5),
  SCHEDULER_ENABLED: booleanFromEnv.default(false),
  SCHEDULER_INSTANCE_ID: z.string().optional(),
  SCHEDULER_TIMEZONE: z.string().min(1).default("UTC"),
  SCHEDULE_WEEKLY_AUDIT_EMAIL_CRON: z.string().default("0 9 * * 1"),
  SCHEDULE_REMINDER_DIGEST_CRON: z.string().default("0 9 * * *"),
  SCHEDULE_ADMIN_ALERT_CRON: z.string().default("0 8 * * *"),
  SCHEDULE_PLAID_SYNC_ALL_CRON: z.string().optional(),
  SCHEDULE_STATEMENT_CREDIT_USAGE_CRON: z.string().default("0 4 * * *"),
  SCHEDULE_EVAL_KILL_TEST_CRON: z.string().optional(),
  PLAID_CLIENT_ID: z.string().optional(),
  PLAID_SECRET: z.string().optional(),
  PLAID_ENABLED: booleanFromEnv.default(false),
  PLAID_ENV: z
    .enum(["sandbox", "development", "production"])
    .default("sandbox"),
  PLAID_PRODUCTS: z.string().default("transactions"),
  PLAID_COUNTRY_CODES: z.string().default("US"),
  PLAID_REDIRECT_URI: z.string().optional(),
  PLAID_WEBHOOK_URL: z.string().optional(),
  SECRET_ENCRYPTION_KEY: z.string().optional(),
  SENTRY_DSN: z.string().url().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_ENABLED: booleanFromEnv.default(false),
  STRIPE_PRICE_ID_ANNUAL: z.string().optional(),
  STRIPE_PRICE_ID_MONTHLY: z.string().optional(),
  STRIPE_BILLING_PORTAL_RETURN_URL: z
    .string()
    .default("http://localhost:5173/settings/billing"),
  STRIPE_CHECKOUT_SUCCESS_URL: z
    .string()
    .default("http://localhost:5173/settings/billing?checkout=success"),
  STRIPE_CHECKOUT_CANCEL_URL: z
    .string()
    .default("http://localhost:5173/settings/billing?checkout=cancel"),
  RATE_LIMIT_ENABLED: booleanFromEnv.default(true),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_PLAID_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_BILLING_MAX: z.coerce.number().int().positive().default(20),
});

export const envSchema = envSchemaBase.superRefine((value, ctx) => {
  const isProduction =
    value.APP_ENV === "production" || value.NODE_ENV === "production";
  if (!isProduction) {
    return;
  }

  requireProductionValue(ctx, value.API_PUBLIC_URL, "API_PUBLIC_URL");
  requireProductionValue(ctx, value.WEB_PUBLIC_URL, "WEB_PUBLIC_URL");
  requireProductionValue(ctx, value.ADMIN_PUBLIC_URL, "ADMIN_PUBLIC_URL");

  if (!value.SECRET_ENCRYPTION_KEY || value.SECRET_ENCRYPTION_KEY.length < 32) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["SECRET_ENCRYPTION_KEY"],
      message:
        "SECRET_ENCRYPTION_KEY is required in production and must be at least 32 characters.",
    });
  }

  if (
    !value.SESSION_COOKIE_SECURE &&
    !value.ALLOW_INSECURE_PRODUCTION_COOKIES
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["SESSION_COOKIE_SECURE"],
      message: "SESSION_COOKIE_SECURE must be true in production.",
    });
  }

  if (value.CORS_ORIGIN.split(",").some((origin) => origin.trim() === "*")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["CORS_ORIGIN"],
      message: "CORS_ORIGIN must not contain '*' in production.",
    });
  }

  if (value.ALLOW_DEV_AUTH_HEADER) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ALLOW_DEV_AUTH_HEADER"],
      message: "ALLOW_DEV_AUTH_HEADER must be false in production.",
    });
  }

  if (value.EMAIL_PROVIDER === "postmark" && !value.POSTMARK_SERVER_TOKEN) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["POSTMARK_SERVER_TOKEN"],
      message:
        "POSTMARK_SERVER_TOKEN is required when EMAIL_PROVIDER=postmark.",
    });
  }

  if (value.STRIPE_ENABLED) {
    for (const key of [
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "STRIPE_PRICE_ID_ANNUAL",
    ] as const) {
      requireProductionValue(ctx, value[key], key);
    }
  }

  if (value.PLAID_ENABLED) {
    for (const key of ["PLAID_CLIENT_ID", "PLAID_SECRET"] as const) {
      requireProductionValue(ctx, value[key], key);
    }
  }
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(input: NodeJS.ProcessEnv): Env {
  return envSchema.parse(input);
}

export function getSafeConfigSummary(input: Env): Record<string, unknown> {
  return {
    appEnv: input.APP_ENV,
    nodeEnv: input.NODE_ENV,
    apiPublicUrl: input.API_PUBLIC_URL ?? null,
    webPublicUrl: input.WEB_PUBLIC_URL ?? input.APP_WEB_URL,
    adminPublicUrl: input.ADMIN_PUBLIC_URL ?? input.ADMIN_WEB_URL,
    corsOrigins: input.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
    sessionCookieSecure: input.SESSION_COOKIE_SECURE,
    rateLimitEnabled: input.RATE_LIMIT_ENABLED,
    schedulerEnabled: input.SCHEDULER_ENABLED,
    emailProvider: input.EMAIL_PROVIDER,
    stripeConfigured: Boolean(input.STRIPE_SECRET_KEY),
    stripeEnabled: input.STRIPE_ENABLED,
    plaidConfigured: Boolean(input.PLAID_CLIENT_ID && input.PLAID_SECRET),
    plaidEnabled: input.PLAID_ENABLED,
    sentryConfigured: Boolean(input.SENTRY_DSN),
    releaseVersion: input.RELEASE_VERSION ?? null,
    commitSha: input.COMMIT_SHA ?? null,
  };
}

function requireProductionValue(
  ctx: z.RefinementCtx,
  value: string | undefined,
  key: string,
): void {
  if (!value) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [key],
      message: `${key} is required in production.`,
    });
  }
}

export const env = parseEnv(process.env);
