import { createExtensionApiClient } from "./apiClient.js";

type BackgroundRequest =
  | { type: "RA_RESOLVE_MERCHANT_BY_URL"; url: string }
  | {
      type: "RA_CREATE_CHECKOUT_RECOMMENDATION";
      input: {
        merchantUrl: string;
        purchaseAmountCents?: number | undefined;
      };
    };

type BackgroundResponse =
  | { ok: true; data: unknown }
  | { ok: false; error: string; status?: number | undefined };

type RuntimeLike = {
  onMessage: {
    addListener: (
      listener: (
        message: BackgroundRequest,
        sender: unknown,
        sendResponse: (response: BackgroundResponse) => void,
      ) => true | void,
    ) => void;
  };
};

const apiClient = createExtensionApiClient();
const runtime = (globalThis as { chrome?: { runtime?: RuntimeLike } }).chrome
  ?.runtime;

runtime?.onMessage.addListener((message, _sender, sendResponse) => {
  void handleMessage(message)
    .then((data) => {
      sendResponse({ ok: true, data });
    })
    .catch((error: unknown) => {
      const maybeError = error as { message?: unknown; status?: unknown };
      sendResponse({
        ok: false,
        error:
          typeof maybeError.message === "string"
            ? maybeError.message
            : "The extension request failed.",
        status:
          typeof maybeError.status === "number" ? maybeError.status : undefined,
      });
    });

  return true;
});

async function handleMessage(message: BackgroundRequest): Promise<unknown> {
  switch (message.type) {
    case "RA_RESOLVE_MERCHANT_BY_URL":
      return apiClient.resolveMerchantByUrl(message.url);
    case "RA_CREATE_CHECKOUT_RECOMMENDATION":
      return apiClient.createCheckoutRecommendation(message.input);
  }
}
