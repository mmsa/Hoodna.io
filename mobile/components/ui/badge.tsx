import React from "react";
import { StyleSheet, Text, View, type ViewProps } from "react-native";
import { palette, radii, spacing, typography } from "@hoodna/tokens";

import { colors } from "@/constants/colors";

export type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

export interface BadgeProps extends ViewProps {
  label: string;
  tone?: BadgeTone;
}

const backgrounds: Record<BadgeTone, string> = {
  neutral: palette.surfaceMuted,
  primary: palette.primarySoft,
  success: palette.successSoft,
  warning: palette.warningSoft,
  danger: palette.dangerSoft,
  info: palette.infoSoft,
};

const foregrounds: Record<BadgeTone, string> = {
  neutral: colors.textSecondary,
  primary: colors.primaryDark,
  success: colors.success,
  warning: palette.warning,
  danger: colors.error,
  info: palette.info,
};

export function Badge({
  label,
  tone = "neutral",
  style,
  ...props
}: BadgeProps) {
  return (
    <View
      accessibilityLabel={label}
      style={[styles.base, { backgroundColor: backgrounds[tone] }, style]}
      {...props}
    >
      <Text style={[styles.label, { color: foregrounds[tone] }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "flex-start",
    borderRadius: radii.small,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  label: {
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.semibold,
  },
});
