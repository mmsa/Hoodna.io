import React, { type ReactNode } from "react";
import { StyleSheet } from "react-native";
import { palette, radii, touchTarget } from "@hoodna/tokens";

import { colors } from "@/constants/colors";
import { AppPressable, type AppPressableProps } from "./app-pressable";

export interface IconButtonProps extends Omit<AppPressableProps, "children"> {
  icon: ReactNode;
  accessibilityLabel: string;
  variant?: "default" | "subtle" | "ghost";
}

export function IconButton({
  icon,
  variant = "default",
  style,
  ...props
}: IconButtonProps) {
  return (
    <AppPressable
      accessibilityRole="button"
      hitSlop={8}
      pressedStyle={styles.pressed}
      style={[
        styles.base,
        variant === "default" && styles.default,
        variant === "subtle" && styles.subtle,
        style,
      ]}
      {...props}
    >
      {icon}
    </AppPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: touchTarget,
    height: touchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.medium,
  },
  default: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: palette.surface,
  },
  subtle: {
    backgroundColor: palette.surfaceMuted,
  },
  pressed: {
    backgroundColor: palette.surfacePressed,
  },
});
