import type { FastifyInstance } from "fastify";

import {
  merchantByUrlQuerySchema,
  merchantSearchQuerySchema,
} from "../schemas/merchants.js";
import {
  resolveMerchantByUrl,
  searchMerchants,
} from "../services/merchantService.js";

export async function registerMerchantRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.get("/v1/merchants/search", async (request) => {
    const query = merchantSearchQuerySchema.parse(request.query);
    return searchMerchants(query.q, query.limit);
  });

  server.get("/v1/merchants/by-url", async (request) => {
    const query = merchantByUrlQuerySchema.parse(request.query);
    return resolveMerchantByUrl(query.url);
  });
}
