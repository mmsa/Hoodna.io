import { Platform, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";

import { useTranslation } from "@/contexts/LocaleContext";

export function resolveVersionLabel(): string {
  const version = Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? "0.0.0";
  const build =
    Constants.nativeBuildVersion ||
    (Platform.OS === "ios"
      ? Constants.expoConfig?.ios?.buildNumber
      : Constants.expoConfig?.android?.versionCode != null
        ? String(Constants.expoConfig.android.versionCode)
        : undefined);

  return build ? `${version} (${build})` : version;
}

const WHATS_NEW_KEYS = [
  "settings.aboutChange1",
  "settings.aboutChange2",
  "settings.aboutChange3",
] as const;

/** Version and release notes live in Settings → About, not as a floating overlay. */
export function AboutAppCard() {
  const { t } = useTranslation();
  const version = resolveVersionLabel();

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t("settings.aboutTitle")}</Text>
      <Text style={styles.version}>{t("settings.aboutVersion", { version })}</Text>
      <Text style={styles.whatsNew}>{t("settings.aboutWhatsNew")}</Text>
      {WHATS_NEW_KEYS.map((key) => (
        <View key={key} style={styles.row}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.change}>{t(key)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  version: {
    color: "#6B7280",
    marginTop: 6,
    fontSize: 14,
  },
  whatsNew: {
    color: "#111827",
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 8,
  },
  bullet: {
    color: "#158074",
    fontSize: 16,
    lineHeight: 20,
  },
  change: {
    flex: 1,
    color: "#374151",
    fontSize: 14,
    lineHeight: 20,
  },
});
