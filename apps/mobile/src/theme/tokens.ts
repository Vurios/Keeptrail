/**
 * Keeptrail Mobile Design Tokens
 * Strictly aligned with Keeptrail_Free_APK_Pilot_Blueprint.md (Section 6)
 */

export const colors = {
  // Brand Palette - Light Mode Tokens
  brand: {
    primary: "#146B55", // Keeptrail evergreen
    primaryPressed: "#0F5141",
    primaryFg: "#FFFFFF",
    surface: "#FFFFFF",
    surfaceAlt: "#E6F3EC", // Selected background
    background: "#F7F8F4", // Warm neutral surface
    card: "#FFFFFF",
    border: "#DCE4DE", // Decorative divider
    controlBorder: "#77877E",
    borderStrong: "#77877E",
    accent: "#c9973b",
    accentFg: "#1a160d",
    textPrimary: "#182824",
    textSecondary: "#5C6C65",
    textMuted: "#77877E",
  },


  // Dark Mode Tokens
  dark: {
    background: "#111A16",
    surface: "#1B2922",
    surfaceElevated: "#26382E",
    primary: "#8DDBB0",
    onPrimary: "#10241A",
    textPrimary: "#EFF5F1",
    textSecondary: "#B6C7BD",
    controlBorder: "#82988A",
  },

  // Semantic Status Tokens
  status: {
    success: {
      bg: "#E6F3EC",
      border: "#8DDBB0",
      text: "#146B55",
      fill: "#10b981",
    },
    warning: {
      bg: "#FFF3CD",
      border: "#FFE19B",
      text: "#865500",
      fill: "#f59e0b",
    },
    danger: {
      bg: "#FEECE9",
      border: "#FFB4AB",
      text: "#B42318",
      fill: "#ef4444",
    },
    info: {
      bg: "#EAF1FF",
      border: "#B5CEFF",
      text: "#245BB2",
      fill: "#3b82f6",
    },
    neutral: {
      bg: "#F7F8F4",
      border: "#DCE4DE",
      text: "#5C6C65",
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
  thumb: 48, // Minimum touch target (48x48)
  buttonHeight: 52, // Primary button height
  shutter: 72, // Large capture shutter target
} as const;

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  control: 12, // Control radius
  card: 16, // Card radius
  full: 9999,
} as const;


export const typography = {
  mainTitle: {
    fontSize: 28,
    fontWeight: "700" as const,
    lineHeight: 34,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    lineHeight: 26,
  },
  heading2: {
    fontSize: 18,
    fontWeight: "600" as const,
    lineHeight: 24,
  },
  body: {
    fontSize: 16, // Body 16 logical units
    fontWeight: "400" as const,
    lineHeight: 22,
  },
  bodyBold: {
    fontSize: 16,
    fontWeight: "600" as const,
    lineHeight: 22,
  },
  supporting: {
    fontSize: 14, // Supporting text 14
    fontWeight: "400" as const,
    lineHeight: 18,
  },
  caption: {
    fontSize: 12,
    fontWeight: "500" as const,
    lineHeight: 16,
  },
  mono: {
    fontSize: 14,
    fontWeight: "600" as const,
    fontFamily: "monospace",
  },
} as const;
