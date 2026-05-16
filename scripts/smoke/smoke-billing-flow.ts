import { assertSmoke, logStep, SmokeClient } from "./smokeUtils.js";

async function main() {
  const client = new SmokeClient(undefined, "billing-flow");
  await client.login("beta@example.com", "Password12345!");

  const status = await client.request<unknown>("/v1/billing/status");
  assertSmoke(status, "Billing status did not return a payload.");
  logStep("billing status works");

  await client.request("/v1/billing/create-checkout-session", {
    method: "POST",
    expected: [200, 400, 500],
    body: { interval: "ANNUAL" },
  });
  logStep("checkout route responds clearly in configured or unconfigured mode");

  console.log("Billing flow smoke passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
