/**
 * Social-first design tokens for Eljiran (web + mobile).
 * Warm, familiar palette for Egypt/Gulf users used to WhatsApp & social feeds.
 */
export const palette = {
  canvas: "#FBF8F2",
  surface: "#FFFFFF",
  surfaceMuted: "#F3EEE6",
  surfacePressed: "#EBE4DA",
  ink: "#1F1A17",
  inkMuted: "#6B635A",
  inkSubtle: "#948C82",
  border: "#E5DDD2",
  borderStrong: "#D4CABD",
  primary: "#2A9D63",
  primaryHover: "#238552",
  primarySoft: "#E4F5EC",
  onPrimary: "#FFFFFF",
  success: "#2A9D63",
  successSoft: "#E4F5EC",
  warning: "#C47F17",
  warningSoft: "#FFF4D6",
  danger: "#D64545",
  dangerSoft: "#FCEAEA",
  info: "#3B7DD8",
  infoSoft: "#E8F1FC",
  socialWarm: "#F4A261",
  socialViolet: "#7C5CBF",
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
  small: 8,
  medium: 12,
  large: 16,
  xl: 20,
  full: 999,
} as const;

export const typography = {
  size: {
    caption: 12,
    bodySmall: 14,
    body: 16,
    titleSmall: 18,
    title: 22,
    display: 28,
  },
  lineHeight: {
    caption: 16,
    bodySmall: 20,
    body: 24,
    titleSmall: 24,
    title: 28,
    display: 34,
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
