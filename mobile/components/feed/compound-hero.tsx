import { palette, radii, spacing, typography } from "@hoodna/tokens";
import { StyleSheet, Text, View } from "react-native";
import type { ApiClient } from "@hoodna/shared";
import { Ionicons } from "@expo/vector-icons";

import { SignedImage } from "@/components/signed-image";
import { formatCompoundName } from "@/utils/formatCompound";

interface CompoundHeroProps {
  compoundName: string;
  compoundArea?: string | null;
  heroImageUrl?: string | null;
  apiClient?: ApiClient;
  totalNeighbors?: number;
  recentPosts?: number;
  recentListings?: number;
}

export function CompoundHero({
  compoundName,
  compoundArea,
  heroImageUrl,
  apiClient,
  totalNeighbors = 0,
  recentPosts = 0,
  recentListings = 0,
}: CompoundHeroProps) {
  const stats = [
    { icon: "people" as const, value: totalNeighbors, label: "Neighbours" },
    { icon: "chatbubbles" as const, value: recentPosts, label: "Posts" },
    { icon: "storefront" as const, value: recentListings, label: "Listings" },
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.compoundRow}>
        {heroImageUrl ? (
          <SignedImage
            apiClient={apiClient}
            fileUrl={heroImageUrl}
            resizeMode="cover"
            style={styles.backgroundImage}
          />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="business" size={36} color={palette.primary} />
          </View>
        )}
        <View style={styles.fade} />

        <View style={styles.content}>
          <Text accessibilityRole="header" numberOfLines={2} style={styles.title}>
            {formatCompoundName(compoundName)}
          </Text>
          <Text numberOfLines={1} style={styles.subtitle}>
            {compoundArea || "Your verified neighbourhood"}
          </Text>
          <View style={styles.verified}>
            <Ionicons name="shield-checkmark" size={13} color={palette.primary} />
            <Text style={styles.verifiedText}>Verified community</Text>
          </View>
        </View>
      </View>

      <View style={styles.stats}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.stat}>
            <Ionicons name={stat.icon} size={16} color={palette.primary} />
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing[4],
    marginTop: spacing[2],
    marginBottom: spacing[3],
    borderRadius: radii.large,
    overflow: "hidden",
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  compoundRow: {
    position: "relative",
    minHeight: 136,
    borderRadius: radii.medium,
    overflow: "hidden",
    backgroundColor: palette.primarySoft,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.primarySoft,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: spacing[6],
  },
  fade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.44)",
  },
  content: {
    position: "relative",
    width: "78%",
    minHeight: 136,
    justifyContent: "center",
    padding: spacing[4],
  },
  title: {
    color: "#FFFFFF",
    fontSize: typography.size.titleSmall,
    lineHeight: typography.lineHeight.titleSmall,
    fontWeight: typography.weight.bold,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  subtitle: {
    marginTop: 2,
    color: "rgba(255,255,255,0.88)",
    fontSize: typography.size.caption,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  verified: {
    marginTop: spacing[2],
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radii.full,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
  },
  verifiedText: {
    color: palette.primary,
    fontSize: 10,
    fontWeight: typography.weight.semibold,
  },
  stats: {
    flexDirection: "row",
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingBottom: spacing[3],
  },
  stat: {
    flex: 1,
    alignItems: "center",
    borderRadius: radii.medium,
    backgroundColor: palette.canvas,
    paddingVertical: spacing[2],
  },
  statValue: {
    marginTop: 3,
    color: palette.ink,
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
  },
  statLabel: {
    marginTop: 1,
    color: palette.inkMuted,
    fontSize: 9,
  },
});
