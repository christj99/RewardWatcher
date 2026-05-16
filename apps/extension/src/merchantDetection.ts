import type { MerchantResolution } from "./types.js";
import { normalizeUrlForLookup } from "./url.js";

export type MerchantResolver = {
  resolveMerchantByUrl: (url: string) => Promise<MerchantResolution>;
};

export async function resolveMerchantForPage(
  pageUrl: string,
  resolver: MerchantResolver,
): Promise<MerchantResolution | null> {
  const normalizedUrl = normalizeUrlForLookup(pageUrl);

  if (!normalizedUrl) {
    return null;
  }

  try {
    return await resolver.resolveMerchantByUrl(normalizedUrl);
  } catch {
    return null;
  }
}
