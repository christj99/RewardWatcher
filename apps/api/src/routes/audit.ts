import type { FastifyInstance } from "fastify";
import { BetaEventSource, BetaEventType, EntitlementKey } from "@prisma/client";

import { resolveCurrentUser } from "../plugins/currentUser.js";
import { weeklyAuditQuerySchema } from "../schemas/audit.js";
import { requireEntitlement } from "../services/entitlementService.js";
import { recordBetaEvent } from "../services/betaEventService.js";
import { getWeeklyAuditReport } from "../services/weeklyAuditService.js";

export async function registerAuditRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.get("/v1/audit/weekly", async (request) => {
    const user = await resolveCurrentUser(request);
    await requireEntitlement(user.id, EntitlementKey.WEEKLY_AUDIT_REPORT);
    const query = weeklyAuditQuerySchema.parse(request.query);

    const report = await getWeeklyAuditReport(user, {
      weekStart: query.weekStart,
      weekEnd: query.weekEnd,
      minMissedValueCents: query.minMissedValueCents,
      includeInconclusive: query.includeInconclusive,
      includeUnmatched: query.includeUnmatched,
      limitItems: query.limitItems,
    });
    void recordBetaEvent({
      userId: user.id,
      eventType: BetaEventType.WEEKLY_AUDIT_VIEWED,
      source: BetaEventSource.API,
      metadata: {
        weekStart: query.weekStart,
        weekEnd: query.weekEnd,
        itemCount: report.items?.length,
      },
    });
    return report;
  });
}
