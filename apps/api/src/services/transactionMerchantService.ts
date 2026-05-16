import { normalizeMerchantName } from "@rewards-audit/rewards-engine";

import { prisma } from "@rewards-audit/db";

export async function findMerchantByTransactionName(normalizedName: string) {
  const normalized = normalizeMerchantName(normalizedName);
  const merchants = await prisma.merchant.findMany({
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });

  return (
    merchants.find((merchant) => {
      const name = normalizeMerchantName(merchant.name);
      const slug = normalizeMerchantName(merchant.slug.replace(/-/g, " "));
      return (
        normalized === name ||
        normalized === slug ||
        normalized.startsWith(`${name} `) ||
        normalized.startsWith(`${slug} `) ||
        name.startsWith(`${normalized} `)
      );
    }) ?? null
  );
}
