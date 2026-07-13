import { useState, useEffect } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { palette, spacing, typography } from "@hoodna/tokens";

import { Button, KeyboardScreen, TextField } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE_URL } from "@/lib/config";
import { getPostAuthRoute } from "@/lib/resident-routing";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { apiClient, login, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.replace(getPostAuthRoute(user) as any);
    }
  }, [user, router]);

  async function handleLogin() {
    if (!email.trim()) {
      Alert.alert("Error", "Please enter your email");
      return;
    }
    if (!password.trim()) {
      Alert.alert("Error", "Please enter your password");
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.login({
        email: email.trim().toLowerCase(),
        password,
      });
      await login(response.access_token, response.refresh_token);
    } catch (error: any) {
      let errorMessage = error.message || "Invalid email or password";
      if (
        errorMessage.includes("Cannot connect") ||
        errorMessage.includes("Network error") ||
        errorMessage.includes("timed out")
      ) {
        errorMessage = `${errorMessage}\n\nAPI URL: ${API_BASE_URL}\n\nMake sure:\n• Backend is running\n• Phone and computer are on same WiFi\n• IP address matches mobile/.env`;
      }
      Alert.alert("Error", errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardScreen contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          Welcome back
        </Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>
      </View>

      <View style={styles.form}>
        <TextField
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          keyboardType="email-address"
          label="Email"
          onChangeText={setEmail}
          placeholder="you@example.com"
          value={email}
        />
        <TextField
          autoCapitalize="none"
          autoCorrect={false}
          label="Password"
          onChangeText={setPassword}
          placeholder="Your password"
          secureTextEntry={!showPassword}
          value={password}
        />
        <Button onPress={() => setShowPassword((v) => !v)} size="small" variant="ghost">
          {showPassword ? "Hide password" : "Show password"}
        </Button>
      </View>

      <View style={styles.actions}>
        <Button loading={loading} loadingLabel="Signing in…" onPress={handleLogin} size="large">
          Sign in
        </Button>
        <Button onPress={() => router.push("/auth/forgot-password")} variant="ghost">
          Forgot password?
        </Button>
        <Button onPress={() => router.push("/auth/phone-login")} variant="outline">
          Continue with phone
        </Button>
      </View>

      <Text style={styles.footer}>
        Don&apos;t have an account?{" "}
        <Text onPress={() => router.push("/auth/signup")} style={styles.link}>
          Sign up
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
    color: palette.inkMuted,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
    marginTop: spacing[2],
  },
  form: { gap: spacing[3], marginBottom: spacing[4] },
  actions: { gap: spacing[3] },
  footer: {
    color: palette.inkMuted,
    fontSize: typography.size.bodySmall,
    marginTop: spacing[6],
    textAlign: "center",
  },
  link: { color: palette.primary, fontWeight: typography.weight.semibold },
});
