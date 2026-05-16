import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { formatKillTestSummary } from "../packages/rewards-engine/src/index.js";
import { prisma } from "../packages/db/src/index.js";
import { getKillTestEvaluation } from "../apps/api/src/services/evalsService.js";

type CliArgs = {
  startDate?: string | undefined;
  endDate?: string | undefined;
  meaningfulMissThresholdCents: number;
  annualSubscriptionPriceCents: number;
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const report = await getKillTestEvaluation({
    startDate: args.startDate,
    endDate: args.endDate,
    meaningfulMissThresholdCents: args.meaningfulMissThresholdCents,
    annualSubscriptionPriceCents: args.annualSubscriptionPriceCents,
    primaryKillTestUserShare: 0.5,
    maxRecommendationErrorRate: 0.1,
    maxInconclusiveRate: 0.25,
  });
  const reportPath = await writeReport(report);

  for (const line of formatKillTestSummary(report.metrics)) {
    console.log(line);
  }
  console.log(`Report path: ${reportPath}`);
}

function parseArgs(args: string[]): CliArgs {
  const parsed = new Map<string, string>();

  for (const arg of args) {
    const [key, value] = arg.replace(/^--/, "").split("=");
    if (key && value) {
      parsed.set(key, value);
    }
  }

  return {
    startDate: parsed.get("startDate"),
    endDate: parsed.get("endDate"),
    meaningfulMissThresholdCents: numberArg(
      parsed.get("meaningfulMissThresholdCents"),
      500,
    ),
    annualSubscriptionPriceCents: numberArg(
      parsed.get("annualSubscriptionPriceCents"),
      6900,
    ),
  };
}

function numberArg(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function writeReport(report: unknown): Promise<string> {
  const reportsDir = join(process.cwd(), "evals", "reports");
  await mkdir(reportsDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = join(reportsDir, `report_${timestamp}.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
