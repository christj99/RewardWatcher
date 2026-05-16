-- Phase 14 security, privacy, consent, and audit logging primitives.
CREATE TYPE "AdminAuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'RETIRE', 'EXPIRE', 'RESOLVE', 'REJECT', 'LINK', 'UNLINK', 'OTHER');

CREATE TYPE "ConsentType" AS ENUM ('PLAID_TRANSACTIONS', 'EMAIL_REMINDERS', 'TERMS_OF_SERVICE', 'PRIVACY_POLICY', 'WEEKLY_AUDIT', 'OFFER_TRACKING');

CREATE TYPE "PrivacyRequestType" AS ENUM ('DELETE_ACCOUNT', 'DELETE_PLAID_DATA', 'DELETE_TRANSACTIONS', 'EXPORT_DATA');

CREATE TYPE "PrivacyRequestStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT,
    "action" "AdminAuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consentType" "ConsentType" NOT NULL,
    "version" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrivacyRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestType" "PrivacyRequestType" NOT NULL,
    "status" "PrivacyRequestStatus" NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "summary" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrivacyRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminAuditLog_adminUserId_idx" ON "AdminAuditLog"("adminUserId");
CREATE INDEX "AdminAuditLog_entityType_idx" ON "AdminAuditLog"("entityType");
CREATE INDEX "AdminAuditLog_entityId_idx" ON "AdminAuditLog"("entityId");
CREATE INDEX "AdminAuditLog_action_idx" ON "AdminAuditLog"("action");
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

CREATE INDEX "ConsentRecord_userId_idx" ON "ConsentRecord"("userId");
CREATE INDEX "ConsentRecord_consentType_idx" ON "ConsentRecord"("consentType");
CREATE INDEX "ConsentRecord_grantedAt_idx" ON "ConsentRecord"("grantedAt");
CREATE INDEX "ConsentRecord_revokedAt_idx" ON "ConsentRecord"("revokedAt");

CREATE INDEX "PrivacyRequest_userId_idx" ON "PrivacyRequest"("userId");
CREATE INDEX "PrivacyRequest_requestType_idx" ON "PrivacyRequest"("requestType");
CREATE INDEX "PrivacyRequest_status_idx" ON "PrivacyRequest"("status");
CREATE INDEX "PrivacyRequest_requestedAt_idx" ON "PrivacyRequest"("requestedAt");

ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PrivacyRequest" ADD CONSTRAINT "PrivacyRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
