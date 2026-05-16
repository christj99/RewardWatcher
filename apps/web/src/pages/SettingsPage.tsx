import { useEffect, useState, type FormEvent } from "react";

import { apiClient } from "../api/client.js";
import { errorMessage } from "../api/errors.js";
import { ErrorState } from "../components/ErrorState.js";
import { LoadingState } from "../components/LoadingState.js";
import { PageHeader } from "../components/PageHeader.js";
import { useCurrentUser } from "../hooks/useCurrentUser.js";
import type {
  BillingStatus,
  ConsentRecord,
  NotificationPreference,
  NotificationType,
  PlaidStatus,
  UserCard,
} from "../api/types.js";

export function SettingsPage() {
  const user = useCurrentUser();
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [plaidStatus, setPlaidStatus] = useState<PlaidStatus | null>(null);
  const [wallet, setWallet] = useState<UserCard[]>([]);
  const [plaidError, setPlaidError] = useState<string | null>(null);
  const [plaidMessage, setPlaidMessage] = useState<string | null>(null);
  const [publicToken, setPublicToken] = useState("");
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(
    null,
  );
  const [billingMessage, setBillingMessage] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [privacyMessage, setPrivacyMessage] = useState<string | null>(null);
  const [privacyError, setPrivacyError] = useState<string | null>(null);
  const [accountDeleteText, setAccountDeleteText] = useState("");
  const [authEvents, setAuthEvents] = useState<unknown[]>([]);
  const [extensionToken, setExtensionToken] = useState<string | null>(null);
  const [notificationPreferences, setNotificationPreferences] = useState<
    NotificationPreference[]
  >([]);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(
    null,
  );
  const [notificationError, setNotificationError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    void loadPlaid();
  }, []);

  if (user.isLoading) return <LoadingState label="Loading settings" />;
  if (user.error || !user.data) {
    return (
      <ErrorState
        message={user.error ?? "Could not load settings."}
        onRetry={user.reload}
      />
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const nextDisplayName = displayName.trim() || user.data?.displayName;
      await apiClient.updateCurrentUser(
        nextDisplayName ? { displayName: nextDisplayName } : {},
      );
      setMessage("Profile updated.");
      user.reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function loadPlaid() {
    setPlaidError(null);
    try {
      const [status, walletCards] = await Promise.all([
        apiClient.getPlaidStatus(),
        apiClient.getWallet(),
      ]);
      setPlaidStatus(status);
      setWallet(walletCards);
      const nextConsents = await apiClient.getConsents();
      setConsents(nextConsents);
      if (typeof apiClient.getBillingStatus === "function") {
        setBillingStatus(await apiClient.getBillingStatus());
      }
      setAuthEvents(await apiClient.getAuthEvents());
      setNotificationPreferences(await apiClient.getNotificationPreferences());
    } catch (err) {
      setPlaidError(errorMessage(err));
    }
  }

  async function createLinkToken() {
    setPlaidError(null);
    setPlaidMessage(null);
    try {
      const created = await apiClient.createPlaidLinkToken();
      setLinkToken(created.linkToken);
      setPlaidMessage("Link token created for private beta testing.");
    } catch (err) {
      setPlaidError(errorMessage(err));
    }
  }

  async function startCheckout(interval: "ANNUAL" | "MONTHLY") {
    setBillingError(null);
    setBillingMessage(null);
    try {
      const session = await apiClient.createCheckoutSession(interval);
      window.location.assign(session.url);
    } catch (err) {
      setBillingError(errorMessage(err));
    }
  }

  async function openBillingPortal() {
    setBillingError(null);
    setBillingMessage(null);
    try {
      const session = await apiClient.createBillingPortalSession();
      window.location.assign(session.url);
    } catch (err) {
      setBillingError(errorMessage(err));
    }
  }

  async function grantPlaidConsent() {
    setPlaidError(null);
    setPlaidMessage(null);
    try {
      await apiClient.createConsent({
        consentType: "PLAID_TRANSACTIONS",
        version: "private-beta-v1",
      });
      setPlaidMessage("Plaid transaction audit beta consent saved.");
      setConsents(await apiClient.getConsents());
    } catch (err) {
      setPlaidError(errorMessage(err));
    }
  }

  async function revokeConsent(consentId: string) {
    setPlaidError(null);
    setPlaidMessage(null);
    try {
      await apiClient.revokeConsent(consentId);
      setPlaidMessage("Consent revoked.");
      setConsents(await apiClient.getConsents());
    } catch (err) {
      setPlaidError(errorMessage(err));
    }
  }

  async function deletePlaidData() {
    setPrivacyError(null);
    setPrivacyMessage(null);
    try {
      await apiClient.deletePlaidData();
      setPrivacyMessage("Plaid data deletion completed.");
      await loadPlaid();
    } catch (err) {
      setPrivacyError(errorMessage(err));
    }
  }

  async function deletePlaidTransactions() {
    setPrivacyError(null);
    setPrivacyMessage(null);
    try {
      await apiClient.deleteTransactions("PLAID");
      setPrivacyMessage("Plaid transaction data deleted.");
    } catch (err) {
      setPrivacyError(errorMessage(err));
    }
  }

  async function deleteAccount() {
    if (accountDeleteText !== "DELETE_MY_ACCOUNT") {
      setPrivacyError("Type DELETE_MY_ACCOUNT to confirm account deletion.");
      return;
    }
    setPrivacyError(null);
    setPrivacyMessage(null);
    try {
      await apiClient.deleteAccount();
      setPrivacyMessage("Account deletion request completed.");
    } catch (err) {
      setPrivacyError(errorMessage(err));
    }
  }

  async function createExtensionToken() {
    setError(null);
    try {
      const token = await apiClient.createExtensionPairingToken();
      setExtensionToken(token.token);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function toggleNotification(
    notificationType: NotificationType,
    enabled: boolean,
  ) {
    setNotificationError(null);
    setNotificationMessage(null);
    try {
      const nextPreferences = await apiClient.updateNotificationPreferences([
        { channel: "EMAIL", notificationType, enabled },
      ]);
      setNotificationPreferences(nextPreferences);
      setNotificationMessage("Notification preferences updated.");
    } catch (err) {
      setNotificationError(errorMessage(err));
    }
  }

  async function exchangeToken(event: FormEvent) {
    event.preventDefault();
    setPlaidError(null);
    setPlaidMessage(null);
    try {
      await apiClient.exchangePlaidPublicToken({
        publicToken: publicToken.trim(),
      });
      setPublicToken("");
      setPlaidMessage("Plaid connection saved.");
      await loadPlaid();
    } catch (err) {
      setPlaidError(errorMessage(err));
    }
  }

  async function linkAccount(plaidAccountId: string, userCardId: string) {
    if (!userCardId) return;
    setPlaidError(null);
    setPlaidMessage(null);
    try {
      await apiClient.linkPlaidAccountToCard(plaidAccountId, userCardId);
      setPlaidMessage("Plaid account linked to wallet card.");
      await loadPlaid();
    } catch (err) {
      setPlaidError(errorMessage(err));
    }
  }

  async function syncConnection(connectionId: string) {
    setPlaidError(null);
    setPlaidMessage(null);
    try {
      const result = await apiClient.syncPlaidConnection(connectionId, true);
      setPlaidMessage(
        `Sync complete: ${result.importedTransactionCount} transaction(s), ${result.auditedTransactionCount} audited.`,
      );
      await loadPlaid();
    } catch (err) {
      setPlaidError(errorMessage(err));
    }
  }

  async function disconnectConnection(connectionId: string) {
    setPlaidError(null);
    setPlaidMessage(null);
    try {
      await apiClient.disconnectPlaidConnection(connectionId);
      setPlaidMessage("Plaid connection disconnected.");
      await loadPlaid();
    } catch (err) {
      setPlaidError(errorMessage(err));
    }
  }

  return (
    <section>
      <PageHeader
        title="Settings"
        description="Local beta settings and privacy placeholders."
      />
      <section className="panel">
        <h2>Profile</h2>
        <dl className="detail-list">
          <div>
            <dt>Email</dt>
            <dd>{user.data.email}</dd>
          </div>
          <div>
            <dt>Display name</dt>
            <dd>{user.data.displayName ?? "Not set"}</dd>
          </div>
          <div>
            <dt>Plaid beta</dt>
            <dd>{user.data.plaidBetaEnabled ? "Enabled" : "Not connected"}</dd>
          </div>
        </dl>
        <form className="form-row" onSubmit={submit}>
          <label>
            Display name
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder={user.data.displayName ?? "Beta User"}
            />
          </label>
          <button type="submit">Update profile</button>
        </form>
        {message ? <p className="success-message">{message}</p> : null}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </section>
      <section className="panel">
        <h2>Privacy and Beta Notes</h2>
        <p>
          The beta web app uses an HTTP-only session cookie after login. Dev
          header auth is available only when explicitly enabled locally.
        </p>
        <p>Plaid is optional and private-beta gated in this build.</p>
        <p>
          You can delete Plaid data or transaction data from this beta. Shared
          card, merchant, rule, and offer data is retained.
        </p>
        <p>
          Lens preference is visible in recommendation forms but is not
          persisted yet.
        </p>
      </section>
      <section className="panel">
        <h2>Account Security</h2>
        <div className="button-row">
          <button type="button" onClick={createExtensionToken}>
            Create extension pairing token
          </button>
        </div>
        {extensionToken ? (
          <p className="dev-token">
            Extension pairing token: <code>{extensionToken}</code>
          </p>
        ) : null}
        <h3>Recent auth events</h3>
        {authEvents.length === 0 ? (
          <p>No auth events yet.</p>
        ) : (
          <ul className="plain-list">
            {authEvents.slice(0, 8).map((event) => {
              const record = event as {
                id: string;
                eventType: string;
                createdAt: string;
              };
              return (
                <li key={record.id}>
                  {record.eventType.replaceAll("_", " ")} -{" "}
                  {new Date(record.createdAt).toLocaleString()}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="panel">
        <h2>Billing</h2>
        {!billingStatus ? (
          <p>Loading billing status...</p>
        ) : (
          <>
            <dl className="detail-list">
              <div>
                <dt>Plan</dt>
                <dd>{billingStatus.plan.replace("_", " ")}</dd>
              </div>
              <div>
                <dt>Subscription</dt>
                <dd>{billingStatus.subscription?.status ?? "NONE"}</dd>
              </div>
            </dl>
            <div className="stack">
              <h3>Premium features</h3>
              <ul className="plain-list">
                {Object.entries(billingStatus.entitlements)
                  .filter(([key]) => key !== "BASIC_RECOMMENDATIONS")
                  .map(([key, enabled]) => (
                    <li key={key}>
                      {enabled ? "Included" : "Premium"} -{" "}
                      {key.replaceAll("_", " ").toLowerCase()}
                    </li>
                  ))}
              </ul>
            </div>
            <div className="button-row">
              <button
                type="button"
                onClick={() => {
                  void startCheckout("ANNUAL");
                }}
              >
                Start annual subscription
              </button>
              <button
                className="secondary"
                type="button"
                onClick={() => {
                  void startCheckout("MONTHLY");
                }}
              >
                Start monthly subscription
              </button>
              <button
                className="secondary"
                type="button"
                onClick={() => {
                  void openBillingPortal();
                }}
                disabled={!billingStatus.portalAvailable}
              >
                Manage billing
              </button>
            </div>
          </>
        )}
        {billingMessage ? (
          <p className="success-message">{billingMessage}</p>
        ) : null}
        {billingError ? (
          <p className="form-error" role="alert">
            {billingError}
          </p>
        ) : null}
      </section>
      <section className="panel">
        <h2>Email Notifications</h2>
        <p>
          Weekly audit and reminder digest emails are transactional summaries.
          Password reset and privacy notices are always transactional.
        </p>
        {["WEEKLY_AUDIT", "REMINDER_DIGEST", "BILLING_NOTICE"].map((type) => {
          const preference = notificationPreferences.find(
            (item) => item.notificationType === type,
          );
          return (
            <label className="checkbox-row" key={type}>
              <input
                type="checkbox"
                checked={preference?.enabled ?? true}
                onChange={(event) => {
                  void toggleNotification(
                    type as NotificationType,
                    event.target.checked,
                  );
                }}
              />
              {type.replaceAll("_", " ").toLowerCase()}
            </label>
          );
        })}
        {notificationMessage ? (
          <p className="success-message">{notificationMessage}</p>
        ) : null}
        {notificationError ? (
          <p className="form-error" role="alert">
            {notificationError}
          </p>
        ) : null}
      </section>
      <section className="panel">
        <h2>Consents</h2>
        {consents.length === 0 ? (
          <p>No consent records yet.</p>
        ) : (
          <div className="stack">
            {consents.map((consent) => (
              <div className="list-card" key={consent.id}>
                <strong>{consent.consentType.replaceAll("_", " ")}</strong>
                <p>
                  Version {consent.version} -{" "}
                  {consent.revokedAt ? "Revoked" : "Active"}
                </p>
                {!consent.revokedAt ? (
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => {
                      void revokeConsent(consent.id);
                    }}
                  >
                    Revoke consent
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
        <button className="button" type="button" onClick={grantPlaidConsent}>
          Agree to Plaid transaction audit beta
        </button>
      </section>
      <section className="panel">
        <h2>Plaid Private Beta</h2>
        {!plaidStatus ? (
          <p>Loading Plaid status...</p>
        ) : !plaidStatus.betaEnabled ? (
          <p>Plaid private beta is not enabled for this account.</p>
        ) : (
          <>
            <p>
              Plaid is optional. Synced transaction data is used only for
              rewards auditing, and you can disconnect from this beta panel.
            </p>
            <div className="button-row">
              <button type="button" onClick={createLinkToken}>
                Create link token
              </button>
            </div>
            {linkToken ? (
              <p>
                Link token: <code>{linkToken}</code>
              </p>
            ) : null}
            <form className="form-row" onSubmit={exchangeToken}>
              <label>
                Sandbox public token
                <input
                  value={publicToken}
                  onChange={(event) => setPublicToken(event.target.value)}
                  placeholder="public-sandbox-..."
                />
              </label>
              <button type="submit" disabled={!publicToken.trim()}>
                Exchange token
              </button>
            </form>
            {plaidStatus.connections.length === 0 ? (
              <p>No Plaid connections yet.</p>
            ) : (
              plaidStatus.connections.map((connection) => (
                <div className="list-card" key={connection.id}>
                  <h3>{connection.institutionName ?? "Plaid connection"}</h3>
                  <p>Status: {connection.status}</p>
                  <div className="button-row">
                    <button
                      type="button"
                      onClick={() => syncConnection(connection.id)}
                    >
                      Sync and audit
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => disconnectConnection(connection.id)}
                    >
                      Disconnect
                    </button>
                  </div>
                  {connection.accounts.map((account) => (
                    <label key={account.id}>
                      {account.name}
                      {account.mask ? ` - ${account.mask}` : ""}
                      <select
                        value={account.linkedUserCard?.id ?? ""}
                        onChange={(event) =>
                          linkAccount(account.id, event.target.value)
                        }
                      >
                        <option value="">Link to wallet card</option>
                        {wallet.map((userCard) => (
                          <option value={userCard.id} key={userCard.id}>
                            {userCard.nickname ?? userCard.card.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              ))
            )}
          </>
        )}
        {plaidMessage ? (
          <p className="success-message">{plaidMessage}</p>
        ) : null}
        {plaidError ? (
          <p className="form-error" role="alert">
            {plaidError}
          </p>
        ) : null}
      </section>
      <section className="panel">
        <h2>Data Controls</h2>
        <p>
          These controls affect only your beta user data. They do not delete
          shared card, merchant, rule, or offer records.
        </p>
        <div className="button-row">
          <button
            className="button secondary"
            type="button"
            onClick={deletePlaidData}
          >
            Delete Plaid data
          </button>
          <button
            className="button secondary"
            type="button"
            onClick={deletePlaidTransactions}
          >
            Delete Plaid transactions
          </button>
        </div>
        <div className="list-card">
          <h3>Danger zone</h3>
          <p>Type DELETE_MY_ACCOUNT to anonymize this beta account.</p>
          <input
            value={accountDeleteText}
            onChange={(event) => setAccountDeleteText(event.target.value)}
            aria-label="Account deletion confirmation"
          />
          <button
            className="button secondary"
            type="button"
            onClick={deleteAccount}
          >
            Delete account
          </button>
        </div>
        {privacyMessage ? (
          <p className="success-message">{privacyMessage}</p>
        ) : null}
        {privacyError ? (
          <p className="form-error" role="alert">
            {privacyError}
          </p>
        ) : null}
      </section>
    </section>
  );
}
