import { Platform, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import { usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function resolveVersionLabel(): string {
  const version = Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? "0.0.0";
  const build =
    Constants.nativeBuildVersion ||
    (Platform.OS === "ios"
      ? Constants.expoConfig?.ios?.buildNumber
      : Constants.expoConfig?.android?.versionCode != null
        ? String(Constants.expoConfig.android.versionCode)
        : undefined);

  return build ? `v${version} (${build})` : `v${version}`;
}

/** Tab bar is a fixed 72pt; keep this chip sitting just above it. */
const TAB_BAR_HEIGHT = 72;

export function AppVersionBadge() {
  let insets = { bottom: 8, right: 8 };
  try {
    insets = useSafeAreaInsets();
  } catch {
    // Root can mount before SafeAreaProvider on some release builds.
  }
  const label = resolveVersionLabel();
  const pathname = usePathname();
  // Tab routes have no "/auth" prefix; the badge must sit above the 72pt bar
  // or it paints on top of the Profile label.
  const onTabs =
    pathname === "/home" ||
    pathname === "/market" ||
    pathname === "/services" ||
    pathname === "/messages" ||
    pathname === "/profile" ||
    pathname.startsWith("/(tabs)");

  return (
    <View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          bottom: Math.max(insets.bottom, 8) + (onTabs ? TAB_BAR_HEIGHT : 0),
          right: Math.max(insets.right, 12),
        },
      ]}
    >
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    zIndex: 9999,
    backgroundColor: "rgba(249, 248, 241, 0.92)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
    letterSpacing: 0.2,
    color: "rgba(28, 25, 23, 0.55)",
  },
});
