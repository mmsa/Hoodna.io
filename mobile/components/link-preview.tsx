import { useEffect, useMemo, useState } from "react";
import {
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  classifyLinkHost,
  displayHostname,
  extractUrls,
  firstHttpUrl,
  linkKindLabel,
  youtubeThumbnailUrl,
  type ApiClient,
  type LinkPreviewData,
} from "@hoodna/shared";
import { colors } from "@/constants/colors";

export function LinkifiedText({ text, style }: { text: string; style?: any }) {
  const parts = useMemo(() => {
    const urls = extractUrls(text);
    if (!urls.length) return [{ type: "text" as const, value: text }];
    const out: Array<{ type: "text" | "url"; value: string }> = [];
    let remaining = text;
    for (const url of urls) {
      const idx = remaining.indexOf(url);
      if (idx === -1) continue;
      if (idx > 0) out.push({ type: "text", value: remaining.slice(0, idx) });
      out.push({ type: "url", value: url });
      remaining = remaining.slice(idx + url.length);
    }
    if (remaining) out.push({ type: "text", value: remaining });
    return out;
  }, [text]);

  return (
    <Text style={style}>
      {parts.map((part, i) =>
        part.type === "url" ? (
          <Text
            key={i}
            style={styles.link}
            onPress={() => Linking.openURL(part.value)}
          >
            {part.value}
          </Text>
        ) : (
          <Text key={i}>{part.value}</Text>
        ),
      )}
    </Text>
  );
}

export function LinkPreviewCard({
  text,
  apiClient,
}: {
  text: string;
  apiClient?: ApiClient;
}) {
  const url = firstHttpUrl(text);
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);

  useEffect(() => {
    if (!url) {
      setPreview(null);
      return;
    }
    const kind = classifyLinkHost(url);
    const local: LinkPreviewData = {
      url,
      kind,
      title: linkKindLabel(kind),
      description: displayHostname(url),
      site_name: linkKindLabel(kind),
      image: youtubeThumbnailUrl(url),
    };
    setPreview(local);

    let cancelled = false;
    (async () => {
      if (!apiClient?.getLinkPreview) return;
      try {
        const data = await apiClient.getLinkPreview(url);
        if (!cancelled) {
          setPreview({
            ...local,
            ...data,
            kind: (data.kind as LinkPreviewData["kind"]) || kind,
          });
        }
      } catch {
        // Keep fallback
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, apiClient]);

  if (!url || !preview) return null;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => Linking.openURL(url)}
      style={styles.card}
    >
      {preview.image ? (
        <Image source={{ uri: preview.image }} style={styles.image} resizeMode="cover" />
      ) : (
        <View style={styles.imageFallback}>
          <Ionicons name="link-outline" size={28} color={colors.primary} />
        </View>
      )}
      <View style={styles.meta}>
        <Text style={styles.site} numberOfLines={1}>
          {(preview.site_name || linkKindLabel(preview.kind)).toUpperCase()}
        </Text>
        <Text style={styles.title} numberOfLines={2}>
          {preview.title || displayHostname(url)}
        </Text>
        {preview.description ? (
          <Text style={styles.desc} numberOfLines={2}>
            {preview.description}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  link: { color: colors.primary, textDecorationLine: "underline" },
  card: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundCard,
    overflow: "hidden",
  },
  image: { width: "100%", height: 160, backgroundColor: colors.gray50 },
  imageFallback: {
    width: "100%",
    height: 112,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8F3F1",
  },
  meta: { padding: 12, gap: 4 },
  site: { fontSize: 10, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.4 },
  title: { fontSize: 14, fontWeight: "700", color: colors.textMain },
  desc: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
});
