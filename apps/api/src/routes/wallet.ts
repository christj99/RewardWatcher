import type { FastifyInstance } from "fastify";
import { BetaEventSource, BetaEventType } from "@prisma/client";

import { resolveCurrentUser } from "../plugins/currentUser.js";
import {
  createWalletCardSchema,
  updateWalletCardSchema,
  walletParamsSchema,
} from "../schemas/wallet.js";
import {
  addWalletCard,
  deactivateWalletCard,
  listWallet,
  updateWalletCard,
} from "../services/walletService.js";
import { recordBetaEvent } from "../services/betaEventService.js";

export async function registerWalletRoutes(
  server: FastifyInstance,
): Promise<void> {
  server.get("/v1/wallet", async (request) => {
    const user = await resolveCurrentUser(request);
    return listWallet(user);
  });

  server.post("/v1/wallet", async (request, reply) => {
    const user = await resolveCurrentUser(request);
    const body = createWalletCardSchema.parse(request.body);
    const userCard = await addWalletCard(user, {
      cardId: body.cardId,
      nickname: body.nickname,
      openedAt: body.openedAt,
      annualFeeDueMonth: body.annualFeeDueMonth,
      welcomeBonusDeadline: body.welcomeBonusDeadline,
    });
    void recordBetaEvent({
      userId: user.id,
      eventType: BetaEventType.WALLET_CARD_ADDED,
      source: BetaEventSource.API,
      metadata: { userCardId: userCard.id, cardId: userCard.cardId },
    });

    void reply.status(201);
    return userCard;
  });

  server.patch("/v1/wallet/:userCardId", async (request) => {
    const user = await resolveCurrentUser(request);
    const params = walletParamsSchema.parse(request.params);
    const body = updateWalletCardSchema.parse(request.body);
    return updateWalletCard(user, params.userCardId, {
      nickname: body.nickname,
      openedAt: body.openedAt,
      annualFeeDueMonth: body.annualFeeDueMonth,
      welcomeBonusDeadline: body.welcomeBonusDeadline,
      isActive: body.isActive,
    });
  });

  server.delete("/v1/wallet/:userCardId", async (request) => {
    const user = await resolveCurrentUser(request);
    const params = walletParamsSchema.parse(request.params);
    return deactivateWalletCard(user, params.userCardId);
  });
}
