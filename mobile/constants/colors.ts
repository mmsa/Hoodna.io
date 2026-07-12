import { palette } from "@hoodna/tokens";

// Semantic compatibility layer. New components should use semantic names.
export const colors = {
  primary: palette.primary,
  primaryDark: palette.primaryHover,
  primaryLight: palette.primarySoft,
  
  // Purple (for gradients and accents)
  purple: palette.primary,
  purpleDark: palette.primaryHover,
  purpleLight: palette.primarySoft,
  
  // Pink (for emotional elements)
  pink: palette.danger,
  pinkLight: palette.dangerSoft,
  
  // Background (softer, more engaging)
  background: palette.canvas,
  backgroundWhite: palette.surface,
  backgroundCard: palette.surface,
  
  // Text
  textMain: palette.ink,
  textMuted: palette.inkMuted,
  text: palette.ink,
  textSecondary: palette.inkMuted,
  
  // Accent colors (vibrant and emotional)
  accent: palette.warning,
  accentLight: palette.warningSoft,
  success: palette.success,
  successLight: palette.successSoft,
  error: palette.danger,
  errorLight: palette.dangerSoft,
  
  // Gradient colors
  gradientStart: palette.primary,
  gradientEnd: palette.primary,
  
  // Borders (softer)
  border: palette.border,
  borderLight: palette.surfaceMuted,
  
  // Tab bar (vibrant)
  tabActive: palette.primary,
  tabInactive: palette.inkSubtle,
  
  // Post type colors (more vibrant)
  help: palette.warningSoft,
  lost: palette.dangerSoft,
  event: palette.primarySoft,
  marketplace: palette.successSoft,
  general: palette.surfaceMuted,
  
  // Reaction colors
  heart: palette.danger,
  like: palette.primary,
  wow: palette.warning,
  thanks: palette.success,
  
  // Gray scale (for inputs, etc.)
  gray50: palette.canvas,
  gray100: palette.surfaceMuted,
  gray200: palette.border,
  gray300: palette.borderStrong,
  gray400: palette.inkSubtle,
  gray500: palette.inkMuted,
};
