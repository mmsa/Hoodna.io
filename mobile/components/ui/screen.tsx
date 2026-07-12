import React, { type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ScrollViewProps,
  StyleSheet,
  View,
  type ViewProps,
} from "react-native";
import {
  SafeAreaView,
  type Edge,
} from "react-native-safe-area-context";
import { spacing } from "@hoodna/tokens";

import { colors } from "@/constants/colors";

export interface ScreenProps extends ViewProps {
  children: ReactNode;
  edges?: Edge[];
  padded?: boolean;
}

export function Screen({
  children,
  edges = ["top", "right", "bottom", "left"],
  padded = true,
  style,
  ...props
}: ScreenProps) {
  return (
    <SafeAreaView edges={edges} style={styles.safeArea}>
      <View
        style={[styles.content, padded && styles.padded, style]}
        {...props}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

export interface KeyboardScreenProps extends ScrollViewProps {
  children: ReactNode;
  edges?: Edge[];
  padded?: boolean;
  keyboardVerticalOffset?: number;
}

export function KeyboardScreen({
  children,
  edges = ["top", "right", "bottom", "left"],
  padded = true,
  keyboardVerticalOffset = 0,
  contentContainerStyle,
  ...props
}: KeyboardScreenProps) {
  return (
    <SafeAreaView edges={edges} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={keyboardVerticalOffset}
        style={styles.content}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            padded && styles.padded,
            contentContainerStyle,
          ]}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          {...props}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: spacing[4],
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: spacing[4],
  },
});
