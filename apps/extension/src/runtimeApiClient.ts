import type { MerchantResolution, RecommendationReceipt } from "./types.js";

type RuntimeResponse =
  | { ok: true; data: unknown }
  | { ok: false; error: string; status?: number | undefined };

type RuntimeLike = {
  sendMessage: (message: object) => Promise<RuntimeResponse>;
};

export type CheckoutApiClient = {
  resolveMerchantByUrl: (url: string) => Promise<MerchantResolution>;
  createCheckoutRecommendation: (input: {
    merchantUrl: string;
    purchaseAmountCents?: number | undefined;
  }) => Promise<RecommendationReceipt>;
};

export const checkoutApiClient: CheckoutApiClient = {
  resolveMerchantByUrl: (url) =>
    sendRuntimeMessage<MerchantResolution>({
      type: "RA_RESOLVE_MERCHANT_BY_URL",
      url,
    }),
  createCheckoutRecommendation: (input) =>
    sendRuntimeMessage<RecommendationReceipt>({
      type: "RA_CREATE_CHECKOUT_RECOMMENDATION",
      input,
    }),
};

async function sendRuntimeMessage<T>(message: object): Promise<T> {
  const runtime = (globalThis as { chrome?: { runtime?: RuntimeLike } }).chrome
    ?.runtime;

  if (!runtime?.sendMessage) {
    throw new Error("Extension runtime is unavailable.");
  }

  const response = await runtime.sendMessage(message);

  if (!response.ok) {
    throw new Error(response.error);
  }

  return response.data as T;
}
