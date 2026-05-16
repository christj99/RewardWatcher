export const API_BASE_URL =
  process.env.SMOKE_API_BASE_URL ?? "http://127.0.0.1:3000";

export class SmokeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SmokeError";
  }
}

export class SmokeClient {
  private cookie: string | undefined;

  constructor(
    readonly baseUrl = API_BASE_URL,
    private readonly label = "smoke",
  ) {}

  async request<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      query?: Record<string, string | number | boolean | null | undefined>;
      headers?: Record<string, string>;
      expected?: number | number[];
    } = {},
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = { ...options.headers };
    if (options.body !== undefined) {
      headers["content-type"] = "application/json";
    }
    if (this.cookie) {
      headers.cookie = this.cookie;
    }

    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      this.cookie = setCookie.split(";")[0];
    }

    const expected = Array.isArray(options.expected)
      ? options.expected
      : [options.expected ?? 200];
    const text = await response.text();
    const payload = text ? safeJson(text) : undefined;

    if (!expected.includes(response.status)) {
      throw new SmokeError(
        `[${this.label}] ${options.method ?? "GET"} ${url.pathname} expected ${expected.join(
          "/",
        )}, got ${response.status}: ${text}`,
      );
    }

    return payload as T;
  }

  async login(email: string, password: string) {
    return this.request<{
      user: { id: string; email: string; isAdmin?: boolean };
    }>("/v1/auth/login", { method: "POST", body: { email, password } });
  }

  async logout() {
    await this.request("/v1/auth/logout", { method: "POST" });
    this.cookie = undefined;
  }
}

export function assertSmoke(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new SmokeError(message);
  }
}

export function logStep(message: string) {
  console.log(`✓ ${message}`);
}

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
}

export function isoDate(offsetDays = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString();
}

export function extractArray<T = unknown>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const object = value as {
      items?: unknown;
      data?: unknown;
      connections?: unknown;
    };
    if (Array.isArray(object.items)) return object.items as T[];
    if (Array.isArray(object.data)) return object.data as T[];
    if (Array.isArray(object.connections)) return object.connections as T[];
  }
  return [];
}

export async function ensureWalletCard(client: SmokeClient) {
  const wallet = await client.request<unknown>("/v1/wallet");
  const existing = extractArray<{
    id: string;
    cardId?: string;
    card?: { id: string };
  }>(wallet);
  const active = existing.find((card) => card.id);
  if (active) return active;

  const preferredCards = await client.request<
    Array<{ id: string; name: string }>
  >("/v1/cards", {
    query: { q: "Freedom Unlimited", limit: 5 },
  });
  const cards = preferredCards.length
    ? preferredCards
    : await client.request<Array<{ id: string; name: string }>>("/v1/cards", {
        query: { limit: 5 },
      });
  assertSmoke(cards.length > 0, "Seeded cards are required for smoke tests.");
  return client.request<{ id: string; cardId?: string }>("/v1/wallet", {
    method: "POST",
    expected: [200, 201],
    body: {
      cardId: cards[0].id,
      nickname: "Smoke wallet card",
      openedAt: isoDate(-30),
      annualFeeDueMonth: 5,
      welcomeBonusDeadline: isoDate(30),
    },
  });
}

export async function createSmokeRecommendation(client: SmokeClient) {
  const merchantLookup = await client.request<unknown>("/v1/merchants/search", {
    query: { q: "Target", limit: 5 },
  });
  const merchants = extractArray<{ id: string; name: string }>(merchantLookup);
  const merchantId = merchants[0]?.id;
  const receipt = await client.request<{ id: string }>("/v1/recommendations", {
    method: "POST",
    expected: [200, 201],
    body: {
      ...(merchantId ? { merchantId } : { merchantName: "Target" }),
      purchaseAmountCents: 2295,
      lens: "PRACTICAL",
      context: "MANUAL_LOOKUP",
    },
  });
  assertSmoke(receipt.id, "Recommendation receipt did not include an id.");
  return receipt;
}

export async function importSmokeTransaction(
  client: SmokeClient,
  userCardId?: string,
  audit = true,
) {
  const response = await client.request<{
    transactions?: Array<{ id: string }>;
    imported?: Array<{ id?: string; transaction?: { id: string } }>;
  }>("/v1/transactions/import", {
    method: "POST",
    expected: [200, 201],
    body: {
      audit,
      source: "TEST_FIXTURE",
      transactions: [
        {
          rawMerchantName: "Target",
          amountCents: 2295,
          transactionDate: isoDate(-1),
          externalId: `smoke-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          userCardId,
          observedCategory: "GENERAL",
        },
      ],
    },
  });
  const imported = response.imported?.[0];
  const transaction =
    response.transactions?.[0] ?? imported?.transaction ?? imported;
  assertSmoke(
    transaction?.id,
    "Transaction import did not return a transaction id.",
  );
  return transaction;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
