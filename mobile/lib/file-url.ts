import { API_BASE_URL } from "@/lib/config";
import { Linking } from "react-native";

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

export function openFileUrl(fileUrl: string | null | undefined) {
  const url = normalizeFileUrl(fileUrl);
  if (url) {
    Linking.openURL(url).catch(() => undefined);
  }
}
