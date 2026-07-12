import { Link } from "expo-router";
import { palette, radii, spacing, typography } from "@hoodna/tokens";
import { StyleSheet, Text, View } from "react-native";
import type { ApiClient } from "@hoodna/shared";

import { SignedImage } from "@/components/signed-image";
import { Button } from "@/components/ui";
import { colors } from "@/constants/colors";
import { formatCompoundWithArea } from "@/utils/formatCompound";

interface CompoundHeroProps {
  compoundName: string;
  compoundArea?: string | null;
  heroImageUrl?: string | null;
  apiClient?: ApiClient;
}

export function CompoundHero({
  compoundName,
  compoundArea,
  heroImageUrl,
  apiClient,
}: CompoundHeroProps) {
  const title = formatCompoundWithArea(compoundName, compoundArea);

  return (
    <View style={styles.wrap}>
      <View style={styles.media}>
        {heroImageUrl ? (
          <SignedImage
            apiClient={apiClient}
            fileUrl={heroImageUrl}
            resizeMode="cover"
            style={styles.image}
          />
        ) : (
          <View style={[styles.image, styles.placeholder]} />
        )}
        <View style={styles.overlay} />
        <View style={styles.content}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{title}</Text>
          </View>
          <Text accessibilityRole="header" style={styles.title}>
            {compoundName}
          </Text>
          <Text style={styles.subtitle}>
            Community updates, help requests, and news from verified neighbours.
          </Text>
          <Link href="/(tabs)/market" asChild>
            <Button size="small" variant="accent" style={styles.cta}>
              Browse marketplace
            </Button>
          </Link>
        </View>
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
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  media: {
    position: "relative",
    minHeight: 168,
    backgroundColor: palette.primarySoft,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  placeholder: {
    backgroundColor: palette.primarySoft,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(21, 128, 116, 0.72)",
  },
  content: {
    padding: spacing[4],
    paddingTop: spacing[8],
    justifyContent: "flex-end",
    minHeight: 168,
  },
  chip: {
    alignSelf: "flex-start",
    borderRadius: radii.full,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    marginBottom: spacing[2],
  },
  chipText: {
    color: palette.onPrimary,
    fontSize: typography.size.caption,
    fontWeight: typography.weight.semibold,
  },
  title: {
    color: palette.onPrimary,
    fontSize: typography.size.title,
    lineHeight: typography.lineHeight.title,
    fontWeight: typography.weight.bold,
  },
  subtitle: {
    marginTop: spacing[1],
    color: "rgba(255,255,255,0.92)",
    fontSize: typography.size.bodySmall,
    lineHeight: typography.lineHeight.bodySmall,
  },
  cta: {
    marginTop: spacing[3],
    alignSelf: "flex-start",
  },
});
