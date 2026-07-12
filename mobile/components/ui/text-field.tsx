import React, { forwardRef, useId, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type TextStyle,
  View,
  type ViewStyle,
  type StyleProp,
} from "react-native";
import { palette, radii, spacing, typography } from "@hoodna/tokens";

import { colors } from "@/constants/colors";

export interface TextFieldProps extends Omit<TextInputProps, "style"> {
  label?: string;
  error?: string;
  helperText?: string;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

function Field(
  {
    label,
    error,
    helperText,
    containerStyle,
    inputStyle,
    editable = true,
    multiline,
    onBlur,
    onFocus,
    accessibilityLabel,
    accessibilityHint,
    ...props
  }: TextFieldProps,
  ref: React.ForwardedRef<TextInput>,
) {
  const [focused, setFocused] = useState(false);
  const id = useId();
  const message = error || helperText;

  return (
    <View style={containerStyle}>
      {label ? (
        <Text nativeID={`${id}-label`} style={styles.label}>
          {label}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        accessibilityLabel={accessibilityLabel || label}
        accessibilityHint={error || accessibilityHint}
        accessibilityState={{ disabled: !editable }}
        editable={editable}
        multiline={multiline}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        placeholderTextColor={colors.gray400}
        style={[
          styles.input,
          multiline && styles.textArea,
          focused && styles.focused,
          error && styles.invalid,
          !editable && styles.disabled,
          inputStyle,
        ]}
        textAlignVertical={multiline ? "top" : "center"}
        {...props}
      />
      {message ? (
        <Text
          accessibilityLiveRegion={error ? "polite" : "none"}
          nativeID={`${id}-message`}
          style={[styles.message, error && styles.error]}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}

export const TextField = forwardRef<TextInput, TextFieldProps>(Field);

export const TextArea = forwardRef<TextInput, TextFieldProps>(
  function TextArea(props, ref) {
    return (
      <TextField
        ref={ref}
        multiline
        numberOfLines={4}
        {...props}
      />
    );
  },
);

const styles = StyleSheet.create({
  label: {
    marginBottom: spacing[2],
    color: colors.text,
    fontSize: typography.size.bodySmall,
    lineHeight: typography.lineHeight.bodySmall,
    fontWeight: typography.weight.medium,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.medium,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    color: colors.text,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
  },
  textArea: {
    minHeight: 112,
    paddingTop: spacing[3],
  },
  focused: {
    borderColor: colors.primary,
  },
  invalid: {
    borderColor: colors.error,
  },
  disabled: {
    backgroundColor: palette.surfaceMuted,
    color: colors.textMuted,
  },
  message: {
    marginTop: spacing[1],
    color: colors.textSecondary,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
  },
  error: {
    color: colors.error,
  },
});
