/**
 * Eljiran design system — canvas visual specification (web + mobile).
 */
export const palette = {
  canvas: "#F9F8F1",
  surface: "#FFFFFF",
  surfaceMuted: "#F0EFEA",
  surfacePressed: "#E8E7E1",
  ink: "#2D2D2A",
  inkMuted: "#707070",
  inkSubtle: "#A3A3A3",
  border: "#E0E0E0",
  borderStrong: "#CFCFCF",
  primary: "#158074",
  primaryHover: "#106B60",
  primarySoft: "#E6F3F1",
  onPrimary: "#FFFFFF",
  accent: "#FF6F61",
  accentHover: "#E85F52",
  whatsapp: "#25D366",
  success: "#158074",
  successSoft: "#E6F3F1",
  warning: "#C47F17",
  warningSoft: "#FFF4D6",
  danger: "#DC2626",
  dangerSoft: "#FEE2E2",
  info: "#3B7DD8",
  infoSoft: "#E8F1FC",
} as const;

export const shadows = {
  card: "0 4px 12px rgba(0, 0, 0, 0.06)",
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
  button: 24,
  chip: 32,
  xl: 20,
  full: 999,
} as const;

export const typography = {
  family: "Inter",
  familyArabic: "Noto Sans Arabic",
  size: {
    caption: 12,
    body: 16,
    bodySmall: 14,
    title: 24,
    titleSmall: 18,
    display: 32,
    price: 20,
    priceLg: 28,
  },
  lineHeight: {
    caption: 16,
    body: 24,
    bodySmall: 20,
    title: 32,
    titleSmall: 26,
    display: 40,
    price: 28,
    priceLg: 34,
  },
  weight: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
    extrabold: "800",
  },
} as const;

export const motion = {
  fast: 120,
  standard: 180,
  slow: 240,
} as const;

export const touchTarget = 44;
