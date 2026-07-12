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
          {disabled ? "Posting opens after verification" : "What's happening nearby?"}
        </Text>
        <Ionicons color={colors.primary} name="create-outline" size={20} />
      </AppPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    backgroundColor: palette.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
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
});
