import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url));
const localEnv = readLocalEnv();

export default defineConfig({
  resolve: {
    alias: {
      "@rewards-audit/db": `${workspaceRoot}/packages/db/src/index.ts`,
      "@rewards-audit/rewards-engine": `${workspaceRoot}/packages/rewards-engine/src/index.ts`,
      "@rewards-audit/shared-types": `${workspaceRoot}/packages/shared-types/src/index.ts`,
    },
  },
  test: {
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        process.env.DATABASE_URL ??
        localEnv.DATABASE_URL ??
        "postgresql://rewards_audit:rewards_audit_password@localhost:5432/rewards_audit?schema=public",
      NODE_ENV: "test",
    },
  },
});

function readLocalEnv(): Record<string, string> {
  const candidatePaths = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "..", ".env"),
    resolve(process.cwd(), "..", "..", ".env"),
  ];
  const envPath = candidatePaths.find((candidate) => existsSync(candidate));

  if (!envPath) {
    return {};
  }

  const result: Record<string, string> = {};

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const quote = rawValue[0];
    result[key] =
      (quote === '"' || quote === "'") && rawValue.endsWith(quote)
        ? rawValue.slice(1, -1)
        : rawValue;
  }

  return result;
}
