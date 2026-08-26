/** Egyptian-aware phone normalization shared with backend OTP + chat import. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = String(raw)
    .replace(/[\u202a\u202b\u202c\u200e\u200f]/g, "")
    .replace(/[\u202f\u00a0]/g, " ");
  let digits = cleaned.replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.startsWith("900") && digits.length >= 12) return null;
  if (digits.startsWith("01") && digits.length === 11) {
    digits = "20" + digits.slice(1);
  } else if (digits.startsWith("1") && digits.length === 10) {
    digits = "20" + digits;
  } else if (digits.startsWith("0020")) {
    digits = digits.slice(2);
  } else if (digits.startsWith("00") && digits.length > 10) {
    digits = digits.slice(2);
  }
  return digits.length >= 8 ? digits : null;
}

export function formatPhoneDisplay(phone: string | null | undefined): string | null {
  const normalized = normalizePhone(phone);
  if (!normalized) return phone ?? null;
  return `+${normalized}`;
}
