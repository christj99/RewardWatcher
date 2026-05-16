-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('ANNUAL_FEE', 'WELCOME_BONUS_DEADLINE', 'STATEMENT_CREDIT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('SCHEDULED', 'DUE', 'COMPLETED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ReminderRecurrence" AS ENUM ('NONE', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL');

-- CreateEnum
CREATE TYPE "ReminderSource" AS ENUM ('MANUAL', 'GENERATED', 'STATEMENT_CREDIT', 'WELCOME_BONUS', 'ANNUAL_FEE');

-- CreateEnum
CREATE TYPE "StatementCreditUsageStatus" AS ENUM ('UNUSED', 'PARTIALLY_USED', 'USED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "StatementCreditUsageSource" AS ENUM ('MANUAL', 'TRANSACTION_AUDIT', 'PLAID', 'IMPORTED_TRANSACTION', 'GENERATED');

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userCardId" TEXT,
    "statementCreditId" TEXT,
    "reminderType" "ReminderType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'SCHEDULED',
    "recurrence" "ReminderRecurrence",
    "lastTriggeredAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "source" "ReminderSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatementCreditUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userCardId" TEXT NOT NULL,
    "statementCreditId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "StatementCreditUsageStatus" NOT NULL DEFAULT 'UNKNOWN',
    "amountUsedCents" INTEGER,
    "estimatedRemainingCents" INTEGER,
    "source" "StatementCreditUsageSource" NOT NULL DEFAULT 'MANUAL',
    "matchedTransactionIds" JSONB,
    "evidence" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatementCreditUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reminder_userId_idx" ON "Reminder"("userId");

-- CreateIndex
CREATE INDEX "Reminder_userId_status_dueAt_idx" ON "Reminder"("userId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "Reminder_userCardId_idx" ON "Reminder"("userCardId");

-- CreateIndex
CREATE INDEX "Reminder_statementCreditId_idx" ON "Reminder"("statementCreditId");

-- CreateIndex
CREATE UNIQUE INDEX "StatementCreditUsage_userCardId_statementCreditId_periodStart_periodEnd_key" ON "StatementCreditUsage"("userCardId", "statementCreditId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "StatementCreditUsage_userId_idx" ON "StatementCreditUsage"("userId");

-- CreateIndex
CREATE INDEX "StatementCreditUsage_userCardId_idx" ON "StatementCreditUsage"("userCardId");

-- CreateIndex
CREATE INDEX "StatementCreditUsage_statementCreditId_idx" ON "StatementCreditUsage"("statementCreditId");

-- CreateIndex
CREATE INDEX "StatementCreditUsage_userId_periodStart_periodEnd_idx" ON "StatementCreditUsage"("userId", "periodStart", "periodEnd");

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_userCardId_fkey" FOREIGN KEY ("userCardId") REFERENCES "UserCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_statementCreditId_fkey" FOREIGN KEY ("statementCreditId") REFERENCES "StatementCredit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementCreditUsage" ADD CONSTRAINT "StatementCreditUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementCreditUsage" ADD CONSTRAINT "StatementCreditUsage_userCardId_fkey" FOREIGN KEY ("userCardId") REFERENCES "UserCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementCreditUsage" ADD CONSTRAINT "StatementCreditUsage_statementCreditId_fkey" FOREIGN KEY ("statementCreditId") REFERENCES "StatementCredit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
