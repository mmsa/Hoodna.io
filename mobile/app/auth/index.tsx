import { View, Text, StyleSheet, ImageBackground } from "react-native";
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
      <ImageBackground
        source={require("@/assets/marketing/compound-street.jpg")}
        style={styles.hero}
        imageStyle={styles.heroImage}
      >
        <View style={styles.scrim} />
        <View style={styles.brand}>
          <BrandWordmark tone="light" />
          <Text accessibilityRole="header" style={styles.title}>{t("brand.taglineLong")}</Text>
          <Text style={styles.subtitle}>{t("brand.taglineAuth")}</Text>
        </View>
      </ImageBackground>
      <View style={styles.actions}>
        <Button accessibilityLabel={t("auth.continueWithPhone")} onPress={() => router.push("/auth/phone-login")} size="large">
          {t("auth.continueWithPhone")}
        </Button>
        <Button accessibilityLabel={t("auth.signInWithEmail")} onPress={() => router.push("/auth/login")} size="large" variant="outline">
          {t("auth.signInWithEmail")}
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
  screen: { paddingTop: 0, paddingHorizontal: 0 },
  hero: { minHeight: 360, justifyContent: "flex-end", padding: spacing[6] },
  heroImage: { resizeMode: "cover" },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(16,33,30,0.55)" },
  brand: { marginBottom: spacing[2] },
  title: { color: "#FFFFFF", fontSize: 32, lineHeight: 40, fontWeight: "700", letterSpacing: -0.5, marginTop: spacing[4] },
  subtitle: { color: "rgba(255,255,255,0.88)", fontSize: 16, lineHeight: 24, marginTop: spacing[3] },
  actions: { gap: spacing[3], paddingHorizontal: spacing[4], marginTop: spacing[6] },
  terms: { color: "#A3A3A3", fontSize: 12, lineHeight: 16, textAlign: "center", marginTop: spacing[6], paddingHorizontal: spacing[4] },
});
