export const ELJIRAN_WEB_ORIGIN = "https://eljiran.io";
export const ELJIRAN_DEEP_LINK_SCHEME = "eljiran";
export const ELJIRAN_SUPPORT_EMAIL = "hello@eljiran.io";
export const ELJIRAN_SUPPORT_MAILTO = `mailto:${ELJIRAN_SUPPORT_EMAIL}`;
export const ELJIRAN_PRIVACY_URL = `${ELJIRAN_WEB_ORIGIN}/privacy`;
export const ELJIRAN_TERMS_URL = `${ELJIRAN_WEB_ORIGIN}/terms`;
export const ELJIRAN_SUPPORT_URL = `${ELJIRAN_WEB_ORIGIN}/support`;

export type EljiranRoute =
  | { type: "home" }
  | { type: "referral"; code: string }
  | { type: "business"; slug: string }
  | { type: "post"; id: number }
  | { type: "listing"; id: number }
  | { type: "message"; id: number }
  | { type: "verification" }
  | { type: "notification"; id: number }
  | { type: "digest"; id?: number };

function routePath(route: EljiranRoute): string {
  switch (route.type) {
    case "home": return "/";
    case "referral": return `/signup?ref=${encodeURIComponent(route.code)}`;
    case "business": return `/businesses/${encodeURIComponent(route.slug)}`;
    case "post": return `/posts/${route.id}`;
    case "listing": return `/listing/${route.id}`;
    case "message": return `/messages/${route.id}`;
    case "verification": return "/verification";
    case "notification": return `/notifications/${route.id}`;
    case "digest": return route.id ? `/digest/${route.id}` : "/digest";
  }
}

export function buildEljiranUrl(
  route: EljiranRoute,
  origin = ELJIRAN_WEB_ORIGIN,
): string {
  return `${origin.replace(/\/$/, "")}${routePath(route)}`;
}

export function buildEljiranDeepLink(route: EljiranRoute): string {
  return `${ELJIRAN_DEEP_LINK_SCHEME}://${routePath(route).replace(/^\//, "")}`;
}

export function buildReferralInviteUrl(
  code: string,
  origin = ELJIRAN_WEB_ORIGIN,
): string {
  return buildEljiranUrl({ type: "referral", code }, origin);
}

export function buildBusinessUrl(
  slug: string,
  origin = ELJIRAN_WEB_ORIGIN,
): string {
  return buildEljiranUrl({ type: "business", slug }, origin);
}

export interface SharePayload {
  title: string;
  message: string;
  url: string;
}

export function buildReferralSharePayload(
  code: string,
  origin = ELJIRAN_WEB_ORIGIN,
): SharePayload {
  const url = buildReferralInviteUrl(code, origin);
  return {
    title: "Join me on Eljiran",
    message: `Join your neighbours on Eljiran: ${url}`,
    url,
  };
}

export function buildBusinessSharePayload(
  name: string,
  slug: string,
  origin = ELJIRAN_WEB_ORIGIN,
): SharePayload {
  const url = buildBusinessUrl(slug, origin);
  return {
    title: `${name} on Eljiran`,
    message: `View ${name} on Eljiran: ${url}`,
    url,
  };
}
