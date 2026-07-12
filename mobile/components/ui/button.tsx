import React, { type ReactNode } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { palette, radii, spacing, touchTarget, typography } from "@hoodna/tokens";

import { colors } from "@/constants/colors";
import { AppPressable, type AppPressableProps } from "./app-pressable";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "small" | "medium" | "large";

export interface ButtonProps extends Omit<AppPressableProps, "children"> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingLabel?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  textStyle?: StyleProp<TextStyle>;
}

const variantStyles: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: palette.primarySoft },
  outline: {
    backgroundColor: palette.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
  },
  ghost: { backgroundColor: "transparent" },
  danger: { backgroundColor: colors.error },
};

const variantTextStyles: Record<ButtonVariant, TextStyle> = {
  primary: { color: palette.onPrimary },
  secondary: { color: colors.primaryDark },
  outline: { color: colors.text },
  ghost: { color: colors.primary },
  danger: { color: palette.onPrimary },
};

const sizeStyles: Record<ButtonSize, ViewStyle> = {
  small: { minHeight: touchTarget, paddingHorizontal: spacing[3] },
  medium: { minHeight: 48, paddingHorizontal: spacing[4] },
  large: { minHeight: 52, paddingHorizontal: spacing[5] },
};

export function Button({
  children,
  variant = "primary",
  size = "medium",
  loading = false,
  loadingLabel = "Loading",
  leading,
  trailing,
  disabled,
  style,
  textStyle,
  accessibilityLabel,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const foreground = variantTextStyles[variant].color as string;

  return (
    <AppPressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      pressedStyle={styles.pressed}
      style={[styles.base, variantStyles[variant], sizeStyles[size], style]}
      {...props}
    >
      <View style={styles.content}>
        {loading ? (
          <>
            <ActivityIndicator color={foreground} size="small" />
            <Text style={[styles.label, variantTextStyles[variant], textStyle]}>
              {loadingLabel}
            </Text>
          </>
        ) : (
          <>
            {leading}
            <Text style={[styles.label, variantTextStyles[variant], textStyle]}>
              {children}
            </Text>
            {trailing}
          </>
        )}
      </View>
    </AppPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.full,
    justifyContent: "center",
    shadowColor: palette.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
  },
  label: {
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
    fontWeight: typography.weight.semibold,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.78,
  },
});
