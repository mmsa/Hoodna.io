import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { palette, radii, spacing, typography } from "@hoodna/tokens";

import { colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { getPostAuthRoute } from "@/lib/resident-routing";

export function ProfileSetupCard() {
  const { user, apiClient, refreshUser } = useAuth();
  const router = useRouter();
  const [name, setName] = useState(
    user?.name && !user.name.startsWith("phone_") ? user.name : "",
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  if (!user?.needs_profile_setup) return null;

  async function handleSave() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      Alert.alert("Name required", "Enter your full name.");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Password too short", "Use at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Passwords do not match");
      return;
    }

    setSaving(true);
    try {
      const refreshed = await apiClient.completeProfile({ name: trimmed, password });
      await refreshUser();
      Alert.alert("Profile complete", "You’re ready to use eljiran.");
      router.replace(getPostAuthRoute({ ...refreshed, needs_profile_setup: false }) as any);
    } catch (error: any) {
      Alert.alert("Could not save", error?.message || "Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Finish setting up your account</Text>
      <Text style={styles.body}>
        An admin invited you from the compound group chat. Add your name and choose a
        password to continue. Email is not required.
      </Text>
      {user.phone ? (
        <View style={styles.field}>
          <Text style={styles.label}>Phone</Text>
          <Text style={styles.phone}>{user.phone}</Text>
        </View>
      ) : null}
      <View style={styles.field}>
        <Text style={styles.label}>Full name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="At least 8 characters"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Confirm password</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Repeat password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
        />
      </View>
      <TouchableOpacity
        style={styles.button}
        disabled={saving}
        onPress={() => void handleSave()}
      >
        {saving ? (
          <ActivityIndicator color={palette.onPrimary} />
        ) : (
          <Text style={styles.buttonText}>Save and continue</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing[5],
    marginBottom: spacing[4],
    padding: spacing[4],
    borderRadius: radii.large,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: palette.primarySoft,
    gap: spacing[3],
  },
  title: {
    color: colors.textMain,
    fontSize: typography.size.titleSmall,
    fontWeight: typography.weight.bold,
  },
  body: {
    color: colors.textSecondary,
    fontSize: typography.size.bodySmall,
    lineHeight: typography.lineHeight.bodySmall,
  },
  field: { gap: spacing[1] },
  label: {
    color: colors.textMain,
    fontSize: 13,
    fontWeight: typography.weight.semibold,
  },
  phone: {
    color: colors.textSecondary,
    fontSize: typography.size.bodySmall,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.medium,
    paddingHorizontal: spacing[3],
    backgroundColor: palette.surface,
    color: colors.textMain,
  },
  button: {
    minHeight: 48,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    marginTop: spacing[1],
  },
  buttonText: {
    color: palette.onPrimary,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.bodySmall,
  },
});
