/**
 * Keeptrail design tokens.
 *
 * These are the only dimensions, colours and type steps the app is allowed to
 * use. Screens import them through `useTheme()`; a raw literal in a screen is a
 * bug, not a shortcut, because it is how the type scale drifted to seventeen
 * sizes the first time round.
 *
 * The identity is a ledger, not a dashboard: an evergreen ink on warm paper,
 * a single accent reserved for money, and generous vertical rhythm so a list of
 * records reads like a statement rather than a feed.
 */

export const palette = {
  // Evergreen — permanence, the colour of a kept record.
  evergreen900: "#0B3A2E",
  evergreen700: "#0F5141",
  evergreen600: "#146B55",
  evergreen200: "#8DDBB0",
  evergreen100: "#D7EBE1",
  evergreen050: "#E6F3EC",

  // Warm paper neutrals. Deliberately not grey — receipts are paper.
  paper000: "#FFFFFF",
  paper050: "#F7F8F4",
  paper100: "#EEF1E9",
  paper300: "#DCE4DE",
  paper500: "#77877E",
  paper600: "#5C6C65",
  paper800: "#2C3A34",
  paper900: "#182824",

  // Obsidian — the dark scheme ground.
  obsidian900: "#0D1512",
  obsidian800: "#111A16",
  obsidian700: "#1B2922",
  obsidian600: "#25362E",
  obsidian500: "#38493F",

  // Brass — reserved for money and totals. Never used for chrome, so the eye
  // learns that brass means "this is an amount".
  brass600: "#8A6413",
  brass500: "#A97C1F",
  brass300: "#E7C77A",
  brass100: "#F6EBD2",

  // Semantic
  amber800: "#7A4D00",
  amber100: "#FFF3CD",
  amber300: "#FFE19B",
  red800: "#9F1B12",
  red700: "#B42318",
  red100: "#FEECE9",
  red300: "#FFB4AB",
  blue800: "#1D4C96",
  blue700: "#245BB2",
  blue100: "#EAF1FF",
  blue300: "#B5CEFF",
} as const;

export const colors = {
  brand: {
    primary: palette.evergreen600,
    primaryPressed: palette.evergreen700,
    primaryFg: palette.paper000,
    surface: palette.paper000,
    surfaceAlt: palette.evergreen050,
    background: palette.paper050,
    card: palette.paper000,
    border: palette.paper300,
    controlBorder: palette.paper500,
    borderStrong: palette.paper500,
    accent: "#c9973b",
    accentFg: palette.obsidian900,
    textPrimary: palette.paper900,
    textSecondary: palette.paper600,
    textMuted: palette.paper500,
  },
  dark: {
    background: palette.obsidian800,
    surface: palette.obsidian700,
    surfaceElevated: palette.obsidian600,
    primary: palette.evergreen200,
    onPrimary: palette.evergreen900,
    textPrimary: palette.paper050,
    textSecondary: palette.paper300,
    controlBorder: palette.paper500,
  },
  status: {
    success: {
      bg: palette.evergreen050,
      border: palette.evergreen200,
      text: palette.evergreen600,
      fill: "#10b981",
    },
    warning: {
      bg: palette.amber100,
      border: palette.amber300,
      text: palette.amber800,
      fill: "#f59e0b",
    },
    danger: {
      bg: palette.red100,
      border: palette.red300,
      text: palette.red700,
      fill: "#ef4444",
    },
    info: {
      bg: palette.blue100,
      border: palette.blue300,
      text: palette.blue700,
      fill: "#3b82f6",
    },
    neutral: {
      bg: palette.paper050,
      border: palette.paper300,
      text: palette.paper600,
      fill: "#6b7280",
    },
  },
} as const;

export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  gutter: 20,
  section: 32,
  touch: 48,
  thumb: 48,
  control: 52,
  buttonHeight: 52,
  shutter: 72,
} as const;

export const radius = {
  none: 0,
  sm: 6,
  control: 12,
  card: 16,
  sheet: 24,
  full: 9999,
} as const;

export const borderRadius = {
  sm: radius.sm,
  md: 8,
  lg: 12,
  control: radius.control,
  card: radius.card,
  full: radius.full,
} as const;

/**
 * Seven steps, plus backward-compatible aliases.
 */
export const typography = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: "700", letterSpacing: -0.5 },
  mainTitle: { fontSize: 28, lineHeight: 34, fontWeight: "700" as const },
  title: { fontSize: 22, lineHeight: 28, fontWeight: "700", letterSpacing: -0.3 },
  sectionTitle: { fontSize: 20, lineHeight: 26, fontWeight: "700" as const },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: "600", letterSpacing: -0.1 },
  heading2: { fontSize: 18, lineHeight: 24, fontWeight: "600" as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: "400", letterSpacing: 0 },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: "600", letterSpacing: 0 },
  bodyBold: { fontSize: 16, lineHeight: 22, fontWeight: "600" as const },
  supporting: { fontSize: 14, lineHeight: 18, fontWeight: "400" as const },
  small: { fontSize: 14, lineHeight: 20, fontWeight: "400", letterSpacing: 0 },
  smallStrong: { fontSize: 14, lineHeight: 20, fontWeight: "600", letterSpacing: 0 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "500" as const },
  label: { fontSize: 12, lineHeight: 16, fontWeight: "600", letterSpacing: 0.6 },
  mono: { fontSize: 14, lineHeight: 18, fontWeight: "600" as const, fontFamily: "monospace" },
} as const;

/**
 * Money is set in tabular figures so digits align down a column of records.
 * `amount` is the row-level figure; `amountLarge` is a headline total.
 */
export const numeric = {
  amount: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  amountLarge: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "700",
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  mono: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "monospace",
  },
} as const;

/** Material tonal elevation levels, expressed as Android elevation values. */
export const elevation = {
  flat: 0,
  raised: 1,
  card: 2,
  sheet: 3,
  fab: 6,
} as const;

/** Motion is short and eased out. Every duration is gated on Reduce Motion. */
export const motion = {
  instant: 0,
  fast: 150,
  base: 200,
  slow: 260,
} as const;
