-- CreateEnum
CREATE TYPE "ScheduledJobName" AS ENUM ('WEEKLY_AUDIT_EMAIL', 'REMINDER_DIGEST', 'ADMIN_ALERT', 'PLAID_SYNC_ALL', 'STATEMENT_CREDIT_USAGE_GENERATION', 'EVAL_KILL_TEST_SNAPSHOT');

-- CreateEnum
CREATE TYPE "ScheduledJobStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ScheduledJobTrigger" AS ENUM ('MANUAL', 'SCHEDULED', 'CLI');

-- CreateTable
CREATE TABLE "ScheduledJobRun" (
    "id" TEXT NOT NULL,
    "jobName" "ScheduledJobName" NOT NULL,
    "status" "ScheduledJobStatus" NOT NULL,
    "triggeredBy" "ScheduledJobTrigger" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "idempotencyKey" TEXT,
    "result" JSONB,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledJobRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledJobLock" (
    "id" TEXT NOT NULL,
    "jobName" "ScheduledJobName" NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL,
    "lockedBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledJobLock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledJobRun_idempotencyKey_key" ON "ScheduledJobRun"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ScheduledJobRun_jobName_idx" ON "ScheduledJobRun"("jobName");

-- CreateIndex
CREATE INDEX "ScheduledJobRun_status_idx" ON "ScheduledJobRun"("status");

-- CreateIndex
CREATE INDEX "ScheduledJobRun_startedAt_idx" ON "ScheduledJobRun"("startedAt");

-- CreateIndex
CREATE INDEX "ScheduledJobRun_idempotencyKey_idx" ON "ScheduledJobRun"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledJobLock_jobName_key" ON "ScheduledJobLock"("jobName");
