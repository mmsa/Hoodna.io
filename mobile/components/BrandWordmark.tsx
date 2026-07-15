import { View, Text, StyleSheet } from "react-native"
import { brand, palette, typography } from "@hoodna/tokens"

type BrandWordmarkProps = {
  variant?: "header" | "auth"
  compact?: boolean
}

export function BrandWordmark({ variant = "header", compact = false }: BrandWordmarkProps) {
  if (variant === "auth") {
    return (
      <View style={styles.authStack}>
        <Text style={styles.authLatin}>{brand.nameLatin}</Text>
        <Text style={styles.authArabic} accessibilityLabel={brand.nameArabic}>
          {brand.nameArabic}
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.headerStack}>
      <View style={styles.latinRow}>
        <Text style={[styles.latin, compact && styles.latinCompact]}>{brand.nameLatin}</Text>
        <Text style={[styles.domain, compact && styles.domainCompact]}>{brand.domain}</Text>
      </View>
      <Text style={[styles.arabic, compact && styles.arabicCompact]} accessibilityLabel={brand.nameArabic}>
        {brand.nameArabic}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  headerStack: {
    flexDirection: "column",
    gap: 1,
    direction: "ltr",
  },
  latinRow: {
    flexDirection: "row",
    alignItems: "baseline",
    direction: "ltr",
  },
  latin: {
    fontSize: typography.size.titleSmall,
    fontWeight: typography.weight.bold,
    color: palette.onPrimary,
    letterSpacing: -0.3,
  },
  latinCompact: {
    fontSize: 18,
  },
  domain: {
    fontSize: 20,
    fontWeight: "700",
    color: palette.onPrimary,
    letterSpacing: -0.3,
  },
  domainCompact: {
    fontSize: 18,
  },
  arabic: {
    fontSize: 11,
    fontWeight: typography.weight.semibold,
    color: "rgba(255,255,255,0.88)",
    lineHeight: 14,
    textAlign: "left",
  },
  arabicCompact: {
    fontSize: 10,
    lineHeight: 12,
  },
  authStack: {
    gap: 4,
    marginBottom: 24,
    direction: "ltr",
  },
  authLatin: {
    color: palette.primary,
    fontSize: typography.size.titleSmall,
    fontWeight: typography.weight.bold,
  },
  authArabic: {
    color: palette.primary,
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
    opacity: 0.9,
    textAlign: "left",
  },
})
