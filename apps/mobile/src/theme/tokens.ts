/**
 * Katibay Mobile Design Tokens
 * Strictly mirrored from packages/shared/design-tokens.md and apps/web design system.
 */

export const colors = {
  // Brand Palette
  brand: {
    primary: "#0f372c", // Katibay deep forest green
    primaryHover: "#174d3f",
    primaryFg: "#ffffff",
    accent: "#c9973b", // Official seal gold
    accentHover: "#d8a649",
    accentFg: "#1a160d",
    surface: "#f8faf9",
    surfaceAlt: "#f0f4f2",
    card: "#ffffff",
    border: "#e2e8e5",
    borderStrong: "#c8d4ce",
    textPrimary: "#121d19",
    textSecondary: "#4b5d56",
    textMuted: "#6b7d76",
  },

  // Semantic Status Tokens
  status: {
    success: {
      bg: "#ecfdf5",
      border: "#a7f3d0",
      text: "#065f46",
      fill: "#10b981",
    },
    warning: {
      bg: "#fffbeb",
      border: "#fde68a",
      text: "#92400e",
      fill: "#f59e0b",
    },
    danger: {
      bg: "#fef2f2",
      border: "#fecaca",
      text: "#991b1b",
      fill: "#ef4444",
    },
    info: {
      bg: "#eff6ff",
      border: "#bfdbfe",
      text: "#1e40af",
      fill: "#3b82f6",
    },
    neutral: {
      bg: "#f3f4f6",
      border: "#e5e7eb",
      text: "#374151",
      fill: "#6b7280",
    },
  },
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  thumb: 48, // Minimum touch target
  shutter: 72, // Giant thumb shutter target
} as const;

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const typography = {
  display: {
    fontSize: 28,
    fontWeight: "800" as const,
    lineHeight: 34,
  },
  heading1: {
    fontSize: 22,
    fontWeight: "700" as const,
    lineHeight: 28,
  },
  heading2: {
    fontSize: 18,
    fontWeight: "700" as const,
    lineHeight: 24,
  },
  body: {
    fontSize: 14,
    fontWeight: "400" as const,
    lineHeight: 20,
  },
  bodyBold: {
    fontSize: 14,
    fontWeight: "600" as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: "500" as const,
    lineHeight: 16,
  },
  mono: {
    fontSize: 12,
    fontWeight: "600" as const,
    fontFamily: "monospace",
  },
} as const;
