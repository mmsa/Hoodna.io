/** URL helpers for feed link previews. */

const URL_RE =
  /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,24}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi;

export function extractUrls(text: string): string[] {
  if (!text) return [];
  const matches = text.match(URL_RE) || [];
  // Dedupe while preserving order
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of matches) {
    const cleaned = raw.replace(/[),.]+$/g, "");
    if (seen.has(cleaned)) continue;
    seen.add(cleaned);
    out.push(cleaned);
  }
  return out;
}

export function firstHttpUrl(text: string): string | null {
  return extractUrls(text)[0] ?? null;
}

export type LinkHostKind =
  | "youtube"
  | "facebook"
  | "tiktok"
  | "instagram"
  | "twitter"
  | "generic";

export function classifyLinkHost(url: string): LinkHostKind {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be" || host.endsWith("youtube.com")) return "youtube";
    if (host.endsWith("facebook.com") || host.endsWith("fb.watch") || host === "fb.com")
      return "facebook";
    if (host.endsWith("tiktok.com") || host === "vm.tiktok.com" || host === "vt.tiktok.com")
      return "tiktok";
    if (host.endsWith("instagram.com")) return "instagram";
    if (host === "x.com" || host.endsWith("twitter.com") || host === "t.co") return "twitter";
    return "generic";
  } catch {
    return "generic";
  }
}

export function youtubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") {
      return u.pathname.replace(/^\//, "").split("/")[0] || null;
    }
    if (u.hostname.replace(/^www\./, "").endsWith("youtube.com")) {
      if (u.pathname.startsWith("/shorts/")) {
        return u.pathname.split("/")[2] || null;
      }
      return u.searchParams.get("v");
    }
  } catch {
    return null;
  }
  return null;
}

export function youtubeThumbnailUrl(url: string): string | null {
  const id = youtubeVideoId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

export function displayHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function linkKindLabel(kind: LinkHostKind): string {
  switch (kind) {
    case "youtube":
      return "YouTube";
    case "facebook":
      return "Facebook";
    case "tiktok":
      return "TikTok";
    case "instagram":
      return "Instagram";
    case "twitter":
      return "X";
    default:
      return "Link";
  }
}

/** True when the post/comment body is only URL(s) (+ whitespace). */
export function isUrlOnlyContent(text: string): boolean {
  if (!text?.trim()) return false;
  const urls = extractUrls(text);
  if (!urls.length) return false;
  let rest = text;
  for (const url of urls) {
    rest = rest.split(url).join(" ");
  }
  return rest.trim().length === 0;
}

export function socialWatchLabel(kind: LinkHostKind): string {
  switch (kind) {
    case "facebook":
      return "Watch on Facebook";
    case "tiktok":
      return "Watch on TikTok";
    case "instagram":
      return "Open on Instagram";
    case "twitter":
      return "Open on X";
    case "youtube":
      return "Watch on YouTube";
    default:
      return "Open link";
  }
}

/** Brand colors for social fallback cards (no OG image available). */
export function socialBrandTheme(kind: LinkHostKind): {
  bg: string;
  bgEnd: string;
  accent: string;
  label: string;
} {
  switch (kind) {
    case "facebook":
      return { bg: "#1877F2", bgEnd: "#0D5FBF", accent: "#FFFFFF", label: "Facebook" };
    case "tiktok":
      return { bg: "#121212", bgEnd: "#25F4EE", accent: "#FE2C55", label: "TikTok" };
    case "instagram":
      return { bg: "#833AB4", bgEnd: "#FD1D1D", accent: "#F77737", label: "Instagram" };
    case "twitter":
      return { bg: "#0F1419", bgEnd: "#1D9BF0", accent: "#FFFFFF", label: "X" };
    case "youtube":
      return { bg: "#FF0000", bgEnd: "#CC0000", accent: "#FFFFFF", label: "YouTube" };
    default:
      return { bg: "#0F766E", bgEnd: "#115E59", accent: "#FFFFFF", label: "Link" };
  }
}

export interface LinkPreviewData {
  url: string;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  site_name?: string | null;
  kind: LinkHostKind;
}
