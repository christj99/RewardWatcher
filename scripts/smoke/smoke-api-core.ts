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
  const client = new SmokeClient(undefined, "api-core");

  await client.request("/health");
  logStep("/health returned ok");

  const ready = await client.request<{ status: string }>("/ready");
  assertSmoke(ready.status === "ready", `/ready was ${ready.status}`);
  logStep("/ready returned ready");

  const email = uniqueEmail("smoke-core");
  const register = await client.request<{
    user: { id: string; email: string };
  }>("/v1/auth/register", {
    method: "POST",
    body: {
      email,
      password: "SmokePassword12345!",
      displayName: "Smoke Core User",
    },
  });
  assertSmoke(
    register.user.email === email,
    "Register did not return new user.",
  );
  await client.request("/v1/auth/session");
  await client.logout();
  logStep("register/session/logout works");

  await client.login("beta@example.com", "Password12345!");
  await client.request("/v1/auth/session");
  logStep("seeded beta login works");

  const cards = await client.request<Array<{ id: string }>>("/v1/cards", {
    query: { limit: 10 },
  });
  assertSmoke(cards.length > 0, "Expected seeded cards.");
  const userCard = await ensureWalletCard(client);
  logStep("cards and wallet are available");

  const merchant = await client.request("/v1/merchants/by-url", {
    query: { url: "https://www.target.com/checkout" },
  });
  assertSmoke(merchant, "Merchant by-url did not return a payload.");
  logStep("merchant URL lookup works");

  const recommendation = await createSmokeRecommendation(client);
  await client.request(`/v1/recommendations/${recommendation.id}`);
  logStep("recommendation create and receipt fetch work");

  await client.request(`/v1/recommendations/${recommendation.id}/correction`, {
    method: "POST",
    expected: [200, 201],
    body: {
      correctionType: "OTHER",
      userNote: "Smoke correction for launch gate coverage.",
    },
  });
  logStep("correction submit works");

  const transaction = await importSmokeTransaction(client, userCard.id, true);
  await client.request(`/v1/transactions/${transaction.id}/audit`, {
    method: "POST",
  });
  logStep("transaction import and audit work");

  await client.request("/v1/audit/weekly", { query: { limitItems: 5 } });
  logStep("weekly audit works");

  await client.request("/v1/billing/status");
  await client.request("/v1/privacy/requests");
  logStep("billing status and privacy request list work");

  console.log("API core smoke passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
