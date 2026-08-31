import { useState, useEffect } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { palette, spacing, typography } from "@hoodna/tokens";

import { Button, KeyboardScreen, TextField } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/LocaleContext";
import { API_BASE_URL } from "@/lib/config";
import { getPostAuthRoute } from "@/lib/resident-routing";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { apiClient, login, user } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    if (user) {
      router.replace(getPostAuthRoute(user) as any);
    }
  }, [user, router]);

  async function handleLogin() {
    if (!email.trim()) {
      Alert.alert(t("common.error"), t("auth.enterEmailOrPhone"));
      return;
    }
    if (!password.trim()) {
      Alert.alert(t("common.error"), t("auth.enterPassword"));
      return;
    }

    setLoading(true);
    try {
      const identifier = email.trim();
      const response = await apiClient.login({
        email: identifier.includes("@") ? identifier.toLowerCase() : identifier,
        password,
      });
      await login(response.access_token, response.refresh_token);
    } catch (error: any) {
      let errorMessage = error.message || t("auth.invalidCredentials");
      if (
        String(errorMessage).toLowerCase().includes("verification code") ||
        String(errorMessage).toLowerCase().includes("does not have a password")
      ) {
        errorMessage = t("auth.noPasswordSet");
      }
      if (
        errorMessage.includes("Cannot connect") ||
        errorMessage.includes("Network error") ||
        errorMessage.includes("timed out")
      ) {
        errorMessage = `${errorMessage}\n\nAPI URL: ${API_BASE_URL}`;
      }
      Alert.alert(t("common.error"), errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardScreen contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          {t("auth.welcomeBack")}
        </Text>
        <Text style={styles.subtitle}>{t("auth.signInSubtitle")}</Text>
        <Text style={[styles.subtitle, { marginTop: 12 }]}>{t("auth.importedAccountHint")}</Text>
      </View>

      <View style={styles.form}>
        <TextField
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          keyboardType="default"
          label={t("auth.emailOrPhone")}
          onChangeText={setEmail}
          placeholder={t("auth.emailOrPhonePlaceholder")}
          value={email}
        />
        <TextField
          autoCapitalize="none"
          autoCorrect={false}
          label={t("auth.password")}
          onChangeText={setPassword}
          placeholder={t("auth.passwordPlaceholder")}
          secureTextEntry={!showPassword}
          value={password}
        />
        <Button onPress={() => setShowPassword((v) => !v)} size="small" variant="ghost">
          {showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
        </Button>
      </View>

      <View style={styles.actions}>
        <Button loading={loading} loadingLabel={t("auth.signingIn")} onPress={handleLogin} size="large">
          {t("auth.signIn")}
        </Button>
        <Button onPress={() => router.push("/auth/forgot-password")} variant="ghost">
          {t("auth.forgotPassword")}
        </Button>
        <Button onPress={() => router.push("/auth/phone-login")} variant="outline">
          {t("auth.continueWithPhone")}
        </Button>
      </View>

      <Text style={styles.footer}>
        {t("auth.noAccount")}{" "}
        <Text onPress={() => router.push("/auth/signup")} style={styles.link}>
          {t("auth.createAccountLink")}
        </Text>
      </Text>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: spacing[8] },
  header: { marginBottom: spacing[6] },
  title: {
    color: palette.ink,
    fontSize: typography.size.title,
    fontWeight: typography.weight.bold,
    lineHeight: typography.lineHeight.title,
  },
  subtitle: {
    marginTop: spacing[1],
    color: palette.inkMuted,
    fontSize: typography.size.bodySmall,
    lineHeight: typography.lineHeight.bodySmall,
  },
  form: { gap: spacing[4], marginBottom: spacing[6] },
  actions: { gap: spacing[3] },
  footer: {
    marginTop: spacing[8],
    textAlign: "center",
    color: palette.inkMuted,
    fontSize: typography.size.bodySmall,
  },
  link: { color: palette.primary, fontWeight: typography.weight.semibold },
});
