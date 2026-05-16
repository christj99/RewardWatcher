import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { Readable } from "node:stream";

import { env } from "./config/env.js";
import { registerErrorHandler } from "./middleware/errorHandler.js";
import { registerRateLimit } from "./plugins/rateLimit.js";
import {
  registerRequestObservability,
  sanitizeRequestId,
} from "./plugins/requestObservability.js";
import { registerScheduler } from "./plugins/scheduler.js";
import { registerSecurityHeaders } from "./plugins/securityHeaders.js";
import { registerAdminCorrectionRoutes } from "./routes/adminCorrections.js";
import { registerAdminAuditLogRoutes } from "./routes/adminAuditLogs.js";
import { registerAdminBetaReadinessRoutes } from "./routes/adminBetaReadiness.js";
import { registerAdminBetaSupportRoutes } from "./routes/adminBetaSupport.js";
import { registerAdminBenefitRoutes } from "./routes/adminBenefits.js";
import { registerAdminBillingRoutes } from "./routes/adminBilling.js";
import { registerAdminCardRoutes } from "./routes/adminCards.js";
import { registerAdminCurrencyRoutes } from "./routes/adminCurrencies.js";
import { registerAdminDataQualityRoutes } from "./routes/adminDataQuality.js";
import { registerAdminEarningRuleRoutes } from "./routes/adminEarningRules.js";
import { registerAdminEmailLogRoutes } from "./routes/adminEmailLogs.js";
import { registerAdminIssuerRoutes } from "./routes/adminIssuers.js";
import { registerAdminJobRoutes } from "./routes/adminJobs.js";
import { registerAdminMerchantRoutes } from "./routes/adminMerchants.js";
import { registerAdminOfferRoutes } from "./routes/adminOffers.js";
import { registerAdminOpsRoutes } from "./routes/adminOps.js";
import { registerAdminReviewTaskRoutes } from "./routes/adminReviewTasks.js";
import { registerAdminRuleSourceRoutes } from "./routes/adminRuleSources.js";
import { registerAdminStatementCreditRoutes } from "./routes/adminStatementCredits.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerAuditRoutes } from "./routes/audit.js";
import { registerBillingRoutes } from "./routes/billing.js";
import { registerCardRoutes } from "./routes/cards.js";
import { registerCorrectionRoutes } from "./routes/corrections.js";
import { registerConsentRoutes } from "./routes/consents.js";
import { registerEvalRoutes } from "./routes/evals.js";
import { registerFeedbackRoutes } from "./routes/feedback.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerMerchantRoutes } from "./routes/merchants.js";
import { registerOutcomeRoutes } from "./routes/outcomes.js";
import { registerOfferRoutes } from "./routes/offers.js";
import { registerNotificationPreferenceRoutes } from "./routes/notificationPreferences.js";
import { registerPlaidRoutes } from "./routes/plaid.js";
import { registerPrivacyRoutes } from "./routes/privacy.js";
import { registerRecommendationRoutes } from "./routes/recommendations.js";
import { registerReminderRoutes } from "./routes/reminders.js";
import { registerStatementCreditUsageRoutes } from "./routes/statementCreditUsage.js";
import { registerTransactionRoutes } from "./routes/transactions.js";
import { registerUserRoutes } from "./routes/users.js";
import { registerWalletRoutes } from "./routes/wallet.js";

export async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: false,
    genReqId: (request) =>
      sanitizeRequestId(request.headers["x-request-id"]) ?? crypto.randomUUID(),
  });

  await registerSecurityHeaders(server);
  await registerRequestObservability(server);

  await server.register(cors, {
    origin: env.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  server.addHook("preParsing", async (request, _reply, payload) => {
    if (request.method === "POST" && request.url === "/v1/billing/webhook") {
      const chunks: Buffer[] = [];
      for await (const chunk of payload) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const rawBody = Buffer.concat(chunks);
      (request as typeof request & { rawBody?: Buffer }).rawBody = rawBody;
      return Readable.from(rawBody);
    }
    return payload;
  });

  await registerRateLimit(server);
  await registerScheduler(server);

  await registerHealthRoutes(server);
  await registerAuthRoutes(server);
  await registerUserRoutes(server);
  await registerCardRoutes(server);
  await registerWalletRoutes(server);
  await registerMerchantRoutes(server);
  await registerRecommendationRoutes(server);
  await registerTransactionRoutes(server);
  await registerOutcomeRoutes(server);
  await registerOfferRoutes(server);
  await registerNotificationPreferenceRoutes(server);
  await registerBillingRoutes(server);
  await registerPlaidRoutes(server);
  await registerReminderRoutes(server);
  await registerStatementCreditUsageRoutes(server);
  await registerAuditRoutes(server);
  await registerCorrectionRoutes(server);
  await registerConsentRoutes(server);
  await registerPrivacyRoutes(server);
  await registerFeedbackRoutes(server);
  await registerAdminIssuerRoutes(server);
  await registerAdminCardRoutes(server);
  await registerAdminRuleSourceRoutes(server);
  await registerAdminCurrencyRoutes(server);
  await registerAdminEarningRuleRoutes(server);
  await registerAdminBenefitRoutes(server);
  await registerAdminStatementCreditRoutes(server);
  await registerAdminMerchantRoutes(server);
  await registerAdminOfferRoutes(server);
  await registerAdminBillingRoutes(server);
  await registerAdminDataQualityRoutes(server);
  await registerAdminCorrectionRoutes(server);
  await registerAdminReviewTaskRoutes(server);
  await registerAdminAuditLogRoutes(server);
  await registerAdminEmailLogRoutes(server);
  await registerAdminJobRoutes(server);
  await registerAdminOpsRoutes(server);
  await registerAdminBetaReadinessRoutes(server);
  await registerAdminBetaSupportRoutes(server);
  await registerEvalRoutes(server);
  registerErrorHandler(server);

  return server;
}
