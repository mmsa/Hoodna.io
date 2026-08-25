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

function SocialHero({ kind }: { kind: LinkHostKind }) {
  const theme = socialBrandTheme(kind);
  const iconName =
    kind === "facebook"
      ? ("logo-facebook" as const)
      : kind === "tiktok"
        ? ("logo-tiktok" as const)
        : kind === "instagram"
          ? ("logo-instagram" as const)
          : kind === "twitter"
            ? ("logo-twitter" as const)
            : ("link-outline" as const);

  return (
    <View
      style={[
        styles.socialHero,
        { backgroundColor: theme.bg },
      ]}
    >
      <View style={[styles.socialHeroWash, { backgroundColor: theme.bgEnd }]} />
      <Ionicons name={iconName} size={40} color="#FFFFFF" />
      <View style={styles.playCircle}>
        <Ionicons name="play" size={28} color="#111" style={{ marginLeft: 3 }} />
      </View>
      <Text style={styles.socialCta}>{socialWatchLabel(kind)}</Text>
    </View>
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
      description: "Opens in the app or browser",
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
  const isSocialFallback =
    !preview.image &&
    (kind === "facebook" ||
      kind === "tiktok" ||
      kind === "instagram" ||
      kind === "twitter");

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => Linking.openURL(url)}
      style={styles.card}
    >
      {preview.image ? (
        <View>
          <Image source={{ uri: preview.image }} style={styles.image} resizeMode="cover" />
          {(kind === "youtube" || kind === "facebook" || kind === "tiktok") && (
            <View style={styles.playOverlay}>
              <View style={styles.playCircleDark}>
                <Ionicons name="play" size={22} color="#fff" style={{ marginLeft: 2 }} />
              </View>
            </View>
          )}
        </View>
      ) : isSocialFallback ? (
        <SocialHero kind={kind} />
      ) : (
        <View style={styles.imageFallback}>
          <Ionicons name="link-outline" size={28} color={colors.primary} />
        </View>
      )}
      <View style={styles.metaRow}>
        <View style={styles.metaText}>
          <Text style={styles.site} numberOfLines={1}>
            {(preview.site_name || linkKindLabel(kind)).toUpperCase()}
          </Text>
          <Text style={styles.title} numberOfLines={1}>
            {isSocialFallback
              ? socialWatchLabel(kind)
              : preview.title || displayHostname(url)}
          </Text>
        </View>
        <View style={styles.openPill}>
          <Text style={styles.openPillText}>Open</Text>
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
  image: { width: "100%", height: 180, backgroundColor: colors.gray50 },
  imageFallback: {
    width: "100%",
    height: 112,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8F3F1",
  },
  socialHero: {
    width: "100%",
    height: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    overflow: "hidden",
  },
  socialHeroWash: {
    position: "absolute",
    right: -40,
    bottom: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    opacity: 0.35,
  },
  playCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
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
  socialCta: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
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
  openPill: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  openPillText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
