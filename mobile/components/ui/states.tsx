import React, { type ReactNode } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type ViewProps,
} from "react-native";
import { spacing, typography } from "@hoodna/tokens";

import { colors } from "@/constants/colors";
import { Button } from "./button";

interface StateContainerProps extends ViewProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

function StateContainer({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  style,
  ...props
}: StateContainerProps) {
  return (
    <View style={[styles.container, style]} {...props}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <Button onPress={onAction} style={styles.action} variant="outline">
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}

export type EmptyStateProps = StateContainerProps;

export function EmptyState(props: EmptyStateProps) {
  return <StateContainer {...props} />;
}

export interface LoadingStateProps extends ViewProps {
  label?: string;
}

export function LoadingState({
  label = "Loading",
  style,
  ...props
}: LoadingStateProps) {
  return (
    <View
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      style={[styles.container, style]}
      {...props}
    >
      <ActivityIndicator color={colors.primary} size="small" />
      <Text style={styles.loadingLabel}>{label}</Text>
    </View>
  );
}

export interface ErrorStateProps
  extends Omit<StateContainerProps, "title" | "actionLabel" | "onAction"> {
  title?: string;
  retryLabel?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Something went wrong",
  retryLabel = "Try again",
  onRetry,
  ...props
}: ErrorStateProps) {
  return (
    <StateContainer
      accessibilityLiveRegion="polite"
      actionLabel={onRetry ? retryLabel : undefined}
      onAction={onRetry}
      title={title}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[6],
  },
  icon: {
    marginBottom: spacing[4],
  },
  title: {
    color: colors.text,
    fontSize: typography.size.titleSmall,
    lineHeight: typography.lineHeight.titleSmall,
    fontWeight: typography.weight.semibold,
    textAlign: "center",
  },
  description: {
    marginTop: spacing[2],
    maxWidth: 320,
    color: colors.textSecondary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
    textAlign: "center",
  },
  action: {
    marginTop: spacing[5],
    alignSelf: "stretch",
  },
  loadingLabel: {
    marginTop: spacing[3],
    color: colors.textSecondary,
    fontSize: typography.size.bodySmall,
    lineHeight: typography.lineHeight.bodySmall,
  },
});
