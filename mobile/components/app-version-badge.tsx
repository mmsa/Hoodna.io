import { Platform, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
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

export function AppVersionBadge() {
  let insets = { bottom: 8, right: 8 };
  try {
    insets = useSafeAreaInsets();
  } catch {
    // Root can mount before SafeAreaProvider on some release builds.
  }
  const label = resolveVersionLabel();

  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { bottom: Math.max(insets.bottom, 8), right: Math.max(insets.right, 8) }]}
    >
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    zIndex: 9999,
  },
  text: {
    fontSize: 10,
    color: "rgba(0,0,0,0.35)",
  },
});
