import type { ReactNode } from "react";
import { Image, StyleSheet, TouchableOpacity, View, type ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import { radii, spacing } from "@hoodna/tokens";

import { BrandWordmark } from "@/components/BrandWordmark";

type AppBrandBarProps = {
  tone?: "light" | "dark";
  compact?: boolean;
  trailing?: ReactNode;
  style?: ViewStyle;
};

export function AppBrandBar({
  tone = "dark",
  compact = false,
  trailing,
  style,
}: AppBrandBarProps) {
  const router = useRouter();

  return (
    <View style={[styles.bar, style]}>
      <TouchableOpacity
        accessibilityLabel="Go to home"
        accessibilityRole="button"
        activeOpacity={0.7}
        onPress={() => router.push("/(tabs)/home")}
        style={styles.brand}
      >
        <Image
          resizeMode="cover"
          source={require("@/assets/icon.png")}
          style={[styles.icon, compact && styles.iconCompact]}
        />
        <BrandWordmark compact={compact} tone={tone} />
      </TouchableOpacity>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
    gap: spacing[3],
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    flexShrink: 1,
    minWidth: 0,
    direction: "ltr",
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: radii.medium,
  },
  iconCompact: {
    width: 28,
    height: 28,
    borderRadius: 8,
  },
  trailing: {
    flexShrink: 0,
  },
});
