import type { FastifyInstance } from "fastify";

import { requireAdminUser } from "../plugins/adminGuard.js";
import {
  currencyIdParamSchema,
  idParamSchema,
} from "../schemas/adminShared.js";
import {
  adminCurrencyCreateSchema,
  adminCurrencyListQuerySchema,
  adminCurrencyUpdateSchema,
  adminCurrencyValuationCreateSchema,
  adminCurrencyValuationUpdateSchema,
} from "../schemas/adminCurrencies.js";
import {
  createAdminCurrency,
  createAdminCurrencyValuation,
  getAdminCurrency,
  getAdminCurrencyValuation,
  listAdminCurrencies,
  listAdminCurrencyValuations,
  updateAdminCurrency,
  updateAdminCurrencyValuation,
} from "../services/adminCurrencyService.js";

export async function registerAdminCurrencyRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.get("/v1/admin/currencies", async (request) => {
    await requireAdminUser(request);
    const query = adminCurrencyListQuerySchema.parse(request.query);
    return listAdminCurrencies(query);
  });

  server.post("/v1/admin/currencies", async (request, reply) => {
    await requireAdminUser(request);
    const body = adminCurrencyCreateSchema.parse(request.body);
    void reply.status(201);
    return createAdminCurrency(body);
  });

  server.get("/v1/admin/currencies/:id", async (request) => {
    await requireAdminUser(request);
    const params = idParamSchema.parse(request.params);
    return getAdminCurrency(params.id);
  });

  server.patch("/v1/admin/currencies/:id", async (request) => {
    await requireAdminUser(request);
    const params = idParamSchema.parse(request.params);
    const body = adminCurrencyUpdateSchema.parse(request.body);
    return updateAdminCurrency(params.id, body);
  });

  server.get("/v1/admin/currencies/:currencyId/valuations", async (request) => {
    await requireAdminUser(request);
    const params = currencyIdParamSchema.parse(request.params);
    return listAdminCurrencyValuations(params.currencyId);
  });

  server.post(
    "/v1/admin/currencies/:currencyId/valuations",
    async (request, reply) => {
      await requireAdminUser(request);
      const params = currencyIdParamSchema.parse(request.params);
      const body = adminCurrencyValuationCreateSchema.parse(request.body);
      void reply.status(201);
      return createAdminCurrencyValuation(params.currencyId, body);
    },
  );

  server.get("/v1/admin/currency-valuations/:id", async (request) => {
    await requireAdminUser(request);
    const params = idParamSchema.parse(request.params);
    return getAdminCurrencyValuation(params.id);
  });

  server.patch("/v1/admin/currency-valuations/:id", async (request) => {
    await requireAdminUser(request);
    const params = idParamSchema.parse(request.params);
    const body = adminCurrencyValuationUpdateSchema.parse(request.body);
    return updateAdminCurrencyValuation(params.id, body);
  });
}
