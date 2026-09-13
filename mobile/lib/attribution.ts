import * as SecureStore from "expo-secure-store";
import {
  ATTRIBUTION_STORAGE_KEY,
  compactAttribution,
  hasAttribution,
  mergeFirstTouch,
  parseAttributionFromSearch,
  parseReferralCode,
  type StoredFirstTouch,
} from "@hoodna/shared";

const REFERRAL_CODE_KEY = "pendingReferralCode";

function queryToSearchParams(
  query: Record<string, string | string[] | undefined> | null | undefined,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(query || {})) {
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value === "string" && value) params.set(key, value);
  }
  return params;
}

async function readStored(): Promise<StoredFirstTouch | null> {
  try {
    const raw = await SecureStore.getItemAsync(ATTRIBUTION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredFirstTouch;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeStored(value: StoredFirstTouch): Promise<void> {
  await SecureStore.setItemAsync(ATTRIBUTION_STORAGE_KEY, JSON.stringify(value));
  if (value.referralCode) {
    await SecureStore.setItemAsync(REFERRAL_CODE_KEY, value.referralCode);
  }
}

export async function savePendingReferralCode(code: string): Promise<void> {
  const normalized = code.trim();
  if (normalized.length < 4 || normalized.length > 64) return;
  await SecureStore.setItemAsync(REFERRAL_CODE_KEY, normalized);
  const existing = await readStored();
  await writeStored(
    mergeFirstTouch(existing, {
      attribution: existing?.attribution || { source: "referral", medium: "referral" },
      referralCode: existing?.referralCode || normalized,
    }),
  );
}

export async function getPendingReferralCode(): Promise<string | undefined> {
  const stored = await readStored();
  if (stored?.referralCode) return stored.referralCode;
  return (await SecureStore.getItemAsync(REFERRAL_CODE_KEY)) || undefined;
}

export async function clearPendingReferralCode(): Promise<void> {
  await SecureStore.deleteItemAsync(REFERRAL_CODE_KEY);
}

export async function captureMobileFirstTouch(input: {
  query?: Record<string, string | string[] | undefined> | null;
  path?: string | null;
}): Promise<StoredFirstTouch | null> {
  const params = queryToSearchParams(input.query);
  const incoming: StoredFirstTouch = {
    attribution: compactAttribution(
      parseAttributionFromSearch(params, {
        landingPath: input.path ? `/${String(input.path).replace(/^\//, "")}` : undefined,
      }),
    ),
    referralCode: parseReferralCode(params),
  };
  if (!hasAttribution(incoming.attribution) && !incoming.referralCode) {
    return readStored();
  }
  const next = mergeFirstTouch(await readStored(), incoming);
  await writeStored(next);
  return next;
}

export async function getMobileFirstTouch(): Promise<StoredFirstTouch | null> {
  const stored = await readStored();
  if (stored) return stored;
  const referralCode = await getPendingReferralCode();
  if (!referralCode) return null;
  return { attribution: { source: "referral", medium: "referral" }, referralCode };
}
