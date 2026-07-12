import * as SecureStore from "expo-secure-store";

const REFERRAL_CODE_KEY = "pendingReferralCode";

export async function savePendingReferralCode(code: string): Promise<void> {
  const normalized = code.trim();
  if (normalized.length >= 4 && normalized.length <= 64) {
    await SecureStore.setItemAsync(REFERRAL_CODE_KEY, normalized);
  }
}

export async function getPendingReferralCode(): Promise<string | undefined> {
  return (await SecureStore.getItemAsync(REFERRAL_CODE_KEY)) || undefined;
}

export async function clearPendingReferralCode(): Promise<void> {
  await SecureStore.deleteItemAsync(REFERRAL_CODE_KEY);
}
