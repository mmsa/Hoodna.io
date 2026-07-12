import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { palette, spacing, typography } from "@hoodna/tokens";
import { Button, KeyboardScreen } from "@/components/ui";

export default function AuthSelectionScreen() {
  const router = useRouter();

  return (
    <KeyboardScreen contentContainerStyle={styles.screen}>
      <View style={styles.brand}>
        <Text style={styles.wordmark}>eljiran</Text>
        <Text accessibilityRole="header" style={styles.title}>Your neighbourhood, connected.</Text>
        <Text style={styles.subtitle}>Sign in to reach the people and services around you.</Text>
      </View>
      <View style={styles.actions}>
        <Button accessibilityLabel="Sign in with email" onPress={() => router.push("/auth/login")} size="large">
          Sign in with email
        </Button>
        <Button accessibilityLabel="Continue with phone" onPress={() => router.push("/auth/phone-login")} size="large" variant="outline">
          Continue with phone
        </Button>
        <Button accessibilityLabel="Create an account" onPress={() => router.push("/auth/signup")} variant="ghost">
          New here? Create an account
        </Button>
      </View>
      <Text style={styles.terms}>By continuing, you agree to our Terms of Service.</Text>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: "center", paddingVertical: spacing[8] },
  brand: { marginBottom: spacing[10] },
  wordmark: { color: palette.primary, fontSize: typography.size.titleSmall, fontWeight: typography.weight.bold, marginBottom: spacing[6] },
  title: { color: palette.ink, fontSize: typography.size.display, lineHeight: typography.lineHeight.display, fontWeight: typography.weight.bold, letterSpacing: -0.5 },
  subtitle: { color: palette.inkMuted, fontSize: typography.size.body, lineHeight: typography.lineHeight.body, marginTop: spacing[3] },
  actions: { gap: spacing[3] },
  terms: { color: palette.inkSubtle, fontSize: typography.size.caption, lineHeight: typography.lineHeight.caption, textAlign: "center", marginTop: spacing[6] },
});
