/** First-touch acquisition attribution. Write-once; no PII. */

export const ATTRIBUTION_STORAGE_KEY = "eljiran-first-touch-v1";

export type RegistrationPlatform = "web" | "ios" | "android";

export type AttributionPayload = {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  content?: string | null;
  term?: string | null;
  referrer_host?: string | null;
  landing_path?: string | null;
};

export type StoredFirstTouch = {
  attribution: AttributionPayload;
  referralCode?: string;
};

const ATTR_KEYS = [
  "source",
  "medium",
  "campaign",
  "content",
  "term",
  "referrer_host",
  "landing_path",
] as const;

const SAFE = /^[A-Za-z0-9_.:/-]{1,100}$/;

const REFERRER_SOURCE: Record<string, { source: string; medium: string }> = {
  "wa.me": { source: "whatsapp", medium: "social" },
  "whatsapp.com": { source: "whatsapp", medium: "social" },
  "web.whatsapp.com": { source: "whatsapp", medium: "social" },
  "api.whatsapp.com": { source: "whatsapp", medium: "social" },
  "facebook.com": { source: "facebook", medium: "social" },
  "www.facebook.com": { source: "facebook", medium: "social" },
  "m.facebook.com": { source: "facebook", medium: "social" },
  "l.facebook.com": { source: "facebook", medium: "social" },
  "fb.com": { source: "facebook", medium: "social" },
  "instagram.com": { source: "instagram", medium: "social" },
  "www.instagram.com": { source: "instagram", medium: "social" },
  "l.instagram.com": { source: "instagram", medium: "social" },
  "tiktok.com": { source: "tiktok", medium: "social" },
  "www.tiktok.com": { source: "tiktok", medium: "social" },
  "vm.tiktok.com": { source: "tiktok", medium: "social" },
};

function sanitize(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, 100);
  if (!trimmed || !SAFE.test(trimmed)) return undefined;
  return trimmed;
}

function hostFromReferrer(referrer: string | null | undefined): string | undefined {
  if (!referrer) return undefined;
  try {
    return new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

export function attributionFromReferrerHost(
  host: string | null | undefined,
): { source: string; medium: string } | null {
  if (!host) return null;
  const key = host.toLowerCase().replace(/^www\./, "");
  if (REFERRER_SOURCE[host.toLowerCase()]) return REFERRER_SOURCE[host.toLowerCase()];
  if (REFERRER_SOURCE[key]) return REFERRER_SOURCE[key];
  for (const [suffix, mapped] of Object.entries(REFERRER_SOURCE)) {
    if (key.endsWith(suffix)) return mapped;
  }
  return null;
}

export function parseReferralCode(
  params: URLSearchParams | Record<string, string | undefined | null>,
): string | undefined {
  const get = (key: string) =>
    params instanceof URLSearchParams ? params.get(key) : params[key];
  const raw = get("ref") || get("referral_code") || "";
  const code = raw.trim();
  return code.length >= 4 && code.length <= 64 ? code : undefined;
}

export function parseAttributionFromSearch(
  search: string | URLSearchParams,
  extras: { referrer?: string | null; landingPath?: string | null } = {},
): AttributionPayload {
  const params =
    typeof search === "string"
      ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
      : search;

  const utmSource = sanitize(params.get("utm_source"))?.toLowerCase();
  const utmMedium = sanitize(params.get("utm_medium"))?.toLowerCase();
  const utmCampaign = sanitize(params.get("utm_campaign"));
  const utmContent = sanitize(params.get("utm_content"));
  const utmTerm = sanitize(params.get("utm_term"));
  const referrerHost = hostFromReferrer(extras.referrer) || sanitize(params.get("utm_referrer"));
  const fromReferrer = attributionFromReferrerHost(referrerHost);
  const referral = parseReferralCode(params);

  let source = utmSource;
  let medium = utmMedium;
  if (!source && fromReferrer) {
    source = fromReferrer.source;
    medium = medium || fromReferrer.medium;
  }
  if (!source && referral) {
    source = "referral";
    medium = medium || "referral";
  }

  const landing = extras.landingPath
    ? extras.landingPath.split("?")[0].slice(0, 100)
    : undefined;

  return {
    source: source || undefined,
    medium: medium || undefined,
    campaign: utmCampaign,
    content: utmContent,
    term: utmTerm,
    referrer_host: referrerHost,
    landing_path: landing && landing.startsWith("/") ? landing : landing ? `/${landing}` : undefined,
  };
}

export function hasAttribution(payload: AttributionPayload | null | undefined): boolean {
  if (!payload) return false;
  return ATTR_KEYS.some((key) => Boolean(payload[key]));
}

/** First stored touch wins. Empty incoming values do not fill later. */
export function mergeFirstTouch(
  existing: StoredFirstTouch | null | undefined,
  incoming: StoredFirstTouch,
): StoredFirstTouch {
  if (!existing) return incoming;
  return {
    attribution: hasAttribution(existing.attribution) ? existing.attribution : incoming.attribution,
    referralCode: existing.referralCode || incoming.referralCode,
  };
}

export function compactAttribution(payload: AttributionPayload): AttributionPayload {
  const out: AttributionPayload = {};
  for (const key of ATTR_KEYS) {
    const value = payload[key];
    if (value) out[key] = value;
  }
  return out;
}

export type UtmParams = {
  source: string;
  medium: string;
  campaign: string;
  content?: string;
};

/** Append UTM params without removing existing `ref` or other query keys. */
export function withUtmParams(url: string, utm: UtmParams, origin = "https://eljiran.io"): string {
  const parsed = new URL(url, origin);
  if (!parsed.searchParams.has("utm_source")) parsed.searchParams.set("utm_source", utm.source);
  if (!parsed.searchParams.has("utm_medium")) parsed.searchParams.set("utm_medium", utm.medium);
  if (!parsed.searchParams.has("utm_campaign")) parsed.searchParams.set("utm_campaign", utm.campaign);
  if (utm.content && !parsed.searchParams.has("utm_content")) {
    parsed.searchParams.set("utm_content", utm.content);
  }
  return parsed.toString();
}

export const SHARE_UTM = {
  whatsappListing: { source: "whatsapp", medium: "social", campaign: "listing" },
  whatsappPost: { source: "whatsapp", medium: "social", campaign: "post" },
  whatsappBusiness: { source: "whatsapp", medium: "social", campaign: "business" },
  nativeShare: { source: "share", medium: "social", campaign: "share" },
  invite: { source: "referral", medium: "referral", campaign: "invite" },
  whatsappInvite: { source: "whatsapp", medium: "social", campaign: "invite" },
} as const;
