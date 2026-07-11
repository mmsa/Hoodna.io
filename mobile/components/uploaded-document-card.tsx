import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import type { ApiClient } from "@hoodna/shared";
import {
  normalizeFileUrl,
  needsPrivateFileUrl,
  isImageUrl,
  isPdfUrl,
  openFileUrl,
  resolveViewUrl,
} from "@/lib/file-url";
import { SignedImage } from "@/components/signed-image";

function statusLabel(status?: string | null) {
  if (!status) return "Not uploaded";
  if (status === "APPROVED") return "Approved";
  if (status === "REJECTED") return "Rejected";
  if (status === "REQUEST_MORE_DETAILS") return "More details needed";
  return "Uploaded — under review";
}

function statusColors(status?: string | null) {
  if (!status) return { bg: "#F1F5F9", text: "#64748B" };
  if (status === "APPROVED") return { bg: "#DCFCE7", text: "#166534" };
  if (status === "REJECTED") return { bg: "#FEE2E2", text: "#991B1B" };
  return { bg: "#FEF3C7", text: "#92400E" };
}

function fileNameFromUrl(url: string) {
  try {
    const path = url.split("?")[0];
    return decodeURIComponent(path.split("/").pop() || "Document");
  } catch {
    return "Document";
  }
}

export function UploadedDocumentCard({
  title,
  status,
  fileUrl,
  apiClient,
}: {
  title: string;
  status?: string | null;
  fileUrl?: string | null;
  apiClient?: ApiClient;
}) {
  const storedUrl = normalizeFileUrl(fileUrl || "");
  const [viewUrl, setViewUrl] = useState("");
  const [loadingUrl, setLoadingUrl] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      if (!storedUrl) {
        setViewUrl("");
        return;
      }
      if (!needsPrivateFileUrl(storedUrl)) {
        setViewUrl(storedUrl);
        return;
      }
      setLoadingUrl(true);
      try {
        const url = await resolveViewUrl(fileUrl || storedUrl, apiClient);
        if (!cancelled) setViewUrl(url);
      } catch {
        if (!cancelled) setViewUrl("");
      } finally {
        if (!cancelled) setLoadingUrl(false);
      }
    }
    resolve();
    return () => {
      cancelled = true;
    };
  }, [fileUrl, storedUrl, apiClient]);

  if (!status && !fileUrl) {
    return (
      <View style={[styles.card, styles.cardDashed]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>Not uploaded yet</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: "#F1F5F9" }]}>
            <Text style={[styles.badgeText, { color: "#64748B" }]}>Not uploaded</Text>
          </View>
        </View>
      </View>
    );
  }

  const badge = statusColors(status);
  const url = viewUrl || (!needsPrivateFileUrl(storedUrl) ? storedUrl : "");

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {fileNameFromUrl(storedUrl || title)}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.badgeText, { color: badge.text }]}>
            {statusLabel(status)}
          </Text>
        </View>
      </View>

      {loadingUrl && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#64748B" />
          <Text style={styles.loadingText}>Preparing secure preview…</Text>
        </View>
      )}

      {storedUrl && isImageUrl(storedUrl) && !loadingUrl && (
        <SignedImage
          fileUrl={fileUrl || storedUrl}
          apiClient={apiClient}
          style={styles.previewImage}
          resizeMode="contain"
        />
      )}

      {storedUrl && isPdfUrl(storedUrl) && (
        <View style={styles.pdfNote}>
          <Text style={styles.pdfNoteText}>PDF document on file</Text>
        </View>
      )}

      {url && !loadingUrl && (
        <TouchableOpacity onPress={() => openFileUrl(fileUrl || storedUrl, apiClient)}>
          <Text style={styles.viewLink}>View uploaded file</Text>
        </TouchableOpacity>
      )}

      {!url && !loadingUrl && storedUrl && needsPrivateFileUrl(storedUrl) && (
        <Text style={styles.errorText}>
          Could not prepare file link. Refresh and try again.
        </Text>
      )}

      {status && status !== "REJECTED" && (
        <Text style={styles.savedNote}>Saved — this stays after you refresh</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    padding: 16,
    gap: 12,
  },
  cardDashed: {
    borderStyle: "dashed",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0F172A",
  },
  subtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748B",
  },
  previewImage: {
    width: "100%",
    height: 180,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  pdfNote: {
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pdfNoteText: {
    fontSize: 13,
    color: "#475569",
  },
  viewLink: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2563EB",
  },
  errorText: {
    fontSize: 13,
    color: "#DC2626",
  },
  savedNote: {
    fontSize: 12,
    color: "#15803D",
  },
});
