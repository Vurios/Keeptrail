/**
 * Theme provider: resolves the colour scheme, persists the user's choice, and
 * exposes the system Reduce Motion setting so animation can be switched off
 * globally rather than per component.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AccessibilityInfo, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  borderRadius,
  elevation,
  motion,
  numeric,
  palette,
  radius,
  spacing,
  typography,
} from "./tokens";

export type ThemeMode = "system" | "light" | "dark";

const THEME_MODE_KEY = "keeptrail.theme.mode";

export interface StatusColorSet {
  bg: string;
  border: string;
  text: string;
}

export interface StatusPalette {
  success: StatusColorSet;
  warning: StatusColorSet;
  danger: StatusColorSet;
  info: StatusColorSet;
  neutral: StatusColorSet;
}

export interface ThemeColors {
  /** Brand action colour. */
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  /** Tinted container for selected/active states. */
  primaryContainer: string;
  onPrimaryContainer: string;

  background: string;
  surface: string;
  /** One tonal step above `surface`, for anything that floats. */
  surfaceRaised: string;
  /** Recessed ground for inset panels such as evidence previews. */
  surfaceSunken: string;

  textPrimary: string;
  textSecondary: string;
  /** Lowest-emphasis text. Meets 4.5:1 in both schemes. */
  textMuted: string;
  onAccent: string;

  /** Backward-compatible color properties */
  primaryFg: string;
  border: string;
  controlBorder: string;
  borderStrong: string;
  surfaceAlt: string;
  card: string;

  /** Decorative hairline. Never the only boundary of a control. */
  divider: string;
  /** Interactive boundary. Meets the 3:1 non-text minimum. */
  outline: string;

  /** Reserved for monetary figures. */
  accent: string;
  accentSurface: string;

  status: StatusPalette;
  /** Placeholder ground while content loads. */
  skeleton: string;
  scrim: string;
}

const lightColors: ThemeColors = {
  primary: palette.evergreen600,
  primaryPressed: palette.evergreen700,
  onPrimary: palette.paper000,
  primaryContainer: palette.evergreen050,
  onPrimaryContainer: palette.evergreen900,

  background: palette.paper050,
  surface: palette.paper000,
  surfaceRaised: palette.paper000,
  surfaceSunken: palette.paper100,

  primaryFg: palette.paper000,
  border: palette.paper300,
  controlBorder: palette.paper500,
  borderStrong: palette.paper500,
  surfaceAlt: palette.evergreen050,
  card: palette.paper000,

  textPrimary: palette.paper900,
  textSecondary: palette.paper600,
  // 4.68:1 on white, 4.51:1 on the warm background. The previous #77877E was
  // 3.78:1 and it was the placeholder colour on every form field in the app.
  textMuted: "#5A6A62",
  onAccent: palette.paper000,

  divider: palette.paper300,
  outline: palette.paper500,

  accent: palette.brass600,
  accentSurface: palette.brass100,

  status: {
    success: { bg: palette.evergreen050, border: palette.evergreen200, text: palette.evergreen700 },
    warning: { bg: palette.amber100, border: palette.amber300, text: palette.amber800 },
    danger: { bg: palette.red100, border: palette.red300, text: palette.red700 },
    info: { bg: palette.blue100, border: palette.blue300, text: palette.blue700 },
    neutral: { bg: palette.paper100, border: palette.paper300, text: palette.paper600 },
  },
  skeleton: palette.paper100,
  scrim: "rgba(24, 40, 36, 0.45)",
};

const darkColors: ThemeColors = {
  primary: palette.evergreen200,
  primaryPressed: "#7AC79E",
  onPrimary: "#0A2018",
  primaryContainer: palette.obsidian600,
  onPrimaryContainer: palette.evergreen100,

  background: palette.obsidian800,
  surface: palette.obsidian700,
  surfaceRaised: palette.obsidian600,
  surfaceSunken: palette.obsidian900,

  primaryFg: "#0A2018",
  border: palette.obsidian600,
  controlBorder: "#82988A",
  borderStrong: "#82988A",
  surfaceAlt: palette.obsidian600,
  card: palette.obsidian700,

  textPrimary: "#EFF5F1",
  textSecondary: "#B6C7BD",
  textMuted: "#93A69B",
  onAccent: "#241B06",

  divider: palette.obsidian600,
  outline: "#82988A",

  accent: palette.brass300,
  accentSurface: "#2E2513",

  status: {
    success: { bg: "#12301F", border: "#2F6A48", text: palette.evergreen200 },
    warning: { bg: "#33260A", border: "#6B5116", text: "#F2CE73" },
    danger: { bg: "#3A1512", border: "#7A2C24", text: palette.red300 },
    info: { bg: "#12213B", border: "#2A4779", text: palette.blue300 },
    neutral: { bg: palette.obsidian600, border: palette.obsidian500, text: "#B6C7BD" },
  },
  skeleton: palette.obsidian600,
  scrim: "rgba(0, 0, 0, 0.6)",
};

export interface Theme {
  mode: ThemeMode;
  isDark: boolean;
  /** True when the OS asks for reduced motion, or before that is known. */
  reduceMotion: boolean;
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  borderRadius: typeof borderRadius;
  typography: typeof typography;
  numeric: typeof numeric;
  elevation: typeof elevation;
  motion: typeof motion;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [reduceMotion, setReduceMotion] = useState(false);

  // Restore the saved preference. The first frame renders in the system scheme,
  // which is the closest guess available before storage has been read.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(THEME_MODE_KEY)
      .then((stored) => {
        if (cancelled) return;
        if (stored === "light" || stored === "dark" || stored === "system") {
          setModeState(stored);
        }
      })
      .catch(() => {
        // A preference that cannot be read is not worth surfacing; the system
        // scheme is a reasonable default.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (!cancelled) setReduceMotion(enabled);
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled: boolean) => setReduceMotion(enabled),
    );
    return () => {
      cancelled = true;
      subscription?.remove?.();
    };
  }, []);

  const value = useMemo<Theme>(() => {
    const isDark = mode === "system" ? systemScheme === "dark" : mode === "dark";
    return {
      mode,
      isDark,
      reduceMotion,
      colors: isDark ? darkColors : lightColors,
      spacing,
      radius,
      borderRadius,
      typography,
      numeric,
      elevation,
      motion,
      setMode: (next: ThemeMode) => {
        setModeState(next);
        AsyncStorage.setItem(THEME_MODE_KEY, next).catch(() => undefined);
      },
    };
  }, [mode, systemScheme, reduceMotion]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    // Silently returning a light theme here would let a component render
    // light-on-dark with nothing reported, which is how the previous version
    // hid provider mistakes.
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return theme;
}
