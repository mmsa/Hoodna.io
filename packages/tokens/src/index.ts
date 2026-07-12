/**
 * Eljiran design system — nano banana mockup (web + mobile).
 * Keep existing logo; blend these tokens across platforms.
 */
export const palette = {
  canvas: "#F9F7F1",
  surface: "#FFFFFF",
  surfaceMuted: "#F0EDE6",
  surfacePressed: "#E7E2D8",
  ink: "#1C1917",
  inkMuted: "#78716C",
  inkSubtle: "#A8A29E",
  border: "#E7E2D8",
  borderStrong: "#D6D0C4",
  primary: "#006652",
  primaryHover: "#004D3E",
  primarySoft: "#E6F2EF",
  onPrimary: "#FFFFFF",
  accent: "#FF7B60",
  accentHover: "#E86A50",
  whatsapp: "#25D366",
  success: "#006652",
  successSoft: "#E6F2EF",
  warning: "#C47F17",
  warningSoft: "#FFF4D6",
  danger: "#DC2626",
  dangerSoft: "#FEE2E2",
  info: "#3B7DD8",
  infoSoft: "#E8F1FC",
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
  family: "Plus Jakarta Sans",
  size: {
    caption: 12,
    bodySmall: 13,
    body: 15,
    titleSmall: 18,
    title: 22,
    display: 32,
    price: 15,
    priceLg: 28,
  },
  lineHeight: {
    caption: 16,
    bodySmall: 20,
    body: 24,
    titleSmall: 24,
    title: 28,
    display: 38,
    price: 20,
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
