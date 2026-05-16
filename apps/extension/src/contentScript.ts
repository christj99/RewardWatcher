import {
  detectCheckoutContext,
  detectPurchaseAmountCents,
} from "./checkoutDetection.js";
import { resolveMerchantForPage } from "./merchantDetection.js";
import { renderRecommendationOverlay } from "./overlay.js";
import { checkoutApiClient } from "./runtimeApiClient.js";
import {
  dismissPage,
  isMerchantMuted,
  isPageDismissed,
  muteMerchant,
} from "./storage.js";
import type { RecommendationReceipt } from "./types.js";
import { normalizeUrlForLookup } from "./url.js";

let lastProcessedUrl: string | null = null;
let inFlight = false;
const webAppBaseUrl =
  import.meta.env.VITE_WEB_APP_BASE_URL ?? "http://localhost:5173";

void initializeCheckoutRecommendation();
installSpaNavigationObserver();

export async function initializeCheckoutRecommendation(
  documentRef: Document = document,
  locationRef: Location = window.location,
): Promise<void> {
  const currentUrl = locationRef.href;

  if (inFlight || lastProcessedUrl === currentUrl) {
    return;
  }

  inFlight = true;
  lastProcessedUrl = currentUrl;

  try {
    const checkoutContext = detectCheckoutContext(documentRef, locationRef);

    if (!checkoutContext.isCheckoutLike) {
      return;
    }

    if (await isPageDismissed(currentUrl)) {
      return;
    }

    const merchantResolution = await resolveMerchantForPage(
      currentUrl,
      checkoutApiClient,
    );

    if (!merchantResolution) {
      return;
    }

    if (await isMerchantMuted(merchantResolution.merchant.id)) {
      return;
    }

    const normalizedUrl = normalizeUrlForLookup(currentUrl);

    if (!normalizedUrl) {
      return;
    }

    const purchaseAmountCents = detectPurchaseAmountCents(documentRef);
    const recommendation = await checkoutApiClient.createCheckoutRecommendation(
      {
        merchantUrl: normalizedUrl,
        purchaseAmountCents: purchaseAmountCents ?? undefined,
      },
    );

    renderRecommendationOverlay(
      toOverlayRecommendation(recommendation, merchantResolution.merchant.id),
      documentRef,
    );
  } catch {
    // The extension should never interrupt checkout when the API is unavailable.
  } finally {
    inFlight = false;
  }
}

function toOverlayRecommendation(
  recommendation: RecommendationReceipt,
  merchantId: string,
) {
  return {
    receiptId: recommendation.id,
    merchant: recommendation.merchant ?? null,
    cardName: recommendation.primaryRecommendation.cardName,
    issuerName: recommendation.primaryRecommendation.issuerName,
    explanation: recommendation.explanation,
    confidence: recommendation.confidence,
    expectedValueCents: toNumber(
      recommendation.primaryRecommendation.expectedValueCents,
    ),
    warnings: recommendation.warnings,
    receiptUrl: `${webAppBaseUrl}/recommendations/${recommendation.id}`,
    feedbackUrl: `${webAppBaseUrl}/feedback?recommendationId=${recommendation.id}&type=WRONG_RECOMMENDATION`,
    onDismiss: () => {
      void dismissPage(window.location.href);
    },
    onMuteMerchant: () => {
      void muteMerchant(merchantId);
    },
  };
}

function toNumber(value: string | number): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function installSpaNavigationObserver(): void {
  let debounceTimer: number | undefined;
  const scheduleRun = () => {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      void initializeCheckoutRecommendation();
    }, 500);
  };

  for (const methodName of ["pushState", "replaceState"] as const) {
    const original = window.history[methodName];
    window.history[methodName] = function patchedHistoryMethod(
      ...args: Parameters<typeof original>
    ) {
      const result = original.apply(this, args);
      lastProcessedUrl = null;
      scheduleRun();
      return result;
    };
  }

  window.addEventListener("popstate", () => {
    lastProcessedUrl = null;
    scheduleRun();
  });

  const observer = new MutationObserver(() => {
    if (window.location.href !== lastProcessedUrl) {
      scheduleRun();
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
}
