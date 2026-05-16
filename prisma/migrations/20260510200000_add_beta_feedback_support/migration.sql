-- CreateEnum
CREATE TYPE "BetaUserStatus" AS ENUM ('INVITED', 'ACTIVE', 'STUCK', 'CHURNED', 'PAUSED');

-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('BUG', 'CONFUSING_RECOMMENDATION', 'WRONG_RECOMMENDATION', 'PLAID_ISSUE', 'BILLING_ISSUE', 'EXTENSION_ISSUE', 'PRIVACY_ISSUE', 'FEATURE_REQUEST', 'GENERAL_FEEDBACK');

-- CreateEnum
CREATE TYPE "FeedbackSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('OPEN', 'TRIAGED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SupportNoteVisibility" AS ENUM ('INTERNAL');

-- CreateEnum
CREATE TYPE "BetaEventType" AS ENUM ('USER_REGISTERED', 'USER_LOGGED_IN', 'WALLET_CARD_ADDED', 'RECOMMENDATION_CREATED', 'CORRECTION_SUBMITTED', 'TRANSACTION_IMPORTED', 'TRANSACTION_AUDITED', 'WEEKLY_AUDIT_VIEWED', 'PLAID_CONNECTED', 'PLAID_SYNC_COMPLETED', 'CHECKOUT_EXTENSION_RECOMMENDATION_SHOWN', 'BILLING_CHECKOUT_STARTED', 'PRIVACY_DELETION_REQUESTED', 'FEEDBACK_SUBMITTED');

-- CreateEnum
CREATE TYPE "BetaEventSource" AS ENUM ('API', 'WEB', 'ADMIN', 'EXTENSION', 'JOB');

-- CreateTable
CREATE TABLE "BetaCohort" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BetaCohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBetaProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "cohortId" TEXT,
  "status" "BetaUserStatus" NOT NULL DEFAULT 'INVITED',
  "invitedAt" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3),
  "firstRecommendationAt" TIMESTAMP(3),
  "firstTransactionAuditAt" TIMESTAMP(3),
  "firstPlaidSyncAt" TIMESTAMP(3),
  "notes" TEXT,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserBetaProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackReport" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "feedbackType" "FeedbackType" NOT NULL,
  "severity" "FeedbackSeverity" NOT NULL DEFAULT 'MEDIUM',
  "status" "FeedbackStatus" NOT NULL DEFAULT 'OPEN',
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "pageUrl" TEXT,
  "userAgent" TEXT,
  "context" JSONB,
  "linkedRecommendationEventId" TEXT,
  "linkedTransactionId" TEXT,
  "linkedOutcomeId" TEXT,
  "linkedPlaidConnectionId" TEXT,
  "linkedBillingSubscriptionId" TEXT,
  "assignedAdminUserId" TEXT,
  "resolutionNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "FeedbackReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportNote" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "adminUserId" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "visibility" "SupportNoteVisibility" NOT NULL DEFAULT 'INTERNAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetaEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "eventType" "BetaEventType" NOT NULL,
  "source" "BetaEventSource" NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BetaEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BetaCohort_slug_key" ON "BetaCohort"("slug");
CREATE UNIQUE INDEX "UserBetaProfile_userId_key" ON "UserBetaProfile"("userId");
CREATE INDEX "UserBetaProfile_cohortId_idx" ON "UserBetaProfile"("cohortId");
CREATE INDEX "UserBetaProfile_status_idx" ON "UserBetaProfile"("status");
CREATE INDEX "FeedbackReport_userId_idx" ON "FeedbackReport"("userId");
CREATE INDEX "FeedbackReport_feedbackType_idx" ON "FeedbackReport"("feedbackType");
CREATE INDEX "FeedbackReport_severity_idx" ON "FeedbackReport"("severity");
CREATE INDEX "FeedbackReport_status_idx" ON "FeedbackReport"("status");
CREATE INDEX "FeedbackReport_createdAt_idx" ON "FeedbackReport"("createdAt");
CREATE INDEX "FeedbackReport_assignedAdminUserId_idx" ON "FeedbackReport"("assignedAdminUserId");
CREATE INDEX "FeedbackReport_linkedRecommendationEventId_idx" ON "FeedbackReport"("linkedRecommendationEventId");
CREATE INDEX "FeedbackReport_linkedTransactionId_idx" ON "FeedbackReport"("linkedTransactionId");
CREATE INDEX "FeedbackReport_linkedOutcomeId_idx" ON "FeedbackReport"("linkedOutcomeId");
CREATE INDEX "SupportNote_userId_idx" ON "SupportNote"("userId");
CREATE INDEX "SupportNote_adminUserId_idx" ON "SupportNote"("adminUserId");
CREATE INDEX "SupportNote_createdAt_idx" ON "SupportNote"("createdAt");
CREATE INDEX "BetaEvent_userId_idx" ON "BetaEvent"("userId");
CREATE INDEX "BetaEvent_eventType_idx" ON "BetaEvent"("eventType");
CREATE INDEX "BetaEvent_source_idx" ON "BetaEvent"("source");
CREATE INDEX "BetaEvent_createdAt_idx" ON "BetaEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "UserBetaProfile" ADD CONSTRAINT "UserBetaProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserBetaProfile" ADD CONSTRAINT "UserBetaProfile_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "BetaCohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeedbackReport" ADD CONSTRAINT "FeedbackReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeedbackReport" ADD CONSTRAINT "FeedbackReport_linkedRecommendationEventId_fkey" FOREIGN KEY ("linkedRecommendationEventId") REFERENCES "RecommendationEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeedbackReport" ADD CONSTRAINT "FeedbackReport_linkedTransactionId_fkey" FOREIGN KEY ("linkedTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeedbackReport" ADD CONSTRAINT "FeedbackReport_linkedOutcomeId_fkey" FOREIGN KEY ("linkedOutcomeId") REFERENCES "RecommendationOutcome"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FeedbackReport" ADD CONSTRAINT "FeedbackReport_assignedAdminUserId_fkey" FOREIGN KEY ("assignedAdminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportNote" ADD CONSTRAINT "SupportNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportNote" ADD CONSTRAINT "SupportNote_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BetaEvent" ADD CONSTRAINT "BetaEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
