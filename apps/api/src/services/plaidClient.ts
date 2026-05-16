import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import type { CountryCode, Products } from "plaid";

import { env } from "../config/env.js";
import { badRequest } from "../lib/httpErrors.js";

export type PlaidAccountDto = {
  account_id: string;
  name: string;
  official_name?: string | null | undefined;
  mask?: string | null | undefined;
  type?: string | null | undefined;
  subtype?: string | null | undefined;
};

export type PlaidTransactionDto = {
  transaction_id: string;
  account_id: string;
  name: string;
  merchant_name?: string | null | undefined;
  amount: number;
  iso_currency_code?: string | null | undefined;
  date: string;
  authorized_date?: string | null | undefined;
  pending?: boolean | null | undefined;
  category?: string[] | null | undefined;
  payment_channel?: string | null | undefined;
  personal_finance_category?:
    | {
        primary?: string | null | undefined;
        detailed?: string | null | undefined;
      }
    | null
    | undefined;
};

export type PlaidRemovedTransactionDto = {
  transaction_id: string;
};

export type CreateLinkTokenResult = {
  link_token: string;
  expiration?: string | null;
};

export type ExchangePublicTokenResult = {
  access_token: string;
  item_id: string;
};

export type SyncTransactionsResult = {
  added: PlaidTransactionDto[];
  modified: PlaidTransactionDto[];
  removed: PlaidRemovedTransactionDto[];
  next_cursor?: string | null;
  accounts?: PlaidAccountDto[];
};

export type PlaidClient = {
  createLinkToken: (input: {
    userId: string;
    clientUserId: string;
  }) => Promise<CreateLinkTokenResult>;
  exchangePublicToken: (
    publicToken: string,
  ) => Promise<ExchangePublicTokenResult>;
  getAccounts: (accessToken: string) => Promise<PlaidAccountDto[]>;
  syncTransactions: (
    accessToken: string,
    cursor?: string | null,
  ) => Promise<SyncTransactionsResult>;
  removeItem: (accessToken: string) => Promise<void>;
};

let testPlaidClient: PlaidClient | null = null;

export function setPlaidClientForTesting(client: PlaidClient | null): void {
  testPlaidClient = client;
}

export function getPlaidClient(): PlaidClient {
  return testPlaidClient ?? createSdkPlaidClient();
}

export function assertPlaidConfigured(): void {
  if (!env.PLAID_CLIENT_ID || !env.PLAID_SECRET) {
    throw badRequest("Plaid is not configured for this environment.");
  }
}

function createSdkPlaidClient(): PlaidClient {
  assertPlaidConfigured();
  const clientId = env.PLAID_CLIENT_ID;
  const secret = env.PLAID_SECRET;
  const basePath = PlaidEnvironments[env.PLAID_ENV];

  if (!clientId || !secret || !basePath) {
    throw badRequest("Plaid is not configured for this environment.");
  }

  const plaid = new PlaidApi(
    new Configuration({
      basePath,
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": clientId,
          "PLAID-SECRET": secret,
        },
      },
    }),
  );

  return {
    async createLinkToken(input) {
      const response = await plaid.linkTokenCreate({
        user: { client_user_id: input.clientUserId },
        client_name: "Rewards Audit",
        products: env.PLAID_PRODUCTS.split(",").map(
          (product) => product.trim() as Products,
        ),
        country_codes: env.PLAID_COUNTRY_CODES.split(",").map(
          (countryCode) => countryCode.trim() as CountryCode,
        ),
        language: "en",
        ...(env.PLAID_REDIRECT_URI
          ? { redirect_uri: env.PLAID_REDIRECT_URI }
          : {}),
        ...(env.PLAID_WEBHOOK_URL ? { webhook: env.PLAID_WEBHOOK_URL } : {}),
      });

      return {
        link_token: response.data.link_token,
        expiration: response.data.expiration,
      };
    },
    async exchangePublicToken(publicToken) {
      const response = await plaid.itemPublicTokenExchange({
        public_token: publicToken,
      });

      return {
        access_token: response.data.access_token,
        item_id: response.data.item_id,
      };
    },
    async getAccounts(accessToken) {
      const response = await plaid.accountsGet({ access_token: accessToken });

      return response.data.accounts.map((account) => ({
        account_id: account.account_id,
        name: account.name,
        official_name: account.official_name,
        mask: account.mask,
        type: account.type,
        subtype: account.subtype,
      }));
    },
    async syncTransactions(accessToken, cursor) {
      const response = await plaid.transactionsSync({
        access_token: accessToken,
        ...(cursor ? { cursor } : {}),
      });

      return {
        added: response.data.added.map(toTransactionDto),
        modified: response.data.modified.map(toTransactionDto),
        removed: response.data.removed,
        next_cursor: response.data.next_cursor,
        accounts: response.data.accounts?.map((account) => ({
          account_id: account.account_id,
          name: account.name,
          official_name: account.official_name,
          mask: account.mask,
          type: account.type,
          subtype: account.subtype,
        })),
      };
    },
    async removeItem(accessToken) {
      await plaid.itemRemove({ access_token: accessToken });
    },
  };
}

function toTransactionDto(transaction: {
  transaction_id: string;
  account_id: string;
  name: string;
  merchant_name?: string | null;
  amount: number;
  iso_currency_code?: string | null;
  date: string;
  authorized_date?: string | null;
  pending?: boolean | null;
  category?: string[] | null;
  payment_channel?: string | null;
  personal_finance_category?: {
    primary?: string | null;
    detailed?: string | null;
  } | null;
}): PlaidTransactionDto {
  return {
    transaction_id: transaction.transaction_id,
    account_id: transaction.account_id,
    name: transaction.name,
    merchant_name: transaction.merchant_name,
    amount: transaction.amount,
    iso_currency_code: transaction.iso_currency_code,
    date: transaction.date,
    authorized_date: transaction.authorized_date,
    pending: transaction.pending,
    category: transaction.category,
    payment_channel: transaction.payment_channel,
    personal_finance_category: transaction.personal_finance_category,
  };
}
