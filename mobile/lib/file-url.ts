import { API_BASE_URL } from "@/lib/config";
import { Linking } from "react-native";
import type { ApiClient } from "@hoodna/shared";

export function normalizeFileUrl(fileUrl: string | null | undefined): string {
  if (!fileUrl) return "";
  if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
    return fileUrl;
  }
  if (fileUrl.startsWith("/")) {
    return `${API_BASE_URL.replace(/\/$/, "")}${fileUrl}`;
  }
  return fileUrl;
}

export function isImageUrl(url: string) {
  return /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url);
}

export function isPdfUrl(url: string) {
  return /\.pdf(\?|$)/i.test(url);
}

function needsSignedUrl(url: string) {
  return url.includes("amazonaws.com") || url.includes("s3.");
}

export async function openFileUrl(
  fileUrl: string | null | undefined,
  apiClient?: ApiClient
) {
  let url = normalizeFileUrl(fileUrl);
  if (!url) return;
  if (apiClient && needsSignedUrl(url)) {
    try {
      url = await apiClient.getSignedFileUrl(url);
    } catch {
      // fall back to stored URL
    }
  }
  Linking.openURL(url).catch(() => undefined);
}
