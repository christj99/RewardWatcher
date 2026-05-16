import { describe, expect, it } from "vitest";

import { parseEnv } from "../src/config/env.js";

describe("parseEnv", () => {
  it("validates and coerces required environment variables", () => {
    const env = parseEnv({
      DATABASE_URL: "postgresql://user:pass@localhost:5432/rewards_audit",
      PORT: "4000",
    });

    expect(env.NODE_ENV).toBe("development");
    expect(env.PORT).toBe(4000);
    expect(env.HOST).toBe("0.0.0.0");
    expect(env.CORS_ORIGIN).toBe(
      "http://localhost:3000,http://localhost:5173,http://localhost:5174",
    );
    expect(env.DEV_USER_EMAIL).toBe("beta@example.com");
    expect(env.PLAID_ENV).toBe("sandbox");
    expect(env.PLAID_PRODUCTS).toBe("transactions");
    expect(env.PLAID_COUNTRY_CODES).toBe("US");
  });

  it("rejects invalid database URLs", () => {
    expect(() =>
      parseEnv({
        DATABASE_URL: "not-a-url",
      }),
    ).toThrow();
  });

  it("rejects unsafe production configuration", () => {
    expect(() =>
      parseEnv({
        APP_ENV: "production",
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/rewards_audit",
        CORS_ORIGIN: "*",
        ALLOW_DEV_AUTH_HEADER: "true",
        SESSION_COOKIE_SECURE: "false",
      }),
    ).toThrow();
  });

  it("accepts safe production configuration", () => {
    const env = parseEnv({
      APP_ENV: "production",
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/rewards_audit",
      API_PUBLIC_URL: "https://api.example.com",
      WEB_PUBLIC_URL: "https://app.example.com",
      ADMIN_PUBLIC_URL: "https://admin.example.com",
      CORS_ORIGIN: "https://app.example.com,https://admin.example.com",
      ALLOW_DEV_AUTH_HEADER: "false",
      SESSION_COOKIE_SECURE: "true",
      SECRET_ENCRYPTION_KEY: "x".repeat(32),
    });

    expect(env.APP_ENV).toBe("production");
    expect(env.ALLOW_DEV_AUTH_HEADER).toBe(false);
  });

  it("allows missing paid providers in development", () => {
    const env = parseEnv({
      APP_ENV: "development",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/rewards_audit",
    });

    expect(env.STRIPE_ENABLED).toBe(false);
    expect(env.PLAID_ENABLED).toBe(false);
    expect(env.EMAIL_PROVIDER).toBe("console");
  });
});
