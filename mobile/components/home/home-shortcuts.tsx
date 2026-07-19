import { Ionicons } from "@expo/vector-icons";
import { palette, radii, spacing, typography } from "@hoodna/tokens";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { AppPressable } from "@/components/ui";
import { colors } from "@/constants/colors";

const SHORTCUTS = [
  {
    key: "market",
    label: "Marketplace",
    icon: "bag-handle-outline" as const,
    href: "/(tabs)/market",
  },
  {
    key: "services",
    label: "Services",
    icon: "construct-outline" as const,
    href: "/(tabs)/services",
  },
  {
    key: "chat",
    label: "Chat",
    icon: "chatbubble-ellipses-outline" as const,
    href: "/(tabs)/messages",
  },
] as const;

export function HomeShortcuts() {
  const router = useRouter();

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>What do you need?</Text>
      <View style={styles.row}>
        {SHORTCUTS.map((item) => (
          <AppPressable
            key={item.key}
            accessibilityLabel={item.label}
            accessibilityRole="button"
            onPress={() => router.push(item.href)}
            pressedStyle={styles.pressed}
            style={styles.tile}
          >
            <View style={styles.iconWrap}>
              <Ionicons color={colors.primary} name={item.icon} size={28} />
            </View>
            <Text style={styles.label}>{item.label}</Text>
          </AppPressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    paddingBottom: spacing[2],
    backgroundColor: palette.surface,
  },
  heading: {
    color: colors.textMain,
    fontSize: typography.size.titleSmall,
    lineHeight: typography.lineHeight.titleSmall,
    fontWeight: typography.weight.bold,
    marginBottom: spacing[4],
  },
  row: {
    flexDirection: "row",
    gap: spacing[3],
  },
  tile: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surfaceMuted,
    borderRadius: radii.xl,
    paddingVertical: spacing[5],
    paddingHorizontal: spacing[2],
    minHeight: 112,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surface,
    marginBottom: spacing[2],
  },
  label: {
    color: colors.textMain,
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
    textAlign: "center",
  },
});
