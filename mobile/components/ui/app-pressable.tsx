import React, { forwardRef } from "react";
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type View,
  type ViewStyle,
} from "react-native";

export interface AppPressableProps extends Omit<PressableProps, "style"> {
  style?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
}

export const AppPressable = forwardRef<View, AppPressableProps>(
  function AppPressable(
    { children, disabled, style, pressedStyle, ...props },
    ref,
  ) {
    return (
      <Pressable
        ref={ref}
        disabled={disabled}
        style={({ pressed }) => [
          style,
          pressed && !disabled && pressedStyle,
          disabled && { opacity: 0.5 },
        ]}
        {...props}
      >
        {children}
      </Pressable>
    );
  },
);
