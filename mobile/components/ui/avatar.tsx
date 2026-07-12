import React, { useEffect, useState } from "react";
import {
  Image,
  type ImageSourcePropType,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { palette, typography } from "@hoodna/tokens";

import { colors } from "@/constants/colors";

export interface AvatarProps {
  name: string;
  source?: ImageSourcePropType;
  size?: number;
  style?: ViewStyle;
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase() || "?";
}

export function Avatar({ name, source, size = 40, style }: AvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [source]);

  const dimensions = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  return (
    <View
      accessibilityLabel={name}
      accessibilityRole="image"
      style={[styles.base, dimensions, style]}
    >
      {source && !imageFailed ? (
        <Image
          onError={() => setImageFailed(true)}
          source={source}
          style={dimensions}
        />
      ) : (
        <Text
          adjustsFontSizeToFit
          numberOfLines={1}
          style={[styles.initials, { fontSize: Math.max(12, size * 0.36) }]}
        >
          {getInitials(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.primarySoft,
  },
  initials: {
    color: colors.primaryDark,
    fontWeight: typography.weight.semibold,
    textAlign: "center",
  },
});
