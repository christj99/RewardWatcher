export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

export type Lens = "CASH_OUT" | "PRACTICAL" | "ASPIRATIONAL";

export type RecommendationContext =
  | "ONLINE_CHECKOUT"
  | "MANUAL_LOOKUP"
  | "IMPORTED_TRANSACTION_REPLAY"
  | "OTHER";

export type Merchant = {
  id: string;
  name: string;
  slug: string;
  category: string;
  websiteUrl?: string | null;
};

export type MerchantResolution = {
  merchant: Merchant;
  matchedPattern?: {
    id: string;
    pattern: string;
    patternType: string;
  };
  confidence: ConfidenceLevel;
};

export type RecommendedCardResult = {
  rank: number;
  userCardId: string;
  cardId: string;
  cardName: string;
  issuerName: string;
  rewardCurrencyCode: string;
  matchedRuleId?: string;
  matchedRuleDescription?: string;
  effectiveMultiplier: string | number;
  expectedPoints: string | number;
  expectedValueCents: string | number;
  confidence: ConfidenceLevel;
  explanationParts: string[];
  warnings: string[];
};

export type RecommendationReceipt = {
  id: string;
  createdAt: string;
  merchant?: Merchant | null;
  purchaseAmountCents?: number | null;
  context: RecommendationContext;
  lens: Lens;
  expectedCategory: string;
  confidence: ConfidenceLevel;
  explanation: string;
  primaryRecommendation: RecommendedCardResult;
  alternatives: RecommendedCardResult[];
  warnings: string[];
};

export type CheckoutDetectionResult = {
  isCheckoutLike: boolean;
  confidence: ConfidenceLevel;
  reasons: string[];
};

export type OverlayRecommendation = {
  receiptId: string;
  merchant?: Merchant | null;
  cardName: string;
  issuerName?: string;
  explanation: string;
  confidence: ConfidenceLevel;
  expectedValueCents?: number | null;
  warnings: string[];
  receiptUrl: string;
  feedbackUrl?: string;
  onDismiss: () => void;
  onMuteMerchant?: () => void;
};

export class ExtensionApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly data: unknown,
  ) {
    super(message);
    this.name = "ExtensionApiError";
  }
}
