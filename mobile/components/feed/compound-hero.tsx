import { palette, radii, spacing, typography } from "@hoodna/tokens";
import { StyleSheet, Text, View } from "react-native";
import type { ApiClient } from "@hoodna/shared";
import { Ionicons } from "@expo/vector-icons";

import { SignedImage } from "@/components/signed-image";
import { formatCompoundWithArea } from "@/utils/formatCompound";

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
  const title = formatCompoundWithArea(compoundName, compoundArea);
  const stats = [
    { icon: "people" as const, value: totalNeighbors, label: "Neighbours" },
    { icon: "chatbubbles" as const, value: recentPosts, label: "Posts" },
    { icon: "storefront" as const, value: recentListings, label: "Listings" },
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.compoundRow}>
        <View style={styles.media}>
        {heroImageUrl ? (
          <SignedImage
            apiClient={apiClient}
            fileUrl={heroImageUrl}
            resizeMode="cover"
            style={styles.image}
          />
        ) : (
            <View style={[styles.image, styles.placeholder]}>
              <Ionicons name="business" size={28} color={palette.primary} />
            </View>
        )}
        </View>

        <View style={styles.content}>
          <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>
            {compoundName}
          </Text>
          <Text numberOfLines={1} style={styles.subtitle}>{title}</Text>
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
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    padding: spacing[3],
  },
  media: {
    width: 92,
    height: 72,
    borderRadius: radii.medium,
    overflow: "hidden",
    backgroundColor: palette.primarySoft,
  },
  image: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholder: {
    backgroundColor: palette.primarySoft,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: palette.ink,
    fontSize: typography.size.titleSmall,
    lineHeight: typography.lineHeight.titleSmall,
    fontWeight: typography.weight.bold,
  },
  subtitle: {
    marginTop: 2,
    color: palette.inkMuted,
    fontSize: typography.size.caption,
  },
  verified: {
    marginTop: spacing[2],
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radii.full,
    backgroundColor: palette.primarySoft,
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
