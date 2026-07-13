import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "@/contexts/LocaleContext";
import { spacing } from "@hoodna/tokens";
import { BrandWordmark } from "@/components/BrandWordmark";
import { Button, KeyboardScreen } from "@/components/ui";

export default function AuthSelectionScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <KeyboardScreen contentContainerStyle={styles.screen}>
      <View style={styles.brand}>
        <BrandWordmark variant="auth" />
        <Text accessibilityRole="header" style={styles.title}>{t("brand.taglineLong")}</Text>
        <Text style={styles.subtitle}>{t("brand.taglineAuth")}</Text>
      </View>
      <View style={styles.actions}>
        <Button accessibilityLabel={t("auth.signInWithEmail")} onPress={() => router.push("/auth/login")} size="large">
          {t("auth.signInWithEmail")}
        </Button>
        <Button accessibilityLabel={t("auth.continueWithPhone")} onPress={() => router.push("/auth/phone-login")} size="large" variant="outline">
          {t("auth.continueWithPhone")}
        </Button>
        <Button accessibilityLabel={t("auth.createAccount")} onPress={() => router.push("/auth/signup")} variant="ghost">
          {t("auth.createAccount")}
        </Button>
      </View>
      <Text style={styles.terms}>{t("auth.terms")}</Text>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: "center", paddingVertical: spacing[8] },
  brand: { marginBottom: spacing[10] },
  title: { color: "#2D2D2A", fontSize: 32, lineHeight: 40, fontWeight: "700", letterSpacing: -0.5 },
  subtitle: { color: "#707070", fontSize: 16, lineHeight: 24, marginTop: spacing[3] },
  actions: { gap: spacing[3] },
  terms: { color: "#A3A3A3", fontSize: 12, lineHeight: 16, textAlign: "center", marginTop: spacing[6] },
});
