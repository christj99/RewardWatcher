import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadLocalEnvFile();

const required = [
  "DATABASE_URL",
  "API_PUBLIC_URL",
  "WEB_PUBLIC_URL",
  "ADMIN_PUBLIC_URL",
  "SECRET_ENCRYPTION_KEY",
] as const;

const errors: string[] = [];

for (const key of required) {
  if (!process.env[key]) {
    errors.push(`${key} is required.`);
  }
}

function loadLocalEnvFile(): void {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    return;
  }
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    if (process.env[key] !== undefined) continue;
    const rawValue = trimmed.slice(separator + 1).trim();
    const quote = rawValue[0];
    process.env[key] =
      (quote === '"' || quote === "'") && rawValue.endsWith(quote)
        ? rawValue.slice(1, -1)
        : rawValue;
  }
}

if ((process.env.SECRET_ENCRYPTION_KEY ?? "").length < 32) {
  errors.push("SECRET_ENCRYPTION_KEY must be at least 32 characters.");
}

if (process.env.ALLOW_DEV_AUTH_HEADER !== "false") {
  errors.push("ALLOW_DEV_AUTH_HEADER must be false.");
}

if (process.env.SESSION_COOKIE_SECURE !== "true") {
  errors.push("SESSION_COOKIE_SECURE must be true.");
}

if ((process.env.CORS_ORIGIN ?? "").split(",").includes("*")) {
  errors.push("CORS_ORIGIN must not contain '*'.");
}

if (
  process.env.EMAIL_PROVIDER === "postmark" &&
  !process.env.POSTMARK_SERVER_TOKEN
) {
  errors.push("POSTMARK_SERVER_TOKEN is required for Postmark.");
}

if (process.env.STRIPE_ENABLED === "true") {
  for (const key of [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_ID_ANNUAL",
  ]) {
    if (!process.env[key])
      errors.push(`${key} is required when Stripe is enabled.`);
  }
}

if (process.env.PLAID_ENABLED === "true") {
  for (const key of ["PLAID_CLIENT_ID", "PLAID_SECRET"]) {
    if (!process.env[key])
      errors.push(`${key} is required when Plaid is enabled.`);
  }
}

if (errors.length > 0) {
  console.error("Production configuration is invalid:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log("Production configuration is valid.");
  console.log(
    JSON.stringify(
      {
        appEnv: process.env.APP_ENV ?? "production",
        nodeEnv: process.env.NODE_ENV ?? "production",
        apiPublicUrl: process.env.API_PUBLIC_URL,
        webPublicUrl: process.env.WEB_PUBLIC_URL,
        adminPublicUrl: process.env.ADMIN_PUBLIC_URL,
        corsOrigins: process.env.CORS_ORIGIN,
        sessionCookieSecure: true,
        schedulerEnabled: process.env.SCHEDULER_ENABLED === "true",
        stripeEnabled: process.env.STRIPE_ENABLED === "true",
        plaidEnabled: process.env.PLAID_ENABLED === "true",
        sentryConfigured: Boolean(process.env.SENTRY_DSN),
        releaseVersion: process.env.RELEASE_VERSION ?? null,
        commitSha: process.env.COMMIT_SHA ?? null,
      },
      null,
      2,
    ),
  );
}
