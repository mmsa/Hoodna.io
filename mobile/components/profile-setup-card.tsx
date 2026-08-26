import { useEffect, useState } from "react";
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
import { formatPhoneDisplay } from "@hoodna/shared";
import { palette, radii, spacing, typography } from "@hoodna/tokens";

import { colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "@/contexts/LocaleContext";
import { getPostAuthRoute } from "@/lib/resident-routing";

type ImportChoice = "KEEP" | "DISCARD" | null;

export function ProfileSetupCard() {
  const { user, apiClient, refreshUser } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const [name, setName] = useState(
    user?.name && !user.name.startsWith("phone_") ? user.name : "",
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [importChoice, setImportChoice] = useState<ImportChoice>(null);
  const [importSummary, setImportSummary] = useState<{
    needs_choice: boolean;
    posts: number;
    comments: number;
    listings: number;
    total: number;
  } | null>(null);

  const needsImportChoice =
    Boolean(user?.needs_imported_content_choice) ||
    Boolean(importSummary?.needs_choice);

  useEffect(() => {
    if (!user?.needs_profile_setup) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiClient.getImportedContentSummary();
        if (!cancelled) setImportSummary(data);
      } catch {
        if (!cancelled) {
          setImportSummary({
            needs_choice: Boolean(user?.needs_imported_content_choice),
            posts: 0,
            comments: 0,
            listings: 0,
            total: 0,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.needs_profile_setup, user?.needs_imported_content_choice, apiClient]);

  if (!user?.needs_profile_setup) return null;

  async function handleSave() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      Alert.alert(t("profileSetup.nameRequired"));
      return;
    }
    if (password.length < 8) {
      Alert.alert(t("profileSetup.passwordTooShort"));
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(t("profileSetup.passwordsMismatch"));
      return;
    }
    if (needsImportChoice && !importChoice) {
      Alert.alert(t("profileSetup.choiceRequired"));
      return;
    }

    setSaving(true);
    try {
      const refreshed = await apiClient.completeProfile({
        name: trimmed,
        password,
        ...(importChoice ? { imported_content_choice: importChoice } : {}),
      });
      await refreshUser();
      Alert.alert(t("profileSetup.successTitle"), t("profileSetup.successDesc"));
      router.replace(
        getPostAuthRoute({ ...refreshed, needs_profile_setup: false }) as any,
      );
    } catch (error: any) {
      Alert.alert(t("profileSetup.saveFailed"), error?.message || "Try again.");
    } finally {
      setSaving(false);
    }
  }

  const phoneDisplay = formatPhoneDisplay(user.phone) || user.phone;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t("profileSetup.title")}</Text>
      <Text style={styles.body}>{t("profileSetup.subtitle")}</Text>
      {user.phone ? (
        <View style={styles.field}>
          <Text style={styles.label}>{t("profileSetup.phone")}</Text>
          <Text style={styles.phone}>{phoneDisplay}</Text>
        </View>
      ) : null}
      <View style={styles.field}>
        <Text style={styles.label}>{t("profileSetup.fullName")}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t("profileSetup.namePlaceholder")}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>{t("profileSetup.password")}</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder={t("profileSetup.passwordPlaceholder")}
          placeholderTextColor={colors.textMuted}
          secureTextEntry
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>{t("profileSetup.confirmPassword")}</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder={t("profileSetup.confirmPasswordPlaceholder")}
          placeholderTextColor={colors.textMuted}
          secureTextEntry
        />
      </View>

      {needsImportChoice ? (
        <View style={styles.importBox}>
          <Text style={styles.importTitle}>{t("profileSetup.importTitle")}</Text>
          <Text style={styles.importBody}>{t("profileSetup.importBody")}</Text>
          {importSummary && importSummary.total > 0 ? (
            <Text style={styles.importCounts}>
              {t("profileSetup.importCounts", {
                posts: importSummary.posts,
                comments: importSummary.comments,
                listings: importSummary.listings,
              })}
            </Text>
          ) : null}
          <TouchableOpacity
            style={[
              styles.choice,
              importChoice === "KEEP" && styles.choiceKeepActive,
            ]}
            onPress={() => setImportChoice("KEEP")}
          >
            <Text style={styles.choiceLabel}>{t("profileSetup.keepLabel")}</Text>
            <Text style={styles.choiceHint}>{t("profileSetup.keepHint")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.choice,
              importChoice === "DISCARD" && styles.choiceDiscardActive,
            ]}
            onPress={() => {
              Alert.alert(
                t("profileSetup.discardConfirmTitle"),
                t("profileSetup.discardConfirmBody"),
                [
                  { text: t("common.cancel"), style: "cancel" },
                  {
                    text: t("profileSetup.discardLabel"),
                    style: "destructive",
                    onPress: () => setImportChoice("DISCARD"),
                  },
                ],
              );
            }}
          >
            <Text style={styles.choiceLabel}>{t("profileSetup.discardLabel")}</Text>
            <Text style={styles.choiceHint}>{t("profileSetup.discardHint")}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.button}
        disabled={saving}
        onPress={() => void handleSave()}
      >
        {saving ? (
          <ActivityIndicator color={palette.onPrimary} />
        ) : (
          <Text style={styles.buttonText}>{t("profileSetup.saveContinue")}</Text>
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
  importBox: {
    gap: spacing[2],
    padding: spacing[3],
    borderRadius: radii.medium,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  importTitle: {
    color: colors.textMain,
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.bold,
  },
  importBody: {
    color: colors.textSecondary,
    fontSize: typography.size.caption,
    lineHeight: 18,
  },
  importCounts: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: typography.weight.semibold,
  },
  choice: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.medium,
    padding: spacing[3],
    gap: 4,
  },
  choiceKeepActive: {
    borderColor: colors.primary,
    backgroundColor: palette.primarySoft,
  },
  choiceDiscardActive: {
    borderColor: colors.error,
    backgroundColor: "#FEF2F2",
  },
  choiceLabel: {
    color: colors.textMain,
    fontSize: typography.size.bodySmall,
    fontWeight: typography.weight.semibold,
  },
  choiceHint: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
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
