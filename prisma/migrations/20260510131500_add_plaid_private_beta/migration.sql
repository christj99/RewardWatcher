-- CreateEnum
CREATE TYPE "PlaidConnectionStatus" AS ENUM ('ACTIVE', 'ERROR', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "PlaidSyncStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "PlaidConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "accessTokenEncrypted" TEXT NOT NULL,
    "institutionId" TEXT,
    "institutionName" TEXT,
    "status" "PlaidConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "cursor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaidConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaidAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plaidConnectionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "officialName" TEXT,
    "mask" TEXT,
    "type" TEXT,
    "subtype" TEXT,
    "linkedUserCardId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaidAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaidSyncRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plaidConnectionId" TEXT NOT NULL,
    "status" "PlaidSyncStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "addedCount" INTEGER NOT NULL DEFAULT 0,
    "modifiedCount" INTEGER NOT NULL DEFAULT 0,
    "removedCount" INTEGER NOT NULL DEFAULT 0,
    "importedTransactionCount" INTEGER NOT NULL DEFAULT 0,
    "auditedTransactionCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaidSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlaidConnection_itemId_key" ON "PlaidConnection"("itemId");

-- CreateIndex
CREATE INDEX "PlaidConnection_userId_idx" ON "PlaidConnection"("userId");

-- CreateIndex
CREATE INDEX "PlaidConnection_status_idx" ON "PlaidConnection"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PlaidAccount_plaidConnectionId_accountId_key" ON "PlaidAccount"("plaidConnectionId", "accountId");

-- CreateIndex
CREATE INDEX "PlaidAccount_userId_idx" ON "PlaidAccount"("userId");

-- CreateIndex
CREATE INDEX "PlaidAccount_linkedUserCardId_idx" ON "PlaidAccount"("linkedUserCardId");

-- CreateIndex
CREATE INDEX "PlaidSyncRun_userId_idx" ON "PlaidSyncRun"("userId");

-- CreateIndex
CREATE INDEX "PlaidSyncRun_plaidConnectionId_idx" ON "PlaidSyncRun"("plaidConnectionId");

-- CreateIndex
CREATE INDEX "PlaidSyncRun_status_idx" ON "PlaidSyncRun"("status");

-- AddForeignKey
ALTER TABLE "PlaidConnection" ADD CONSTRAINT "PlaidConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaidAccount" ADD CONSTRAINT "PlaidAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaidAccount" ADD CONSTRAINT "PlaidAccount_plaidConnectionId_fkey" FOREIGN KEY ("plaidConnectionId") REFERENCES "PlaidConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaidAccount" ADD CONSTRAINT "PlaidAccount_linkedUserCardId_fkey" FOREIGN KEY ("linkedUserCardId") REFERENCES "UserCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaidSyncRun" ADD CONSTRAINT "PlaidSyncRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaidSyncRun" ADD CONSTRAINT "PlaidSyncRun_plaidConnectionId_fkey" FOREIGN KEY ("plaidConnectionId") REFERENCES "PlaidConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
