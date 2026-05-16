import { logStep, SmokeClient } from "./smokeUtils.js";

async function main() {
  const admin = new SmokeClient(undefined, "admin-flow");
  await admin.login("admin@example.com", "AdminPassword12345!");
  logStep("logged in as admin@example.com");

  await admin.request("/v1/admin/diagnostics");
  await admin.request("/v1/admin/ops/summary");
  await admin.request("/v1/admin/beta-readiness");
  logStep("diagnostics, ops summary, and beta readiness fetched");

  await admin.request("/v1/admin/review-tasks", { query: { limit: 5 } });
  await admin.request("/v1/admin/dashboard/rule-freshness", {
    query: { limit: 5 },
  });
  await admin.request("/v1/admin/dashboard/recommendation-errors", {
    query: { limit: 5 },
  });
  await admin.request("/v1/admin/audit-logs", { query: { limit: 5 } });
  await admin.request("/v1/admin/jobs/runs", { query: { limit: 5 } });
  await admin.request("/v1/admin/email-logs", { query: { limit: 5 } });
  await admin.request("/v1/admin/billing/users", { query: { limit: 5 } });
  logStep("core admin list views fetched");

  const suffix = Date.now().toString(36);
  const merchant = await admin.request<{ id: string }>("/v1/admin/merchants", {
    method: "POST",
    expected: [200, 201],
    body: {
      name: `Smoke Merchant ${suffix}`,
      slug: `smoke-merchant-${suffix}`,
      category: "GENERAL",
      websiteUrl: `https://smoke-${suffix}.example.com`,
    },
  });
  await admin.request(`/v1/admin/merchants/${merchant.id}`, {
    method: "PATCH",
    body: { websiteUrl: null },
  });
  logStep("created and updated harmless test merchant");

  console.log("Admin flow smoke passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
