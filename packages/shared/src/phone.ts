const EG_LOCAL_PREFIXES = ["010", "011", "012", "015"];
const EG_NSN_PREFIXES = ["10", "11", "12", "15"];

/**
 * Digits-only E.164 without '+'.
 * Explicit country code (+ or 00) is kept as-is for any country.
 * Locals without a country code are treated as Egyptian mobiles only.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = String(raw)
    .replace(/[\u202a\u202b\u202c\u200e\u200f]/g, "")
    .replace(/[\u202f\u00a0]/g, " ");
  const hadPlus = cleaned.trim().startsWith("+");
  let digits = cleaned.replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.startsWith("900") && digits.length >= 12) return null;

  if (hadPlus || digits.startsWith("00")) {
    if (digits.startsWith("00")) digits = digits.slice(2);
    return digits.length >= 8 && digits.length <= 15 ? digits : null;
  }

  // Already stored as country-code + national (OTP round-trip / DB)
  if (digits.length >= 11 && digits.length <= 15 && !digits.startsWith("0")) {
    return digits;
  }

  if (digits.length === 11 && EG_LOCAL_PREFIXES.includes(digits.slice(0, 3))) {
    return "20" + digits.slice(1);
  }
  if (digits.length === 10 && EG_NSN_PREFIXES.includes(digits.slice(0, 2))) {
    return "20" + digits;
  }
  return null;
}

export function formatPhoneDisplay(phone: string | null | undefined): string | null {
  const normalized = normalizePhone(phone);
  if (!normalized) return phone ?? null;
  return `+${normalized}`;
}

const THREE_DIGIT_CALLING_CODES = [
  "212", "213", "216", "218",
  "353", "354", "358",
  "370", "371", "372", "373", "374", "375", "376", "380", "381", "382", "385", "386", "387", "389",
  "420", "421", "423",
  "960", "961", "962", "963", "964", "965", "966", "967", "968", "970", "971", "972", "973", "974", "975", "976", "977",
  "992", "993", "994", "995", "996", "998",
];

/** Mask a phone for display, e.g. +44••••1234. */
export function maskPhone(phone: string | null | undefined): string {
  const digits = (normalizePhone(phone) ?? String(phone ?? "").replace(/[^\d]/g, "")).replace(
    /[^\d]/g,
    "",
  );
  if (!digits) return "";
  if (digits.length < 6) return `+${digits}`;
  const last4 = digits.slice(-4);
  let prefixLen = 2;
  if (digits.startsWith("1") && digits.length === 11) prefixLen = 1;
  else if (THREE_DIGIT_CALLING_CODES.some((code) => digits.startsWith(code))) prefixLen = 3;
  prefixLen = Math.min(prefixLen, digits.length - 4);
  return `+${digits.slice(0, prefixLen)}••••${last4}`;
}
