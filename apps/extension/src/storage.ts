import { pageDismissalKey } from "./url.js";

type LocalStorageArea = {
  get: (keys: string[]) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
};

type ChromeLike = {
  storage?: {
    local?: LocalStorageArea;
  };
};

type DismissedPages = Record<string, true>;
type MutedMerchants = Record<string, true>;

const dismissedPagesKey = "dismissedPages";
const mutedMerchantsKey = "mutedMerchants";
const extensionSessionTokenKey = "extensionSessionToken";
const memoryStore = new Map<string, unknown>();

export async function isPageDismissed(url: string): Promise<boolean> {
  const dismissedPages = await readMap<DismissedPages>(dismissedPagesKey);
  return dismissedPages[pageDismissalKey(url)] === true;
}

export async function dismissPage(url: string): Promise<void> {
  const dismissedPages = await readMap<DismissedPages>(dismissedPagesKey);
  dismissedPages[pageDismissalKey(url)] = true;
  await writeMap(dismissedPagesKey, dismissedPages);
}

export async function isMerchantMuted(merchantId: string): Promise<boolean> {
  const mutedMerchants = await readMap<MutedMerchants>(mutedMerchantsKey);
  return mutedMerchants[merchantId] === true;
}

export async function muteMerchant(merchantId: string): Promise<void> {
  const mutedMerchants = await readMap<MutedMerchants>(mutedMerchantsKey);
  mutedMerchants[merchantId] = true;
  await writeMap(mutedMerchantsKey, mutedMerchants);
}

export async function clearExtensionStorageForTests(): Promise<void> {
  memoryStore.clear();
}

export async function getExtensionSessionToken(): Promise<string | null> {
  const area = getStorageArea();
  if (area) {
    const result = await area.get([extensionSessionTokenKey]);
    return typeof result[extensionSessionTokenKey] === "string"
      ? result[extensionSessionTokenKey]
      : null;
  }
  const token = memoryStore.get(extensionSessionTokenKey);
  return typeof token === "string" ? token : null;
}

export async function setExtensionSessionToken(token: string): Promise<void> {
  const area = getStorageArea();
  if (area) {
    await area.set({ [extensionSessionTokenKey]: token });
    return;
  }
  memoryStore.set(extensionSessionTokenKey, token);
}

async function readMap<T extends Record<string, true>>(
  key: string,
): Promise<T> {
  const area = getStorageArea();

  if (area) {
    const result = await area.get([key]);
    const existing = result[key] as T | undefined;
    return { ...(existing ?? {}) } as T;
  }

  const existing = memoryStore.get(key) as T | undefined;
  return { ...(existing ?? {}) } as T;
}

async function writeMap<T extends Record<string, true>>(
  key: string,
  value: T,
): Promise<void> {
  const area = getStorageArea();

  if (area) {
    await area.set({ [key]: value });
    return;
  }

  memoryStore.set(key, value);
}

function getStorageArea(): LocalStorageArea | null {
  const maybeChrome = (globalThis as { chrome?: ChromeLike }).chrome;
  return maybeChrome?.storage?.local ?? null;
}
