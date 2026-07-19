import { palette, spacing, typography } from "@hoodna/tokens";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { ApiClient } from "@hoodna/shared";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SignedImage } from "@/components/signed-image";
import { formatCompoundName } from "@/utils/formatCompound";

interface CompoundHeroProps {
  compoundName: string;
  compoundArea?: string | null;
  heroImageUrl?: string | null;
  apiClient?: ApiClient;
  /** Kept for call-site compatibility; stats are intentionally not shown. */
  totalNeighbors?: number;
  recentPosts?: number;
  recentListings?: number;
}

export function CompoundHero({
  compoundName,
  compoundArea,
  heroImageUrl,
  apiClient,
}: CompoundHeroProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { height: 200 + insets.top }]}>
      {heroImageUrl ? (
        <SignedImage
          apiClient={apiClient}
          fileUrl={heroImageUrl}
          resizeMode="cover"
          style={styles.image}
        />
      ) : (
        <View style={styles.placeholder}>
          <Ionicons name="leaf-outline" size={48} color="rgba(255,255,255,0.55)" />
        </View>
      )}

      <View style={styles.scrim} />

      <TouchableOpacity
        accessibilityLabel="Notifications"
        accessibilityRole="button"
        hitSlop={12}
        onPress={() => router.push("/notifications")}
        style={[styles.bell, { top: insets.top + spacing[2] }]}
      >
        <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
      </TouchableOpacity>

      <View style={styles.content}>
        <Text accessibilityRole="header" numberOfLines={2} style={styles.title}>
          {formatCompoundName(compoundName)}
        </Text>
        <Text numberOfLines={1} style={styles.subtitle}>
          {compoundArea?.trim() ? compoundArea : "Your neighbourhood"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    backgroundColor: palette.primary,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.38)",
  },
  bell: {
    position: "absolute",
    top: spacing[3],
    right: spacing[4],
    zIndex: 2,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    position: "absolute",
    left: spacing[5],
    right: spacing[5],
    bottom: spacing[6],
    alignItems: "center",
  },
  title: {
    color: "#FFFFFF",
    fontSize: typography.size.display,
    lineHeight: typography.lineHeight.display,
    fontWeight: typography.weight.bold,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: spacing[1],
    color: "rgba(255,255,255,0.9)",
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.medium,
    textAlign: "center",
  },
});
