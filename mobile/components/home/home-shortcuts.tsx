import { Ionicons } from "@expo/vector-icons";
import { palette, radii, spacing, typography } from "@hoodna/tokens";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppPressable } from "@/components/ui";
import { colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { isPlatformStaff } from "@/lib/resident-routing";

const BASE_SHORTCUTS = [
  {
    key: "search",
    label: "Search",
    icon: "search-outline" as const,
    href: "/search",
  },
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
  const { user } = useAuth();

  const shortcuts = useMemo(() => {
    if (!isPlatformStaff(user?.role)) return [...BASE_SHORTCUTS];
    return [
      {
        key: "admin",
        label: "Admin",
        icon: "shield-outline" as const,
        href: "/admin/dashboard",
      },
      ...BASE_SHORTCUTS,
    ];
  }, [user?.role]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>What do you need?</Text>
      <View style={styles.row}>
        {shortcuts.map((item) => (
          <AppPressable
            key={item.key}
            accessibilityLabel={item.label}
            accessibilityRole="button"
            onPress={() => router.push(item.href as any)}
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
    flexWrap: "wrap",
    gap: spacing[3],
  },
  tile: {
    flexGrow: 1,
    flexBasis: "22%",
    minWidth: 72,
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
