import { AdminApiError } from "./errors";

const DEFAULT_API_BASE_URL = "http://localhost:3000";
const DEFAULT_ADMIN_EMAIL = "admin@example.com";

export type RequestBody = Record<string, unknown> | undefined;

export class AdminApiClient {
  constructor(
    private readonly baseUrl = import.meta.env.VITE_API_BASE_URL ||
      DEFAULT_API_BASE_URL,
    private readonly adminEmail = import.meta.env.VITE_ADMIN_USER_EMAIL ||
      DEFAULT_ADMIN_EMAIL,
    private readonly useDevAuthHeader = import.meta.env
      .VITE_USE_DEV_AUTH_HEADER === "true",
  ) {}

  async request<T>(
    path: string,
    options: {
      method?: string | undefined;
      body?: RequestBody | undefined;
      query?:
        | Record<string, string | number | boolean | null | undefined>
        | undefined;
    } = {},
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }

    const init: RequestInit = {
      method: options.method ?? "GET",
      headers: {
        "content-type": "application/json",
      },
      credentials: "include",
    };
    if (this.useDevAuthHeader) {
      (init.headers as Record<string, string>)["x-user-email"] =
        this.adminEmail;
    }
    if (options.body) {
      init.body = JSON.stringify(options.body);
    }

    const response = await fetch(url.toString(), init);

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    const payload = text ? safeJson(text) : undefined;

    if (!response.ok) {
      const errorPayload = payload as
        | { error?: { message?: string; code?: string; details?: unknown } }
        | undefined;
      const message =
        errorPayload?.error?.message ??
        (response.status === 403
          ? "Admin access required."
          : "The admin API request failed.");
      throw new AdminApiError(
        message,
        response.status,
        errorPayload?.error?.code,
        errorPayload?.error?.details,
      );
    }

    return payload as T;
  }

  getOpenReviewWork = () =>
    this.request("/v1/admin/dashboard/open-review-work");
  getAuthSession = () =>
    this.request<{ user: { isAdmin: boolean } }>("/v1/auth/session");
  login = (body: { email: string; password: string }) =>
    this.request<{ user: { isAdmin: boolean } }>("/v1/auth/login", {
      method: "POST",
      body,
    });
  logout = () =>
    this.request<{ ok: boolean }>("/v1/auth/logout", { method: "POST" });
  getRuleFreshness = (query?: Record<string, unknown>) =>
    this.request("/v1/admin/dashboard/rule-freshness", {
      query: cleanQuery(query),
    });
  getRecommendationErrors = (query?: Record<string, unknown>) =>
    this.request("/v1/admin/dashboard/recommendation-errors", {
      query: cleanQuery(query),
    });
  getKillTest = (query?: Record<string, unknown>) =>
    this.request("/v1/admin/evals/kill-test", { query: cleanQuery(query) });
  getAdminAuditLogs = (query?: Record<string, unknown>) =>
    this.request("/v1/admin/audit-logs", { query: cleanQuery(query) });
  getAdminEmailLogs = (query?: Record<string, unknown>) =>
    this.request("/v1/admin/email-logs", { query: cleanQuery(query) });
  getJobStatus = () => this.request("/v1/admin/jobs/status");
  getJobRuns = (query?: Record<string, unknown>) =>
    this.request("/v1/admin/jobs/runs", { query: cleanQuery(query) });
  runJob = (body: RequestBody) =>
    this.request("/v1/admin/jobs/run", { method: "POST", body });
  getOpsSummary = () => this.request("/v1/admin/ops/summary");
  getDiagnostics = () => this.request("/v1/admin/diagnostics");
  getBetaReadiness = () => this.request("/v1/admin/beta-readiness");
  listAdminFeedback = (query?: Record<string, unknown>) =>
    this.request("/v1/admin/feedback", { query: cleanQuery(query) });
  getAdminFeedback = (id: string) => this.request(`/v1/admin/feedback/${id}`);
  updateAdminFeedback = (id: string, body: RequestBody) =>
    this.request(`/v1/admin/feedback/${id}`, { method: "PATCH", body });
  listBetaUsers = (query?: Record<string, unknown>) =>
    this.request("/v1/admin/beta-users", { query: cleanQuery(query) });
  updateBetaUser = (userId: string, body: RequestBody) =>
    this.request(`/v1/admin/beta-users/${userId}`, { method: "PATCH", body });
  listBetaCohorts = () => this.request("/v1/admin/beta-cohorts");
  createBetaCohort = (body: RequestBody) =>
    this.request("/v1/admin/beta-cohorts", { method: "POST", body });
  updateBetaCohort = (id: string, body: RequestBody) =>
    this.request(`/v1/admin/beta-cohorts/${id}`, { method: "PATCH", body });
  listSupportNotes = (userId: string) =>
    this.request(`/v1/admin/users/${userId}/support-notes`);
  createSupportNote = (userId: string, body: RequestBody) =>
    this.request(`/v1/admin/users/${userId}/support-notes`, {
      method: "POST",
      body,
    });
  listBillingUsers = (query?: Record<string, unknown>) =>
    this.request("/v1/admin/billing/users", { query: cleanQuery(query) });
  grantEntitlement = (body: RequestBody) =>
    this.request("/v1/admin/entitlements/grant", { method: "POST", body });
  updateEntitlementGrant = (id: string, body: RequestBody) =>
    this.request(`/v1/admin/entitlements/${id}`, { method: "PATCH", body });

  listReviewTasks = (query?: Record<string, unknown>) =>
    this.request("/v1/admin/review-tasks", { query: cleanQuery(query) });
  getReviewTask = (id: string) => this.request(`/v1/admin/review-tasks/${id}`);
  updateReviewTask = (id: string, body: RequestBody) =>
    this.request(`/v1/admin/review-tasks/${id}`, { method: "PATCH", body });
  listCorrections = (query?: Record<string, unknown>) =>
    this.request("/v1/admin/corrections", { query: cleanQuery(query) });
  updateCorrection = (id: string, body: RequestBody) =>
    this.request(`/v1/admin/corrections/${id}`, { method: "PATCH", body });

  listIssuers = (query?: Record<string, unknown>) =>
    this.request("/v1/admin/issuers", { query: cleanQuery(query) });
  createIssuer = (body: RequestBody) =>
    this.request("/v1/admin/issuers", { method: "POST", body });
  updateIssuer = (id: string, body: RequestBody) =>
    this.request(`/v1/admin/issuers/${id}`, { method: "PATCH", body });

  listCards = (query?: Record<string, unknown>) =>
    this.request("/v1/admin/cards", { query: cleanQuery(query) });
  getCard = (id: string) => this.request(`/v1/admin/cards/${id}`);
  createCard = (body: RequestBody) =>
    this.request("/v1/admin/cards", { method: "POST", body });
  updateCard = (id: string, body: RequestBody) =>
    this.request(`/v1/admin/cards/${id}`, { method: "PATCH", body });
  listCardVersions = (cardId: string) =>
    this.request(`/v1/admin/cards/${cardId}/versions`);
  createCardVersion = (cardId: string, body: RequestBody) =>
    this.request(`/v1/admin/cards/${cardId}/versions`, {
      method: "POST",
      body,
    });
  updateCardVersion = (id: string, body: RequestBody) =>
    this.request(`/v1/admin/card-versions/${id}`, { method: "PATCH", body });

  listRuleSources = (query?: Record<string, unknown>) =>
    this.request("/v1/admin/rule-sources", { query: cleanQuery(query) });
  createRuleSource = (body: RequestBody) =>
    this.request("/v1/admin/rule-sources", { method: "POST", body });
  updateRuleSource = (id: string, body: RequestBody) =>
    this.request(`/v1/admin/rule-sources/${id}`, { method: "PATCH", body });

  listCurrencies = () => this.request("/v1/admin/currencies");
  createCurrency = (body: RequestBody) =>
    this.request("/v1/admin/currencies", { method: "POST", body });
  updateCurrency = (id: string, body: RequestBody) =>
    this.request(`/v1/admin/currencies/${id}`, { method: "PATCH", body });
  listCurrencyValuations = (currencyId: string) =>
    this.request(`/v1/admin/currencies/${currencyId}/valuations`);
  createCurrencyValuation = (currencyId: string, body: RequestBody) =>
    this.request(`/v1/admin/currencies/${currencyId}/valuations`, {
      method: "POST",
      body,
    });
  updateCurrencyValuation = (id: string, body: RequestBody) =>
    this.request(`/v1/admin/currency-valuations/${id}`, {
      method: "PATCH",
      body,
    });

  listEarningRules = (query?: Record<string, unknown>) =>
    this.request("/v1/admin/earning-rules", { query: cleanQuery(query) });
  getEarningRule = (id: string) =>
    this.request(`/v1/admin/earning-rules/${id}`);
  createEarningRule = (body: RequestBody) =>
    this.request("/v1/admin/earning-rules", { method: "POST", body });
  updateEarningRule = (id: string, body: RequestBody) =>
    this.request(`/v1/admin/earning-rules/${id}`, { method: "PATCH", body });
  retireEarningRule = (id: string, body: RequestBody) =>
    this.request(`/v1/admin/earning-rules/${id}/retire`, {
      method: "POST",
      body,
    });

  listBenefits = (query?: Record<string, unknown>) =>
    this.request("/v1/admin/benefits", { query: cleanQuery(query) });
  createBenefit = (body: RequestBody) =>
    this.request("/v1/admin/benefits", { method: "POST", body });
  updateBenefit = (id: string, body: RequestBody) =>
    this.request(`/v1/admin/benefits/${id}`, { method: "PATCH", body });
  listStatementCredits = (query?: Record<string, unknown>) =>
    this.request("/v1/admin/statement-credits", { query: cleanQuery(query) });
  createStatementCredit = (body: RequestBody) =>
    this.request("/v1/admin/statement-credits", { method: "POST", body });
  updateStatementCredit = (id: string, body: RequestBody) =>
    this.request(`/v1/admin/statement-credits/${id}`, {
      method: "PATCH",
      body,
    });

  listMerchants = (query?: Record<string, unknown>) =>
    this.request("/v1/admin/merchants", { query: cleanQuery(query) });
  getMerchant = (id: string) => this.request(`/v1/admin/merchants/${id}`);
  createMerchant = (body: RequestBody) =>
    this.request("/v1/admin/merchants", { method: "POST", body });
  updateMerchant = (id: string, body: RequestBody) =>
    this.request(`/v1/admin/merchants/${id}`, { method: "PATCH", body });
  createMerchantUrlPattern = (merchantId: string, body: RequestBody) =>
    this.request(`/v1/admin/merchants/${merchantId}/url-patterns`, {
      method: "POST",
      body,
    });
  updateMerchantUrlPattern = (id: string, body: RequestBody) =>
    this.request(`/v1/admin/merchant-url-patterns/${id}`, {
      method: "PATCH",
      body,
    });
  deleteMerchantUrlPattern = (id: string) =>
    this.request(`/v1/admin/merchant-url-patterns/${id}`, { method: "DELETE" });
  listMerchantPostingProfiles = (query?: Record<string, unknown>) =>
    this.request("/v1/admin/merchant-posting-profiles", {
      query: cleanQuery(query),
    });
  createMerchantPostingProfile = (body: RequestBody) =>
    this.request("/v1/admin/merchant-posting-profiles", {
      method: "POST",
      body,
    });
  updateMerchantPostingProfile = (id: string, body: RequestBody) =>
    this.request(`/v1/admin/merchant-posting-profiles/${id}`, {
      method: "PATCH",
      body,
    });

  listOffers = (query?: Record<string, unknown>) =>
    this.request("/v1/admin/offers", { query: cleanQuery(query) });
  getOffer = (id: string) => this.request(`/v1/admin/offers/${id}`);
  createOffer = (body: RequestBody) =>
    this.request("/v1/admin/offers", { method: "POST", body });
  updateOffer = (id: string, body: RequestBody) =>
    this.request(`/v1/admin/offers/${id}`, { method: "PATCH", body });
  expireOffer = (id: string, body: RequestBody = {}) =>
    this.request(`/v1/admin/offers/${id}/expire`, { method: "POST", body });
}

export const adminApi = new AdminApiClient();

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function cleanQuery(
  query?: Record<string, unknown>,
): Record<string, string | number | boolean | null | undefined> | undefined {
  return query as Record<string, string | number | boolean | null | undefined>;
}
