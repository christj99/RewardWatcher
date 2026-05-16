-- CreateEnum
CREATE TYPE "CardNetwork" AS ENUM ('VISA', 'MASTERCARD', 'AMEX', 'DISCOVER', 'OTHER');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('ISSUER_PAGE', 'TERMS_DOC', 'CURATOR_RESEARCH', 'USER_CORRECTION', 'TRANSACTION_OUTCOME', 'COMMUNITY_REPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "CurrencyType" AS ENUM ('CASHBACK', 'TRANSFERABLE_POINTS', 'AIRLINE_MILES', 'HOTEL_POINTS', 'OTHER');

-- CreateEnum
CREATE TYPE "Lens" AS ENUM ('CASH_OUT', 'PRACTICAL', 'ASPIRATIONAL');

-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MerchantCategory" AS ENUM ('DINING', 'GROCERY', 'TRAVEL', 'AIRFARE', 'HOTEL', 'RIDESHARE', 'GAS', 'DRUGSTORE', 'STREAMING', 'ONLINE_RETAIL', 'WHOLESALE_CLUB', 'GENERAL', 'OTHER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CapPeriod" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL', 'LIFETIME');

-- CreateEnum
CREATE TYPE "BenefitType" AS ENUM ('TRAVEL_CREDIT', 'PURCHASE_PROTECTION', 'EXTENDED_WARRANTY', 'LOUNGE_ACCESS', 'TRIP_INSURANCE', 'STATEMENT_CREDIT', 'OTHER');

-- CreateEnum
CREATE TYPE "Recurrence" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "UrlPatternType" AS ENUM ('DOMAIN', 'URL_CONTAINS', 'REGEX');

-- CreateEnum
CREATE TYPE "PostingDataSource" AS ENUM ('CURATOR_RESEARCH', 'USER_CORRECTION', 'TRANSACTION_OUTCOME', 'IMPORTED_DATA', 'OTHER');

-- CreateEnum
CREATE TYPE "PreferenceType" AS ENUM ('PREFER_CARD', 'AVOID_CARD', 'IGNORE_CATEGORY', 'CUSTOM_NOTE');

-- CreateEnum
CREATE TYPE "RecommendationContext" AS ENUM ('ONLINE_CHECKOUT', 'MANUAL_LOOKUP', 'IMPORTED_TRANSACTION_REPLAY', 'OTHER');

-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('MANUAL', 'CSV_IMPORT', 'PLAID', 'TEST_FIXTURE');

-- CreateEnum
CREATE TYPE "OutcomeType" AS ENUM ('CAPTURED_OPTIMAL', 'USER_MISSED_VALUE', 'RECOMMENDATION_ERROR', 'UNMATCHED', 'USER_OVERRIDE', 'INCONCLUSIVE');

-- CreateEnum
CREATE TYPE "CorrectionType" AS ENUM ('WRONG_MERCHANT', 'WRONG_CATEGORY', 'WRONG_CARD_RULE', 'MISSED_OFFER', 'CAP_NOT_HANDLED', 'PERSONAL_PREFERENCE', 'OTHER');

-- CreateEnum
CREATE TYPE "CorrectionStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReviewTaskType" AS ENUM ('CARD_RULE_REVIEW', 'MERCHANT_MAPPING_REVIEW', 'POSTING_PROFILE_REVIEW', 'OFFER_REVIEW', 'OTHER');

-- CreateEnum
CREATE TYPE "ReviewTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "User" RENAME COLUMN "name" TO "displayName";
ALTER TABLE "User"
ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "plaidBetaEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Issuer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Issuer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "issuerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "network" "CardNetwork",
    "annualFeeCents" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardVersion" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "versionName" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "annualFeeCents" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleSource" (
    "id" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "retrievedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuleSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Currency" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currencyType" "CurrencyType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurrencyValuation" (
    "id" TEXT NOT NULL,
    "currencyId" TEXT NOT NULL,
    "lens" "Lens" NOT NULL,
    "centsPerPoint" DECIMAL(8,4) NOT NULL,
    "confidence" "ConfidenceLevel" NOT NULL,
    "sourceId" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurrencyValuation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EarningRule" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "cardVersionId" TEXT,
    "rewardCurrencyId" TEXT NOT NULL,
    "category" "MerchantCategory",
    "merchantId" TEXT,
    "multiplier" DECIMAL(8,4) NOT NULL,
    "baseRateMultiplier" DECIMAL(8,4),
    "capAmountCents" INTEGER,
    "capPeriod" "CapPeriod",
    "activationRequired" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "confidence" "ConfidenceLevel" NOT NULL,
    "sourceId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EarningRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Benefit" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "cardVersionId" TEXT,
    "benefitType" "BenefitType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "estimatedValueCents" INTEGER,
    "confidence" "ConfidenceLevel" NOT NULL,
    "sourceId" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Benefit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatementCredit" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "cardVersionId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "recurrence" "Recurrence" NOT NULL,
    "merchantId" TEXT,
    "category" "MerchantCategory",
    "activationRequired" BOOLEAN NOT NULL DEFAULT false,
    "confidence" "ConfidenceLevel" NOT NULL,
    "sourceId" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatementCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "MerchantCategory" NOT NULL,
    "websiteUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantUrlPattern" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "patternType" "UrlPatternType" NOT NULL,
    "confidence" "ConfidenceLevel" NOT NULL,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantUrlPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantPostingProfile" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "issuerId" TEXT,
    "network" "CardNetwork",
    "observedCategory" "MerchantCategory" NOT NULL,
    "observedMcc" TEXT,
    "dataSource" "PostingDataSource" NOT NULL,
    "confidence" "ConfidenceLevel" NOT NULL,
    "observationCount" INTEGER NOT NULL DEFAULT 0,
    "lastObservedAt" TIMESTAMP(3),
    "sourceId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantPostingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "nickname" TEXT,
    "openedAt" TIMESTAMP(3),
    "annualFeeDueMonth" INTEGER,
    "welcomeBonusDeadline" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userCardId" TEXT NOT NULL,
    "earningRuleId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "usedAmountCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreferenceRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT,
    "merchantId" TEXT,
    "category" "MerchantCategory",
    "preferenceType" "PreferenceType" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreferenceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "merchantId" TEXT,
    "merchantNameInput" TEXT,
    "merchantUrlInput" TEXT,
    "purchaseAmountCents" INTEGER,
    "context" "RecommendationContext" NOT NULL,
    "lens" "Lens" NOT NULL,
    "recommendedUserCardId" TEXT,
    "recommendedCardId" TEXT NOT NULL,
    "expectedCategory" "MerchantCategory" NOT NULL,
    "expectedValueCents" DECIMAL(12,4) NOT NULL,
    "confidence" "ConfidenceLevel" NOT NULL,
    "explanation" TEXT NOT NULL,
    "inputSnapshot" JSONB NOT NULL,
    "rankingSnapshot" JSONB NOT NULL,
    "ruleSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userCardId" TEXT,
    "merchantId" TEXT,
    "rawMerchantName" TEXT NOT NULL,
    "normalizedMerchantName" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "postedDate" TIMESTAMP(3),
    "source" "TransactionSource" NOT NULL,
    "externalId" TEXT,
    "observedCategory" "MerchantCategory",
    "observedMcc" TEXT,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationOutcome" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recommendationEventId" TEXT,
    "transactionId" TEXT NOT NULL,
    "outcomeType" "OutcomeType" NOT NULL,
    "actualUserCardId" TEXT,
    "bestUserCardId" TEXT,
    "recommendedUserCardId" TEXT,
    "expectedValueCents" DECIMAL(12,4),
    "capturedValueCents" DECIMAL(12,4),
    "missedValueCents" DECIMAL(12,4),
    "recommendationWasCorrect" BOOLEAN,
    "confidence" "ConfidenceLevel" NOT NULL,
    "explanation" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecommendationOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationCorrection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recommendationEventId" TEXT,
    "transactionId" TEXT,
    "correctionType" "CorrectionType" NOT NULL,
    "userNote" TEXT,
    "status" "CorrectionStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecommendationCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuratorReviewTask" (
    "id" TEXT NOT NULL,
    "correctionId" TEXT,
    "taskType" "ReviewTaskType" NOT NULL,
    "status" "ReviewTaskStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CuratorReviewTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Issuer_slug_key" ON "Issuer"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Card_slug_key" ON "Card"("slug");

-- CreateIndex
CREATE INDEX "Card_issuerId_idx" ON "Card"("issuerId");

-- CreateIndex
CREATE INDEX "CardVersion_cardId_idx" ON "CardVersion"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "CardVersion_cardId_versionName_key" ON "CardVersion"("cardId", "versionName");

-- CreateIndex
CREATE UNIQUE INDEX "RuleSource_sourceType_title_key" ON "RuleSource"("sourceType", "title");

-- CreateIndex
CREATE UNIQUE INDEX "Currency_code_key" ON "Currency"("code");

-- CreateIndex
CREATE INDEX "CurrencyValuation_sourceId_idx" ON "CurrencyValuation"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "CurrencyValuation_currencyId_lens_effectiveFrom_key" ON "CurrencyValuation"("currencyId", "lens", "effectiveFrom");

-- CreateIndex
CREATE INDEX "EarningRule_cardId_idx" ON "EarningRule"("cardId");

-- CreateIndex
CREATE INDEX "EarningRule_cardVersionId_idx" ON "EarningRule"("cardVersionId");

-- CreateIndex
CREATE INDEX "EarningRule_rewardCurrencyId_idx" ON "EarningRule"("rewardCurrencyId");

-- CreateIndex
CREATE INDEX "EarningRule_merchantId_idx" ON "EarningRule"("merchantId");

-- CreateIndex
CREATE INDEX "EarningRule_sourceId_idx" ON "EarningRule"("sourceId");

-- CreateIndex
CREATE INDEX "EarningRule_category_idx" ON "EarningRule"("category");

-- CreateIndex
CREATE INDEX "Benefit_cardId_idx" ON "Benefit"("cardId");

-- CreateIndex
CREATE INDEX "Benefit_cardVersionId_idx" ON "Benefit"("cardVersionId");

-- CreateIndex
CREATE INDEX "Benefit_sourceId_idx" ON "Benefit"("sourceId");

-- CreateIndex
CREATE INDEX "StatementCredit_cardId_idx" ON "StatementCredit"("cardId");

-- CreateIndex
CREATE INDEX "StatementCredit_cardVersionId_idx" ON "StatementCredit"("cardVersionId");

-- CreateIndex
CREATE INDEX "StatementCredit_merchantId_idx" ON "StatementCredit"("merchantId");

-- CreateIndex
CREATE INDEX "StatementCredit_sourceId_idx" ON "StatementCredit"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_slug_key" ON "Merchant"("slug");

-- CreateIndex
CREATE INDEX "MerchantUrlPattern_merchantId_idx" ON "MerchantUrlPattern"("merchantId");

-- CreateIndex
CREATE INDEX "MerchantUrlPattern_sourceId_idx" ON "MerchantUrlPattern"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "MerchantUrlPattern_merchantId_pattern_patternType_key" ON "MerchantUrlPattern"("merchantId", "pattern", "patternType");

-- CreateIndex
CREATE INDEX "MerchantPostingProfile_merchantId_idx" ON "MerchantPostingProfile"("merchantId");

-- CreateIndex
CREATE INDEX "MerchantPostingProfile_issuerId_idx" ON "MerchantPostingProfile"("issuerId");

-- CreateIndex
CREATE INDEX "MerchantPostingProfile_sourceId_idx" ON "MerchantPostingProfile"("sourceId");

-- CreateIndex
CREATE INDEX "UserCard_userId_idx" ON "UserCard"("userId");

-- CreateIndex
CREATE INDEX "UserCard_cardId_idx" ON "UserCard"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCard_userId_cardId_key" ON "UserCard"("userId", "cardId");

-- CreateIndex
CREATE INDEX "CapLedger_userId_idx" ON "CapLedger"("userId");

-- CreateIndex
CREATE INDEX "CapLedger_earningRuleId_idx" ON "CapLedger"("earningRuleId");

-- CreateIndex
CREATE UNIQUE INDEX "CapLedger_userCardId_earningRuleId_periodStart_key" ON "CapLedger"("userCardId", "earningRuleId", "periodStart");

-- CreateIndex
CREATE INDEX "UserPreferenceRule_userId_idx" ON "UserPreferenceRule"("userId");

-- CreateIndex
CREATE INDEX "UserPreferenceRule_cardId_idx" ON "UserPreferenceRule"("cardId");

-- CreateIndex
CREATE INDEX "UserPreferenceRule_merchantId_idx" ON "UserPreferenceRule"("merchantId");

-- CreateIndex
CREATE INDEX "RecommendationEvent_userId_createdAt_idx" ON "RecommendationEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RecommendationEvent_merchantId_idx" ON "RecommendationEvent"("merchantId");

-- CreateIndex
CREATE INDEX "RecommendationEvent_recommendedUserCardId_idx" ON "RecommendationEvent"("recommendedUserCardId");

-- CreateIndex
CREATE INDEX "RecommendationEvent_recommendedCardId_idx" ON "RecommendationEvent"("recommendedCardId");

-- CreateIndex
CREATE INDEX "Transaction_userId_transactionDate_idx" ON "Transaction"("userId", "transactionDate");

-- CreateIndex
CREATE INDEX "Transaction_userId_source_externalId_idx" ON "Transaction"("userId", "source", "externalId");

-- CreateIndex
CREATE INDEX "Transaction_userCardId_idx" ON "Transaction"("userCardId");

-- CreateIndex
CREATE INDEX "Transaction_merchantId_idx" ON "Transaction"("merchantId");

-- CreateIndex
CREATE INDEX "RecommendationOutcome_userId_createdAt_idx" ON "RecommendationOutcome"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RecommendationOutcome_recommendationEventId_idx" ON "RecommendationOutcome"("recommendationEventId");

-- CreateIndex
CREATE INDEX "RecommendationOutcome_transactionId_idx" ON "RecommendationOutcome"("transactionId");

-- CreateIndex
CREATE INDEX "RecommendationOutcome_actualUserCardId_idx" ON "RecommendationOutcome"("actualUserCardId");

-- CreateIndex
CREATE INDEX "RecommendationOutcome_bestUserCardId_idx" ON "RecommendationOutcome"("bestUserCardId");

-- CreateIndex
CREATE INDEX "RecommendationOutcome_recommendedUserCardId_idx" ON "RecommendationOutcome"("recommendedUserCardId");

-- CreateIndex
CREATE INDEX "RecommendationCorrection_userId_status_idx" ON "RecommendationCorrection"("userId", "status");

-- CreateIndex
CREATE INDEX "RecommendationCorrection_recommendationEventId_idx" ON "RecommendationCorrection"("recommendationEventId");

-- CreateIndex
CREATE INDEX "RecommendationCorrection_transactionId_idx" ON "RecommendationCorrection"("transactionId");

-- CreateIndex
CREATE INDEX "CuratorReviewTask_status_priority_idx" ON "CuratorReviewTask"("status", "priority");

-- CreateIndex
CREATE INDEX "CuratorReviewTask_correctionId_idx" ON "CuratorReviewTask"("correctionId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_issuerId_fkey" FOREIGN KEY ("issuerId") REFERENCES "Issuer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardVersion" ADD CONSTRAINT "CardVersion_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrencyValuation" ADD CONSTRAINT "CurrencyValuation_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrencyValuation" ADD CONSTRAINT "CurrencyValuation_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "RuleSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarningRule" ADD CONSTRAINT "EarningRule_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarningRule" ADD CONSTRAINT "EarningRule_cardVersionId_fkey" FOREIGN KEY ("cardVersionId") REFERENCES "CardVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarningRule" ADD CONSTRAINT "EarningRule_rewardCurrencyId_fkey" FOREIGN KEY ("rewardCurrencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarningRule" ADD CONSTRAINT "EarningRule_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarningRule" ADD CONSTRAINT "EarningRule_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "RuleSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Benefit" ADD CONSTRAINT "Benefit_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Benefit" ADD CONSTRAINT "Benefit_cardVersionId_fkey" FOREIGN KEY ("cardVersionId") REFERENCES "CardVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Benefit" ADD CONSTRAINT "Benefit_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "RuleSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementCredit" ADD CONSTRAINT "StatementCredit_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementCredit" ADD CONSTRAINT "StatementCredit_cardVersionId_fkey" FOREIGN KEY ("cardVersionId") REFERENCES "CardVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementCredit" ADD CONSTRAINT "StatementCredit_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementCredit" ADD CONSTRAINT "StatementCredit_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "RuleSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantUrlPattern" ADD CONSTRAINT "MerchantUrlPattern_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantUrlPattern" ADD CONSTRAINT "MerchantUrlPattern_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "RuleSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantPostingProfile" ADD CONSTRAINT "MerchantPostingProfile_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantPostingProfile" ADD CONSTRAINT "MerchantPostingProfile_issuerId_fkey" FOREIGN KEY ("issuerId") REFERENCES "Issuer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantPostingProfile" ADD CONSTRAINT "MerchantPostingProfile_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "RuleSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCard" ADD CONSTRAINT "UserCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCard" ADD CONSTRAINT "UserCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapLedger" ADD CONSTRAINT "CapLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapLedger" ADD CONSTRAINT "CapLedger_userCardId_fkey" FOREIGN KEY ("userCardId") REFERENCES "UserCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapLedger" ADD CONSTRAINT "CapLedger_earningRuleId_fkey" FOREIGN KEY ("earningRuleId") REFERENCES "EarningRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreferenceRule" ADD CONSTRAINT "UserPreferenceRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreferenceRule" ADD CONSTRAINT "UserPreferenceRule_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreferenceRule" ADD CONSTRAINT "UserPreferenceRule_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationEvent" ADD CONSTRAINT "RecommendationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationEvent" ADD CONSTRAINT "RecommendationEvent_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationEvent" ADD CONSTRAINT "RecommendationEvent_recommendedUserCardId_fkey" FOREIGN KEY ("recommendedUserCardId") REFERENCES "UserCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationEvent" ADD CONSTRAINT "RecommendationEvent_recommendedCardId_fkey" FOREIGN KEY ("recommendedCardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userCardId_fkey" FOREIGN KEY ("userCardId") REFERENCES "UserCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationOutcome" ADD CONSTRAINT "RecommendationOutcome_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationOutcome" ADD CONSTRAINT "RecommendationOutcome_recommendationEventId_fkey" FOREIGN KEY ("recommendationEventId") REFERENCES "RecommendationEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationOutcome" ADD CONSTRAINT "RecommendationOutcome_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationOutcome" ADD CONSTRAINT "RecommendationOutcome_actualUserCardId_fkey" FOREIGN KEY ("actualUserCardId") REFERENCES "UserCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationOutcome" ADD CONSTRAINT "RecommendationOutcome_bestUserCardId_fkey" FOREIGN KEY ("bestUserCardId") REFERENCES "UserCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationOutcome" ADD CONSTRAINT "RecommendationOutcome_recommendedUserCardId_fkey" FOREIGN KEY ("recommendedUserCardId") REFERENCES "UserCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationCorrection" ADD CONSTRAINT "RecommendationCorrection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationCorrection" ADD CONSTRAINT "RecommendationCorrection_recommendationEventId_fkey" FOREIGN KEY ("recommendationEventId") REFERENCES "RecommendationEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationCorrection" ADD CONSTRAINT "RecommendationCorrection_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuratorReviewTask" ADD CONSTRAINT "CuratorReviewTask_correctionId_fkey" FOREIGN KEY ("correctionId") REFERENCES "RecommendationCorrection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

