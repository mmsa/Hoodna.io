import React, { type ReactNode } from "react";
import { StyleSheet, Text, View, type ViewProps } from "react-native";
import { spacing, typography } from "@hoodna/tokens";

import { colors } from "@/constants/colors";

export interface ScreenHeaderProps extends ViewProps {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export function ScreenHeader({
  title,
  subtitle,
  leading,
  trailing,
  style,
  ...props
}: ScreenHeaderProps) {
  return (
    <View style={[styles.container, style]} {...props}>
      {leading ? <View style={styles.accessory}>{leading}</View> : null}
      <View style={styles.copy}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {trailing ? <View style={styles.accessory}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[3],
    paddingVertical: spacing[2],
  },
  accessory: {
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: typography.size.title,
    lineHeight: typography.lineHeight.title,
    fontWeight: typography.weight.semibold,
  },
  subtitle: {
    marginTop: spacing[1],
    color: colors.textSecondary,
    fontSize: typography.size.bodySmall,
    lineHeight: typography.lineHeight.bodySmall,
  },
});
