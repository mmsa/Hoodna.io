export const ELJIRAN_WEB_ORIGIN = "https://eljiran.com";
export const ELJIRAN_DEEP_LINK_SCHEME = "eljiran";

export type EljiranRoute =
  | { type: "home" }
  | { type: "referral"; code: string }
  | { type: "business"; slug: string }
  | { type: "post"; id: number }
  | { type: "listing"; id: number }
  | { type: "notification"; id: number }
  | { type: "digest"; id?: number };

function routePath(route: EljiranRoute): string {
  switch (route.type) {
    case "home": return "/";
    case "referral": return `/signup?ref=${encodeURIComponent(route.code)}`;
    case "business": return `/businesses/${encodeURIComponent(route.slug)}`;
    case "post": return `/posts/${route.id}`;
    case "listing": return `/listing/${route.id}`;
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
