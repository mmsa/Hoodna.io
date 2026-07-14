import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { palette, radii, spacing, typography } from "@hoodna/tokens";
import type { ApiClient } from "@hoodna/shared";

import { AppPressable, Avatar } from "@/components/ui";
import { colors } from "@/constants/colors";
import { useTranslation } from "@/contexts/LocaleContext";

interface FeedComposerProps {
  name: string;
  avatarUrl?: string | null;
  apiClient?: ApiClient;
  disabled?: boolean;
  onPress: () => void;
}

export function FeedComposer({
  name,
  avatarUrl,
  apiClient,
  disabled = false,
  onPress,
}: FeedComposerProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <View style={styles.promptRow}>
        <Avatar name={name} fileUrl={avatarUrl} apiClient={apiClient} size={40} />
        <AppPressable
          accessibilityHint={
            disabled ? t("feed.composerDisabled") : undefined
          }
          accessibilityLabel={t("feed.createPost")}
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onPress}
          pressedStyle={styles.pressed}
          style={styles.prompt}
        >
          <Text style={styles.promptText}>
            {disabled ? t("feed.composerDisabled") : t("feed.composerPrompt")}
          </Text>
        </AppPressable>
      </View>

      <View style={styles.actions}>
        {[
          { labelKey: "feed.ask" as const, icon: "help-circle" as const },
          { labelKey: "feed.report" as const, icon: "warning" as const },
          { labelKey: "feed.sell" as const, icon: "pricetag" as const },
          { labelKey: "feed.help" as const, icon: "heart" as const },
        ].map((action) => (
          <AppPressable
            key={action.labelKey}
            accessibilityLabel={t(action.labelKey)}
            disabled={disabled}
            onPress={onPress}
            pressedStyle={styles.pressed}
            style={styles.action}
          >
            <View style={styles.actionIcon}>
              <Ionicons color={colors.primary} name={action.icon} size={17} />
            </View>
            <Text style={styles.actionLabel}>{t(action.labelKey)}</Text>
          </AppPressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing[4],
    marginBottom: spacing[3],
    padding: spacing[3],
    backgroundColor: palette.surface,
    borderRadius: radii.large,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1,
  },
  promptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
  },
  prompt: {
    minHeight: 44,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radii.full,
    backgroundColor: palette.surfaceMuted,
    paddingHorizontal: spacing[4],
  },
  promptText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: typography.size.bodySmall,
    lineHeight: typography.lineHeight.bodySmall,
  },
  pressed: {
    backgroundColor: palette.surfacePressed,
  },
  actions: {
    marginTop: spacing[3],
    flexDirection: "row",
    gap: spacing[2],
  },
  action: {
    flex: 1,
    alignItems: "center",
    borderRadius: radii.medium,
    backgroundColor: palette.canvas,
    paddingVertical: spacing[2],
  },
  actionIcon: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: palette.primarySoft,
  },
  actionLabel: {
    marginTop: 4,
    color: palette.ink,
    fontSize: 10,
    fontWeight: typography.weight.semibold,
  },
});
