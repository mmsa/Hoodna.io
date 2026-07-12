/**
 * Platform-agnostic design tokens.
 * Web maps these values to CSS variables; mobile consumes them directly.
 */
export const palette = {
  canvas: "#F7F6F3",
  surface: "#FFFFFF",
  surfaceMuted: "#F1F0ED",
  surfacePressed: "#EAE8E3",
  ink: "#1C1C1A",
  inkMuted: "#686761",
  inkSubtle: "#8C8A84",
  border: "#E3E1DC",
  borderStrong: "#D3D0C9",
  primary: "#4F46E5",
  primaryHover: "#4338CA",
  primarySoft: "#EEEDFF",
  onPrimary: "#FFFFFF",
  success: "#287A52",
  successSoft: "#EAF5EF",
  warning: "#9A6700",
  warningSoft: "#FFF4D6",
  danger: "#C33A3A",
  dangerSoft: "#FCECEC",
  info: "#315E9B",
  infoSoft: "#EAF1FA",
} as const;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radii = {
  none: 0,
  small: 6,
  medium: 8,
  large: 12,
  full: 999,
} as const;

export const typography = {
  size: {
    caption: 12,
    bodySmall: 14,
    body: 16,
    titleSmall: 18,
    title: 22,
    display: 32,
  },
  lineHeight: {
    caption: 16,
    bodySmall: 20,
    body: 24,
    titleSmall: 24,
    title: 28,
    display: 38,
  },
  weight: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
} as const;

export const motion = {
  fast: 120,
  standard: 180,
  slow: 240,
} as const;

export const touchTarget = 44;
