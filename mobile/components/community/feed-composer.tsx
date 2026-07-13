import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { palette, radii, spacing, typography } from "@hoodna/tokens";

import { AppPressable, Avatar } from "@/components/ui";
import { colors } from "@/constants/colors";

interface FeedComposerProps {
  name: string;
  disabled?: boolean;
  onPress: () => void;
}

export function FeedComposer({
  name,
  disabled = false,
  onPress,
}: FeedComposerProps) {
  return (
    <View style={styles.container}>
      <View style={styles.promptRow}>
        <Avatar name={name} size={40} />
        <AppPressable
          accessibilityHint={
            disabled ? "Complete verification to create a post" : undefined
          }
          accessibilityLabel="Create a community post"
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onPress}
          pressedStyle={styles.pressed}
          style={styles.prompt}
        >
          <Text style={styles.promptText}>
            {disabled ? "Posting opens after verification" : "What's happening in your neighbourhood?"}
          </Text>
        </AppPressable>
      </View>

      <View style={styles.actions}>
        {[
          { label: "Ask", icon: "help-circle" as const },
          { label: "Report", icon: "warning" as const },
          { label: "Sell", icon: "pricetag" as const },
          { label: "Help", icon: "heart" as const },
        ].map((action) => (
          <AppPressable
            key={action.label}
            accessibilityLabel={`${action.label} neighbours`}
            disabled={disabled}
            onPress={onPress}
            pressedStyle={styles.pressed}
            style={styles.action}
          >
            <View style={styles.actionIcon}>
              <Ionicons color={colors.primary} name={action.icon} size={17} />
            </View>
            <Text style={styles.actionLabel}>{action.label}</Text>
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
