-- CreateEnum
CREATE TYPE "IssuerOfferType" AS ENUM ('STATEMENT_CREDIT', 'BONUS_POINTS', 'BONUS_MULTIPLIER', 'DISCOUNT', 'OTHER');

-- CreateEnum
CREATE TYPE "UserOfferStatus" AS ENUM ('AVAILABLE', 'ACTIVATED', 'USED', 'EXPIRED', 'DISMISSED');

-- CreateTable
CREATE TABLE "IssuerOffer" (
    "id" TEXT NOT NULL,
    "issuerId" TEXT,
    "cardId" TEXT,
    "merchantId" TEXT,
    "category" "MerchantCategory",
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "offerType" "IssuerOfferType" NOT NULL,
    "valueCents" INTEGER,
    "bonusPoints" INTEGER,
    "bonusCurrencyId" TEXT,
    "bonusMultiplier" DECIMAL(8,4),
    "minSpendCents" INTEGER,
    "maxRewardCents" INTEGER,
    "activationRequired" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "confidence" "ConfidenceLevel" NOT NULL,
    "sourceId" TEXT,
    "termsUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IssuerOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserOfferActivation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "issuerOfferId" TEXT NOT NULL,
    "userCardId" TEXT,
    "status" "UserOfferStatus" NOT NULL DEFAULT 'AVAILABLE',
    "activatedAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserOfferActivation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IssuerOffer_issuerId_idx" ON "IssuerOffer"("issuerId");

-- CreateIndex
CREATE INDEX "IssuerOffer_cardId_idx" ON "IssuerOffer"("cardId");

-- CreateIndex
CREATE INDEX "IssuerOffer_merchantId_idx" ON "IssuerOffer"("merchantId");

-- CreateIndex
CREATE INDEX "IssuerOffer_category_idx" ON "IssuerOffer"("category");

-- CreateIndex
CREATE INDEX "IssuerOffer_startsAt_idx" ON "IssuerOffer"("startsAt");

-- CreateIndex
CREATE INDEX "IssuerOffer_endsAt_idx" ON "IssuerOffer"("endsAt");

-- CreateIndex
CREATE INDEX "IssuerOffer_confidence_idx" ON "IssuerOffer"("confidence");

-- CreateIndex
CREATE UNIQUE INDEX "UserOfferActivation_userId_issuerOfferId_userCardId_key" ON "UserOfferActivation"("userId", "issuerOfferId", "userCardId");

-- CreateIndex
CREATE INDEX "UserOfferActivation_userId_idx" ON "UserOfferActivation"("userId");

-- CreateIndex
CREATE INDEX "UserOfferActivation_issuerOfferId_idx" ON "UserOfferActivation"("issuerOfferId");

-- CreateIndex
CREATE INDEX "UserOfferActivation_userCardId_idx" ON "UserOfferActivation"("userCardId");

-- CreateIndex
CREATE INDEX "UserOfferActivation_status_idx" ON "UserOfferActivation"("status");

-- CreateIndex
CREATE INDEX "UserOfferActivation_expiresAt_idx" ON "UserOfferActivation"("expiresAt");

-- AddForeignKey
ALTER TABLE "IssuerOffer" ADD CONSTRAINT "IssuerOffer_issuerId_fkey" FOREIGN KEY ("issuerId") REFERENCES "Issuer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssuerOffer" ADD CONSTRAINT "IssuerOffer_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssuerOffer" ADD CONSTRAINT "IssuerOffer_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssuerOffer" ADD CONSTRAINT "IssuerOffer_bonusCurrencyId_fkey" FOREIGN KEY ("bonusCurrencyId") REFERENCES "Currency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssuerOffer" ADD CONSTRAINT "IssuerOffer_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "RuleSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOfferActivation" ADD CONSTRAINT "UserOfferActivation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOfferActivation" ADD CONSTRAINT "UserOfferActivation_issuerOfferId_fkey" FOREIGN KEY ("issuerOfferId") REFERENCES "IssuerOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOfferActivation" ADD CONSTRAINT "UserOfferActivation_userCardId_fkey" FOREIGN KEY ("userCardId") REFERENCES "UserCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
