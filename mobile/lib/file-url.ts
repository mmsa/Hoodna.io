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
  return (
    url.includes("amazonaws.com") ||
    url.includes("s3.") ||
    url.includes("/api/uploads/download")
  );
}

export async function resolveViewUrl(
  fileUrl: string | null | undefined,
  apiClient?: ApiClient
): Promise<string> {
  const stored = normalizeFileUrl(fileUrl || "");
  if (!stored) return "";
  if (!needsSignedUrl(stored)) return stored;
  if (!apiClient) return "";
  try {
    return await apiClient.getSignedFileUrl(stored);
  } catch {
    return "";
  }
}

export async function openFileUrl(
  fileUrl: string | null | undefined,
  apiClient?: ApiClient
) {
  const url = await resolveViewUrl(fileUrl, apiClient);
  if (url) {
    Linking.openURL(url).catch(() => undefined);
  }
}
