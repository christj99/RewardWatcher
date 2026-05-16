import { extensionConfig, type ExtensionConfig } from "./config.js";
import { getExtensionSessionToken } from "./storage.js";
import {
  ExtensionApiError,
  type MerchantResolution,
  type RecommendationReceipt,
} from "./types.js";

export type ExtensionApiClientOptions = Partial<ExtensionConfig> & {
  fetchImpl?: typeof fetch;
};

export function createExtensionApiClient(
  options: ExtensionApiClientOptions = {},
) {
  const apiBaseUrl = options.apiBaseUrl ?? extensionConfig.apiBaseUrl;
  const devUserEmail = options.devUserEmail ?? extensionConfig.devUserEmail;
  const useDevAuthHeader =
    options.useDevAuthHeader ??
    (options.devUserEmail !== undefined || extensionConfig.useDevAuthHeader);
  const fetchImpl = options.fetchImpl ?? fetch;

  async function request<T>(
    path: string,
    init: RequestInit & { query?: Record<string, unknown> } = {},
  ): Promise<T> {
    const url = new URL(path, apiBaseUrl);

    for (const [key, value] of Object.entries(init.query ?? {})) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }

    const headers = new Headers(init.headers);
    const bearerToken = await getExtensionSessionToken();
    if (bearerToken) {
      headers.set("authorization", `Bearer ${bearerToken}`);
    } else if (useDevAuthHeader) {
      headers.set("x-user-email", devUserEmail);
    }

    if (init.body && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    const response = await fetchImpl(url.toString(), {
      ...init,
      headers,
    });
    const text = await response.text();
    const data = text ? (JSON.parse(text) as unknown) : undefined;

    if (!response.ok) {
      throw new ExtensionApiError(readApiError(data), response.status, data);
    }

    return data as T;
  }

  return {
    resolveMerchantByUrl: (url: string) =>
      request<MerchantResolution>("/v1/merchants/by-url", {
        query: { url },
      }),
    createCheckoutRecommendation: (input: {
      merchantUrl: string;
      purchaseAmountCents?: number | undefined;
    }) =>
      request<RecommendationReceipt>("/v1/recommendations", {
        method: "POST",
        body: JSON.stringify({
          merchantUrl: input.merchantUrl,
          purchaseAmountCents: input.purchaseAmountCents,
          lens: "PRACTICAL",
          context: "ONLINE_CHECKOUT",
        }),
      }),
    getCurrentUser: () => request<unknown>("/v1/users/me"),
    createExtensionSession: (token: string) =>
      request<{ extensionToken: string; expiresAt: string }>(
        "/v1/auth/extension-session",
        {
          method: "POST",
          body: JSON.stringify({ token }),
        },
      ),
  };
}

export const extensionApiClient = createExtensionApiClient();

function readApiError(data: unknown): string {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (typeof record.message === "string") {
      return record.message;
    }
    if (typeof record.error === "string") {
      return record.error;
    }
  }

  return "The API request failed.";
}
