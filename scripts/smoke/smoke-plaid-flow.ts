import { logStep, SmokeClient } from "./smokeUtils.js";

async function main() {
  const client = new SmokeClient(undefined, "plaid-flow");
  await client.login("beta@example.com", "Password12345!");

  await client.request("/v1/consents", {
    method: "POST",
    expected: [200, 201],
    body: {
      consentType: "PLAID_TRANSACTIONS",
      version: "smoke",
      metadata: { source: "plaid-smoke" },
    },
  });
  logStep("Plaid transaction consent exists");

  await client.request("/v1/plaid/status");
  await client.request("/v1/plaid/link-token", {
    method: "POST",
    expected: [200, 400, 403, 500],
    body: {},
  });
  logStep("Plaid status and link-token route respond in sandbox/config mode");

  console.log("Plaid flow smoke passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
