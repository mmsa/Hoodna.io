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
  isUrlOnlyContent,
  linkKindLabel,
  socialBrandTheme,
  socialWatchLabel,
  youtubeThumbnailUrl,
  type ApiClient,
  type LinkHostKind,
  type LinkPreviewData,
} from "@hoodna/shared";
import { colors } from "@/constants/colors";

export function LinkifiedText({ text, style }: { text: string; style?: any }) {
  const parts = useMemo(() => {
    if (isUrlOnlyContent(text)) return [];
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

  if (!parts.length) return null;

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

function platformIcon(kind: LinkHostKind) {
  if (kind === "facebook") return "logo-facebook" as const;
  if (kind === "tiktok") return "logo-tiktok" as const;
  if (kind === "instagram") return "logo-instagram" as const;
  if (kind === "twitter") return "logo-twitter" as const;
  if (kind === "youtube") return "logo-youtube" as const;
  return "link-outline" as const;
}

function CompactSocialLink({ url, kind }: { url: string; kind: LinkHostKind }) {
  const theme = socialBrandTheme(kind);
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => Linking.openURL(url)}
      style={styles.compactCard}
    >
      <View
        style={[
          styles.logoBadge,
          { backgroundColor: theme.bg },
        ]}
      >
        <Ionicons name={platformIcon(kind)} size={22} color="#FFFFFF" />
      </View>
      <View style={styles.compactMeta}>
        <Text style={styles.site} numberOfLines={1}>
          {linkKindLabel(kind).toUpperCase()}
        </Text>
        <Text style={styles.title} numberOfLines={1}>
          {socialWatchLabel(kind)}
        </Text>
        <Text style={styles.host} numberOfLines={1}>
          {displayHostname(url)}
        </Text>
      </View>
      <View style={styles.arrowBtn}>
        <Ionicons name="arrow-up-outline" size={16} color={colors.textMain} style={{ transform: [{ rotate: "45deg" }] }} />
      </View>
    </TouchableOpacity>
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
      title: socialWatchLabel(kind),
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

  const kind = preview.kind;
  const hasRealThumb = Boolean(preview.image);

  if (!hasRealThumb) {
    return <CompactSocialLink url={url} kind={kind} />;
  }

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => Linking.openURL(url)}
      style={styles.card}
    >
      <View>
        <Image source={{ uri: preview.image! }} style={styles.image} resizeMode="cover" />
        {(kind === "youtube" || kind === "facebook" || kind === "tiktok") && (
          <View style={styles.playOverlay}>
            <View style={styles.playCircleDark}>
              <Ionicons name="play" size={22} color="#fff" style={{ marginLeft: 2 }} />
            </View>
          </View>
        )}
      </View>
      <View style={styles.metaRow}>
        <View style={styles.metaText}>
          <Text style={styles.site} numberOfLines={1}>
            {(preview.site_name || linkKindLabel(kind)).toUpperCase()}
          </Text>
          <Text style={styles.title} numberOfLines={2}>
            {preview.title || displayHostname(url)}
          </Text>
        </View>
        <View style={styles.arrowBtn}>
          <Ionicons name="arrow-up-outline" size={16} color={colors.textMain} style={{ transform: [{ rotate: "45deg" }] }} />
        </View>
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
  compactCard: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundCard,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  compactMeta: { flex: 1, gap: 1 },
  host: { fontSize: 11, color: colors.textMuted },
  image: { width: "100%", height: 180, backgroundColor: colors.gray50 },
  playCircleDark: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  metaRow: {
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  metaText: { flex: 1, gap: 2 },
  site: { fontSize: 10, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.4 },
  title: { fontSize: 14, fontWeight: "700", color: colors.textMain },
  arrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
});
