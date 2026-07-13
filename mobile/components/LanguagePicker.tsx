import { SUPPORTED_LOCALES, type SupportedLocale } from "@hoodna/i18n";
import { useTranslation } from "@/contexts/LocaleContext";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { palette, radii, spacing, typography } from "@hoodna/tokens";

const localeLabels: Record<SupportedLocale, string> = {
  en: "English",
  ar: "العربية",
};

export function LanguagePicker() {
  const { locale, setLocale, t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t("settings.language")}</Text>
      <Text style={styles.description}>{t("settings.languageDescription")}</Text>
      <View style={styles.options}>
        {SUPPORTED_LOCALES.map((option) => {
          const selected = locale === option;
          return (
            <TouchableOpacity
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                void setLocale(option).then(() => {
                  Alert.alert(t("settings.saved"), localeLabels[option]);
                });
              }}
              style={[styles.option, selected && styles.optionSelected]}
            >
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                {localeLabels[option]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[4],
    paddingBottom: spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  label: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.medium,
    color: "#6B7280",
    marginBottom: spacing[2],
  },
  description: {
    fontSize: typography.size.caption,
    color: "#9CA3AF",
    marginBottom: spacing[3],
  },
  options: {
    flexDirection: "row",
    gap: spacing[2],
  },
  option: {
    flex: 1,
    minHeight: 44,
    borderRadius: radii.medium,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[3],
  },
  optionSelected: {
    borderColor: palette.primary,
    backgroundColor: palette.primarySoft,
  },
  optionText: {
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
    color: "#374151",
  },
  optionTextSelected: {
    color: palette.primary,
  },
});
