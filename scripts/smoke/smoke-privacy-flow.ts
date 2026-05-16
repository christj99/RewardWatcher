import {
  assertSmoke,
  createSmokeRecommendation,
  ensureWalletCard,
  importSmokeTransaction,
  logStep,
  SmokeClient,
  uniqueEmail,
} from "./smokeUtils.js";

async function main() {
  const admin = new SmokeClient(undefined, "privacy-admin");
  await admin.login("admin@example.com", "AdminPassword12345!");

  const user = new SmokeClient(undefined, "privacy-user");
  const email = uniqueEmail("smoke-privacy");
  const registered = await user.request<{
    user: { id: string; email: string };
  }>("/v1/auth/register", {
    method: "POST",
    body: {
      email,
      password: "PrivacySmoke12345!",
      displayName: "Disposable Privacy Smoke",
    },
  });
  logStep("created disposable user");

  await admin.request("/v1/admin/entitlements/grant", {
    method: "POST",
    expected: [200, 201],
    body: {
      userId: registered.user.id,
      key: "FULL_TRANSACTION_AUDIT",
      source: "MANUAL_GRANT",
      notes: "Smoke privacy flow audit grant.",
    },
  });

  const userCard = await ensureWalletCard(user);
  await createSmokeRecommendation(user);
  await importSmokeTransaction(user, userCard.id, true);
  logStep(
    "created user-owned wallet, recommendation, transaction, and outcome",
  );

  await user.request("/v1/privacy/transactions", {
    method: "DELETE",
    body: {
      confirmation: "DELETE_TRANSACTIONS",
      source: "TEST_FIXTURE",
    },
  });
  logStep("deleted test fixture transactions");

  const cards = await user.request<unknown>("/v1/cards", {
    query: { limit: 1 },
  });
  assertSmoke(
    cards,
    "Shared card data should remain after transaction deletion.",
  );

  await user.request("/v1/privacy/account", {
    method: "DELETE",
    body: { confirmation: "DELETE_MY_ACCOUNT" },
  });
  logStep("requested account deletion/anonymization");

  await user.request("/v1/auth/login", {
    method: "POST",
    expected: 401,
    body: { email, password: "PrivacySmoke12345!" },
  });
  logStep("deleted account can no longer log in with original email");

  console.log("Privacy flow smoke passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
