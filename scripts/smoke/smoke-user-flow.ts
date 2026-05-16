import {
  createSmokeRecommendation,
  ensureWalletCard,
  extractArray,
  importSmokeTransaction,
  logStep,
  SmokeClient,
} from "./smokeUtils.js";

async function main() {
  const client = new SmokeClient(undefined, "user-flow");
  await client.login("beta@example.com", "Password12345!");
  logStep("logged in as beta@example.com");

  const userCard = await ensureWalletCard(client);
  await createSmokeRecommendation(client);
  logStep("created recommendation");

  const transaction = await importSmokeTransaction(client, userCard.id, true);
  await client.request(`/v1/transactions/${transaction.id}/audit`, {
    method: "POST",
  });
  logStep("imported and audited transaction");

  await client.request("/v1/audit/weekly", { query: { limitItems: 10 } });
  await client.request("/v1/reminders/generate-defaults", {
    method: "POST",
    body: {},
  });
  await client.request("/v1/statement-credit-usage/generate", {
    method: "POST",
    body: { inferFromTransactions: true },
  });
  logStep("generated weekly audit, reminders, and credit usage");

  const offers = await client.request<unknown>("/v1/offers", {
    query: { limit: 5 },
  });
  const firstOffer = extractArray<{ id?: string; offer?: { id: string } }>(
    offers,
  )[0];
  const offerId = firstOffer?.offer?.id ?? firstOffer?.id;
  if (offerId) {
    await client.request(`/v1/offers/${offerId}/activation`, {
      method: "PATCH",
      body: { status: "ACTIVATED" },
    });
    logStep("activated a relevant offer");
  } else {
    logStep("no relevant offers to activate; skipped offer activation");
  }

  await client.request("/v1/users/me");
  await client.request("/v1/wallet");
  await client.request("/v1/recommendations/history", { query: { limit: 5 } });
  logStep("dashboard-relevant endpoints fetched");

  console.log("User flow smoke passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
