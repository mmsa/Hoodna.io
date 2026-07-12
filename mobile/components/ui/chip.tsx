import React, { type ReactNode } from "react";
import { StyleSheet, Text } from "react-native";
import { palette, radii, spacing, touchTarget, typography } from "@hoodna/tokens";

import { colors } from "@/constants/colors";
import { AppPressable, type AppPressableProps } from "./app-pressable";

export interface ChipProps extends Omit<AppPressableProps, "children"> {
  label: string;
  selected?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export function Chip({
  label,
  selected = false,
  leading,
  trailing,
  style,
  ...props
}: ChipProps) {
  return (
    <AppPressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      pressedStyle={styles.pressed}
      style={[styles.base, selected && styles.selected, style]}
      {...props}
    >
      {leading}
      <Text style={[styles.label, selected && styles.selectedLabel]}>
        {label}
      </Text>
      {trailing}
    </AppPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.medium,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing[3],
  },
  selected: {
    borderColor: colors.primary,
    backgroundColor: palette.primarySoft,
  },
  label: {
    color: colors.text,
    fontSize: typography.size.bodySmall,
    lineHeight: typography.lineHeight.bodySmall,
    fontWeight: typography.weight.medium,
  },
  selectedLabel: {
    color: colors.primaryDark,
  },
  pressed: {
    backgroundColor: palette.surfacePressed,
  },
});
