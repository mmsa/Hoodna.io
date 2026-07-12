import React, { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { spacing, typography } from "@hoodna/tokens";

import { colors } from "@/constants/colors";
import { AppPressable, type AppPressableProps } from "./app-pressable";

export interface ListRowProps extends Omit<AppPressableProps, "children"> {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  divider?: boolean;
}

export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  divider = false,
  onPress,
  style,
  accessibilityLabel,
  ...props
}: ListRowProps) {
  return (
    <AppPressable
      accessibilityLabel={accessibilityLabel || [title, subtitle].filter(Boolean).join(", ")}
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      pressedStyle={onPress ? styles.pressed : undefined}
      style={[styles.row, divider && styles.divider, style]}
      {...props}
    >
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={2} style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </AppPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing[3],
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  leading: {
    marginRight: spacing[3],
  },
  copy: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
    fontWeight: typography.weight.medium,
  },
  subtitle: {
    marginTop: spacing[1],
    color: colors.textSecondary,
    fontSize: typography.size.bodySmall,
    lineHeight: typography.lineHeight.bodySmall,
  },
  trailing: {
    marginLeft: spacing[3],
  },
  pressed: {
    opacity: 0.65,
  },
});
