import * as SecureStore from "expo-secure-store";

import {
  clearPendingReferralCode as clearStoredReferral,
  getPendingReferralCode as readStoredReferral,
  savePendingReferralCode as persistReferral,
} from "@/lib/attribution";

const REFERRAL_CODE_KEY = "pendingReferralCode";

export async function savePendingReferralCode(code: string): Promise<void> {
  await persistReferral(code);
}

export async function getPendingReferralCode(): Promise<string | undefined> {
  return readStoredReferral();
}

export async function clearPendingReferralCode(): Promise<void> {
  await clearStoredReferral();
  try {
    await SecureStore.deleteItemAsync(REFERRAL_CODE_KEY);
  } catch {
    // ignore
  }
}
