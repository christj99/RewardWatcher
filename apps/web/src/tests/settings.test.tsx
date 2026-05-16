import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "../api/client.js";
import { SettingsPage } from "../pages/SettingsPage.js";

vi.mock("../api/client.js", () => ({
  apiClient: {
    getCurrentUser: vi.fn(),
    updateCurrentUser: vi.fn(),
    getPlaidStatus: vi.fn(),
    getWallet: vi.fn(),
    linkPlaidAccountToCard: vi.fn(),
    syncPlaidConnection: vi.fn(),
    disconnectPlaidConnection: vi.fn(),
    createPlaidLinkToken: vi.fn(),
    exchangePlaidPublicToken: vi.fn(),
    getConsents: vi.fn(),
    getNotificationPreferences: vi.fn(),
    updateNotificationPreferences: vi.fn(),
    getAuthEvents: vi.fn(),
    getBillingStatus: vi.fn(),
    createExtensionPairingToken: vi.fn(),
    createConsent: vi.fn(),
    revokeConsent: vi.fn(),
    deletePlaidData: vi.fn(),
    deleteTransactions: vi.fn(),
    deleteAccount: vi.fn(),
  },
}));

const mockedApi = vi.mocked(apiClient);

describe("settings Plaid private beta panel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.getCurrentUser.mockResolvedValue({
      id: "user-1",
      email: "beta@example.com",
      displayName: "Beta User",
      isAdmin: false,
      plaidBetaEnabled: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    mockedApi.getWallet.mockResolvedValue([
      {
        id: "user-card-1",
        cardId: "card-1",
        isActive: true,
        card: {
          id: "card-1",
          name: "Chase Freedom Unlimited",
          slug: "chase-freedom-unlimited",
        },
      },
    ]);
    mockedApi.getConsents.mockResolvedValue([
      {
        id: "consent-1",
        consentType: "PLAID_TRANSACTIONS",
        version: "test-v1",
        grantedAt: "2026-01-01T00:00:00.000Z",
        revokedAt: null,
      },
    ]);
    mockedApi.getNotificationPreferences.mockResolvedValue([
      {
        id: "pref-1",
        userId: "user-1",
        channel: "EMAIL",
        notificationType: "WEEKLY_AUDIT",
        enabled: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "pref-2",
        userId: "user-1",
        channel: "EMAIL",
        notificationType: "REMINDER_DIGEST",
        enabled: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    mockedApi.updateNotificationPreferences.mockResolvedValue([]);
    mockedApi.getAuthEvents.mockResolvedValue([]);
    mockedApi.getBillingStatus.mockResolvedValue({
      stripeCustomerId: null,
      subscription: null,
      plan: "BETA_GRANT",
      entitlements: {
        BASIC_RECOMMENDATIONS: true,
        FULL_TRANSACTION_AUDIT: true,
        WEEKLY_AUDIT_REPORT: true,
        STATEMENT_CREDIT_TRACKING: true,
        OFFER_AWARE_RECOMMENDATIONS: true,
        ADVANCED_LENSES: true,
        PLAID_SYNC: true,
        EXTENDED_HISTORY: true,
      },
      checkoutAvailable: false,
      portalAvailable: false,
    });
    mockedApi.createExtensionPairingToken.mockResolvedValue({
      token: "pair-token",
      expiresAt: "2026-01-01T00:10:00.000Z",
    });
    mockedApi.createConsent.mockResolvedValue({
      id: "consent-2",
      consentType: "PLAID_TRANSACTIONS",
      version: "private-beta-v1",
      grantedAt: "2026-01-02T00:00:00.000Z",
      revokedAt: null,
    });
    mockedApi.revokeConsent.mockResolvedValue({
      id: "consent-1",
      consentType: "PLAID_TRANSACTIONS",
      version: "test-v1",
      grantedAt: "2026-01-01T00:00:00.000Z",
      revokedAt: "2026-01-03T00:00:00.000Z",
    });
    mockedApi.deletePlaidData.mockResolvedValue({} as never);
    mockedApi.deleteTransactions.mockResolvedValue({} as never);
    mockedApi.deleteAccount.mockResolvedValue({} as never);
  });

  it("shows beta disabled state", async () => {
    mockedApi.getPlaidStatus.mockResolvedValue({
      betaEnabled: false,
      connections: [],
    });

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(
        "Plaid private beta is not enabled for this account.",
      ),
    ).toBeInTheDocument();
  });

  it("lists connections and links accounts to wallet cards", async () => {
    mockedApi.getPlaidStatus.mockResolvedValue({
      betaEnabled: true,
      connections: [
        {
          id: "connection-1",
          institutionName: "Sandbox Bank",
          status: "ACTIVE",
          lastSyncedAt: null,
          accounts: [
            {
              id: "plaid-account-1",
              name: "Sandbox Visa",
              mask: "1234",
              linkedUserCard: null,
            },
          ],
        },
      ],
    });
    mockedApi.linkPlaidAccountToCard.mockResolvedValue({});

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    const select = await screen.findByLabelText(/Sandbox Visa/);
    fireEvent.change(select, { target: { value: "user-card-1" } });

    await waitFor(() => {
      expect(mockedApi.linkPlaidAccountToCard).toHaveBeenCalledWith(
        "plaid-account-1",
        "user-card-1",
      );
    });
  });

  it("sync button calls the Plaid API and shows the result", async () => {
    mockedApi.getPlaidStatus.mockResolvedValue({
      betaEnabled: true,
      connections: [
        {
          id: "connection-1",
          institutionName: "Sandbox Bank",
          status: "ACTIVE",
          lastSyncedAt: null,
          accounts: [],
        },
      ],
    });
    mockedApi.syncPlaidConnection.mockResolvedValue({
      syncRunId: "sync-1",
      addedCount: 1,
      modifiedCount: 0,
      removedCount: 0,
      importedTransactionCount: 1,
      auditedTransactionCount: 1,
      status: "SUCCEEDED",
    });

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByText("Sync and audit"));

    expect(mockedApi.syncPlaidConnection).toHaveBeenCalledWith(
      "connection-1",
      true,
    );
    expect(
      await screen.findByText("Sync complete: 1 transaction(s), 1 audited."),
    ).toBeInTheDocument();
  });

  it("manages consents and privacy deletion controls", async () => {
    mockedApi.getPlaidStatus.mockResolvedValue({
      betaEnabled: true,
      connections: [],
    });

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("PLAID TRANSACTIONS")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Agree to Plaid transaction audit beta"));
    await waitFor(() => expect(mockedApi.createConsent).toHaveBeenCalled());

    fireEvent.click(screen.getByText("Revoke consent"));
    await waitFor(() =>
      expect(mockedApi.revokeConsent).toHaveBeenCalledWith("consent-1"),
    );

    fireEvent.click(screen.getByText("Delete Plaid data"));
    await waitFor(() => expect(mockedApi.deletePlaidData).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText("Account deletion confirmation"), {
      target: { value: "DELETE_MY_ACCOUNT" },
    });
    fireEvent.click(screen.getByText("Delete account"));
    await waitFor(() => expect(mockedApi.deleteAccount).toHaveBeenCalled());
  });

  it("toggles notification preferences", async () => {
    mockedApi.getPlaidStatus.mockResolvedValue({
      betaEnabled: true,
      connections: [],
    });
    mockedApi.updateNotificationPreferences.mockResolvedValue([
      {
        id: "pref-1",
        userId: "user-1",
        channel: "EMAIL",
        notificationType: "WEEKLY_AUDIT",
        enabled: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ]);

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    const weekly = await screen.findByLabelText("weekly audit");
    fireEvent.click(weekly);

    await waitFor(() =>
      expect(mockedApi.updateNotificationPreferences).toHaveBeenCalledWith([
        {
          channel: "EMAIL",
          notificationType: "WEEKLY_AUDIT",
          enabled: false,
        },
      ]),
    );
  });
});
