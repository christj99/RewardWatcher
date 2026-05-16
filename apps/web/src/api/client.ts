import { ApiError } from "./errors.js";
import type {
  CardSummary,
  ConsentRecord,
  ConsentType,
  BillingStatus,
  CorrectionType,
  FeedbackReport,
  FeedbackSeverity,
  FeedbackType,
  Lens,
  Merchant,
  MerchantCategory,
  NotificationPreference,
  NotificationType,
  RecommendationContext,
  RecommendationHistoryItem,
  RecommendationOutcome,
  RecommendationReceipt,
  PlaidStatus,
  PlaidSyncSummary,
  PrivacyRequest,
  Reminder,
  ReminderRecurrence,
  ReminderStatus,
  ReminderType,
  StatementCreditUsage,
  Transaction,
  UserCard,
  UserOffer,
  UserOfferStatus,
  UserProfile,
  WeeklyAuditReport,
} from "./types.js";

const defaultBaseUrl = "http://localhost:3000";
const defaultDevUserEmail = "beta@example.com";

export type ApiClientOptions = {
  baseUrl?: string;
  devUserEmail?: string;
  fetchImpl?: typeof fetch;
};

export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl =
    options.baseUrl ?? import.meta.env.VITE_API_BASE_URL ?? defaultBaseUrl;
  const devUserEmail =
    options.devUserEmail ??
    import.meta.env.VITE_DEV_USER_EMAIL ??
    defaultDevUserEmail;
  const useDevAuthHeader =
    import.meta.env.VITE_USE_DEV_AUTH_HEADER === "true" ||
    options.devUserEmail !== undefined;
  const fetchImpl = options.fetchImpl ?? fetch;

  async function request<T>(
    path: string,
    init: RequestInit & { query?: Record<string, unknown> } = {},
  ): Promise<T> {
    const url = new URL(path, baseUrl);
    for (const [key, value] of Object.entries(init.query ?? {})) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
    const headers = new Headers(init.headers);
    if (useDevAuthHeader) {
      headers.set("x-user-email", devUserEmail);
    }
    if (init.body && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    const response = await fetchImpl(url.toString(), {
      ...init,
      headers,
      credentials: init.credentials ?? "include",
    });
    if (response.status === 204) {
      return undefined as T;
    }
    const text = await response.text();
    const data = text ? (JSON.parse(text) as unknown) : undefined;
    if (!response.ok) {
      throw new ApiError(readApiError(data), response.status, data);
    }
    return data as T;
  }

  return {
    request,
    register: (body: {
      email: string;
      password: string;
      displayName?: string | undefined;
    }) =>
      request<{ user: UserProfile }>("/v1/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    login: (body: { email: string; password: string }) =>
      request<{ user: UserProfile }>("/v1/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    logout: () =>
      request<{ ok: boolean }>("/v1/auth/logout", { method: "POST" }),
    getAuthSession: () => request<{ user: UserProfile }>("/v1/auth/session"),
    requestPasswordReset: (email: string) =>
      request<{ ok: boolean; devResetToken?: string }>(
        "/v1/auth/password-reset/request",
        {
          method: "POST",
          body: JSON.stringify({ email }),
        },
      ),
    confirmPasswordReset: (body: { token: string; newPassword: string }) =>
      request<{ user: UserProfile }>("/v1/auth/password-reset/confirm", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    getAuthEvents: () => request<unknown[]>("/v1/auth/events"),
    getNotificationPreferences: () =>
      request<NotificationPreference[]>("/v1/notification-preferences"),
    updateNotificationPreferences: (
      preferences: Array<{
        channel: "EMAIL";
        notificationType: NotificationType;
        enabled: boolean;
      }>,
    ) =>
      request<NotificationPreference[]>("/v1/notification-preferences", {
        method: "PATCH",
        body: JSON.stringify({ preferences }),
      }),
    createExtensionPairingToken: () =>
      request<{ token: string; expiresAt: string }>(
        "/v1/auth/extension-token",
        {
          method: "POST",
        },
      ),
    getCurrentUser: () => request<UserProfile>("/v1/users/me"),
    updateCurrentUser: (body: { displayName?: string | undefined }) =>
      request<UserProfile>("/v1/users/me", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    listCards: (
      params: { q?: string; issuerId?: string; limit?: number } = {},
    ) => request<CardSummary[]>("/v1/cards", { query: params }),
    getCard: (id: string) => request<CardSummary>(`/v1/cards/${id}`),
    getWallet: () => request<UserCard[]>("/v1/wallet"),
    addWalletCard: (body: {
      cardId: string;
      nickname?: string;
      openedAt?: string;
      annualFeeDueMonth?: number;
      welcomeBonusDeadline?: string;
    }) =>
      request<UserCard>("/v1/wallet", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    updateWalletCard: (
      userCardId: string,
      body: {
        nickname?: string | null;
        openedAt?: string | null;
        annualFeeDueMonth?: number | null;
        welcomeBonusDeadline?: string | null;
        isActive?: boolean;
      },
    ) =>
      request<UserCard>(`/v1/wallet/${userCardId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    deleteWalletCard: (userCardId: string) =>
      request<UserCard>(`/v1/wallet/${userCardId}`, { method: "DELETE" }),
    searchMerchants: (q: string, limit = 20) =>
      request<Merchant[]>("/v1/merchants/search", { query: { q, limit } }),
    getMerchantByUrl: (url: string) =>
      request<{
        merchant: Merchant;
        matchedPattern: { id: string; pattern: string; patternType: string };
        confidence: string;
      }>("/v1/merchants/by-url", { query: { url } }),
    createRecommendation: (body: {
      merchantId?: string | undefined;
      merchantUrl?: string | undefined;
      merchantName?: string | undefined;
      purchaseAmountCents?: number | undefined;
      lens?: Lens;
      context?: RecommendationContext;
    }) =>
      request<RecommendationReceipt>("/v1/recommendations", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    getRecommendationHistory: (
      params: { limit?: number; merchantId?: string } = {},
    ) =>
      request<RecommendationHistoryItem[]>("/v1/recommendations/history", {
        query: params,
      }),
    getRecommendation: (id: string) =>
      request<RecommendationReceipt>(`/v1/recommendations/${id}`),
    submitRecommendationCorrection: (
      recommendationId: string,
      body: {
        correctionType: CorrectionType;
        userNote?: string;
        suggestedCategory?: MerchantCategory;
        suggestedCardId?: string;
        preferenceAction?:
          | "PREFER_CARD"
          | "AVOID_CARD"
          | "CUSTOM_NOTE"
          | undefined;
      },
    ) =>
      request<unknown>(`/v1/recommendations/${recommendationId}/correction`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    listCorrections: () => request<unknown[]>("/v1/corrections"),
    getCorrection: (id: string) => request<unknown>(`/v1/corrections/${id}`),
    importTransactions: (body: {
      source?: "MANUAL" | "CSV_IMPORT" | "TEST_FIXTURE";
      audit?: boolean;
      transactions: Array<{
        externalId?: string;
        rawMerchantName: string;
        amountCents: number;
        transactionDate: string;
        postedDate?: string | undefined;
        userCardId?: string | undefined;
        observedCategory?: MerchantCategory | undefined;
        observedMcc?: string | undefined;
        rawData?: object;
      }>;
    }) =>
      request<{
        imported: Array<{
          transaction: Transaction;
          status: "created" | "existing";
          outcome?: RecommendationOutcome;
        }>;
        createdCount: number;
        existingCount: number;
        auditedCount: number;
      }>("/v1/transactions/import", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    getTransactions: (params: Record<string, unknown> = {}) =>
      request<Transaction[]>("/v1/transactions", { query: params }),
    getTransaction: (id: string) =>
      request<Transaction>(`/v1/transactions/${id}`),
    auditTransaction: (id: string) =>
      request<RecommendationOutcome>(`/v1/transactions/${id}/audit`, {
        method: "POST",
      }),
    getOutcomes: (params: Record<string, unknown> = {}) =>
      request<RecommendationOutcome[]>("/v1/outcomes", { query: params }),
    getOutcome: (id: string) =>
      request<RecommendationOutcome>(`/v1/outcomes/${id}`),
    getWeeklyAudit: (params: Record<string, unknown> = {}) =>
      request<WeeklyAuditReport>("/v1/audit/weekly", { query: params }),
    getOffers: (params: Record<string, unknown> = {}) =>
      request<UserOffer[]>("/v1/offers", { query: params }),
    getOffer: (id: string) => request<UserOffer>(`/v1/offers/${id}`),
    updateOfferActivation: (
      id: string,
      body: {
        userCardId?: string | null;
        status: UserOfferStatus;
        notes?: string | null;
      },
    ) =>
      request<unknown>(`/v1/offers/${id}/activation`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    getReminders: (params: Record<string, unknown> = {}) =>
      request<Reminder[]>("/v1/reminders", { query: params }),
    createReminder: (body: {
      reminderType: ReminderType;
      title: string;
      description?: string | null;
      dueAt: string;
      recurrence?: ReminderRecurrence;
      userCardId?: string;
      statementCreditId?: string;
    }) =>
      request<Reminder>("/v1/reminders", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    updateReminder: (
      id: string,
      body: {
        title?: string;
        description?: string | null;
        dueAt?: string;
        status?: ReminderStatus;
        recurrence?: ReminderRecurrence | null;
      },
    ) =>
      request<Reminder>(`/v1/reminders/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    dismissReminder: (id: string) =>
      request<Reminder>(`/v1/reminders/${id}`, { method: "DELETE" }),
    generateDefaultReminders: (overwriteExisting = false) =>
      request<{
        createdCount: number;
        updatedCount: number;
        skippedCount: number;
        reminders: Reminder[];
      }>("/v1/reminders/generate-defaults", {
        method: "POST",
        body: JSON.stringify({ overwriteExisting }),
      }),
    getStatementCreditUsage: (params: Record<string, unknown> = {}) =>
      request<StatementCreditUsage[]>("/v1/statement-credit-usage", {
        query: params,
      }),
    generateStatementCreditUsage: (
      body: {
        userCardId?: string;
        periodStart?: string;
        periodEnd?: string;
        inferFromTransactions?: boolean;
      } = {},
    ) =>
      request<{
        generatedCount: number;
        updatedCount: number;
        usageRecords: StatementCreditUsage[];
      }>("/v1/statement-credit-usage/generate", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    updateStatementCreditUsage: (
      id: string,
      body: {
        status?: StatementCreditUsage["status"];
        amountUsedCents?: number | null;
        estimatedRemainingCents?: number | null;
        notes?: string | null;
      },
    ) =>
      request<StatementCreditUsage>(`/v1/statement-credit-usage/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    getPlaidStatus: () => request<PlaidStatus>("/v1/plaid/status"),
    createPlaidLinkToken: () =>
      request<{ linkToken: string; expiration?: string | null }>(
        "/v1/plaid/link-token",
        { method: "POST" },
      ),
    exchangePlaidPublicToken: (body: {
      publicToken: string;
      metadata?: object;
    }) =>
      request<unknown>("/v1/plaid/exchange-public-token", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    linkPlaidAccountToCard: (plaidAccountId: string, userCardId: string) =>
      request<unknown>(`/v1/plaid/accounts/${plaidAccountId}/link-card`, {
        method: "PATCH",
        body: JSON.stringify({ userCardId }),
      }),
    syncPlaidConnection: (connectionId: string, audit = true) =>
      request<PlaidSyncSummary>(`/v1/plaid/connections/${connectionId}/sync`, {
        method: "POST",
        body: JSON.stringify({ audit }),
      }),
    disconnectPlaidConnection: (
      connectionId: string,
      deleteTransactions = false,
    ) =>
      request<unknown>(`/v1/plaid/connections/${connectionId}`, {
        method: "DELETE",
        body: JSON.stringify({ deleteTransactions }),
      }),
    getConsents: () => request<ConsentRecord[]>("/v1/consents"),
    createConsent: (body: { consentType: ConsentType; version: string }) =>
      request<ConsentRecord>("/v1/consents", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    revokeConsent: (id: string) =>
      request<ConsentRecord>(`/v1/consents/${id}/revoke`, {
        method: "PATCH",
      }),
    getPrivacyRequests: () => request<PrivacyRequest[]>("/v1/privacy/requests"),
    deletePlaidData: () =>
      request<PrivacyRequest>("/v1/privacy/plaid-data", {
        method: "DELETE",
        body: JSON.stringify({ confirmation: "DELETE_PLAID_DATA" }),
      }),
    deleteTransactions: (
      source: "PLAID" | "MANUAL" | "CSV_IMPORT" | "TEST_FIXTURE" | "ALL",
    ) =>
      request<PrivacyRequest>("/v1/privacy/transactions", {
        method: "DELETE",
        body: JSON.stringify({ confirmation: "DELETE_TRANSACTIONS", source }),
      }),
    deleteAccount: () =>
      request<PrivacyRequest>("/v1/privacy/account", {
        method: "DELETE",
        body: JSON.stringify({ confirmation: "DELETE_MY_ACCOUNT" }),
      }),
    getBillingStatus: () => request<BillingStatus>("/v1/billing/status"),
    createCheckoutSession: (interval: "ANNUAL" | "MONTHLY") =>
      request<{ url: string; sessionId: string }>(
        "/v1/billing/create-checkout-session",
        {
          method: "POST",
          body: JSON.stringify({ interval }),
        },
      ),
    createBillingPortalSession: () =>
      request<{ url: string }>("/v1/billing/create-portal-session", {
        method: "POST",
      }),
    submitFeedback: (body: {
      feedbackType: FeedbackType;
      severity?: FeedbackSeverity;
      title: string;
      message: string;
      pageUrl?: string;
      context?: Record<string, unknown>;
      linkedRecommendationEventId?: string;
      linkedTransactionId?: string;
      linkedOutcomeId?: string;
    }) =>
      request<FeedbackReport>("/v1/feedback", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    getFeedbackReports: (params: Record<string, unknown> = {}) =>
      request<FeedbackReport[]>("/v1/feedback", { query: params }),
    getFeedbackReport: (id: string) =>
      request<FeedbackReport>(`/v1/feedback/${id}`),
  };
}

export const apiClient = createApiClient();

function readApiError(data: unknown): string {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const nestedError = record.error;
    if (nestedError && typeof nestedError === "object") {
      const nestedRecord = nestedError as Record<string, unknown>;
      if (typeof nestedRecord.message === "string") {
        return nestedRecord.message;
      }
    }
    if (typeof record.message === "string") {
      return record.message;
    }
    if (typeof record.error === "string") {
      return record.error;
    }
  }
  return "The API request failed.";
}
