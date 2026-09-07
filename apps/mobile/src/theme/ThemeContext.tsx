import React, { createContext, useContext, useState } from "react";
import { useColorScheme } from "react-native";
import { colors as baseColors, spacing, borderRadius, typography } from "./tokens";

export type ThemeMode = "system" | "light" | "dark";

export interface StatusColorSet {
  bg: string;
  border: string;
  text: string;
  fill: string;
}

export interface StatusPalette {
  success: StatusColorSet;
  warning: StatusColorSet;
  danger: StatusColorSet;
  info: StatusColorSet;
  neutral: StatusColorSet;
}

export interface ThemeColors {
  primary: string;
  primaryPressed: string;
  primaryFg: string;
  surface: string;
  surfaceAlt: string;
  surfaceElevated: string;
  background: string;
  card: string;
  border: string;
  controlBorder: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  status: StatusPalette;
}

interface ThemeContextType {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  typography: typeof typography;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const lightThemeColors: ThemeColors = {
  primary: baseColors.brand.primary,
  primaryPressed: baseColors.brand.primaryPressed,
  primaryFg: baseColors.brand.primaryFg,
  surface: baseColors.brand.surface,
  surfaceAlt: baseColors.brand.surfaceAlt,
  surfaceElevated: "#FFFFFF",
  background: baseColors.brand.background,
  card: baseColors.brand.card,
  border: baseColors.brand.border,
  controlBorder: baseColors.brand.controlBorder,
  borderStrong: baseColors.brand.borderStrong,
  textPrimary: baseColors.brand.textPrimary,
  textSecondary: baseColors.brand.textSecondary,
  textMuted: baseColors.brand.textMuted,
  accent: baseColors.brand.accent,
  status: {
    success: { ...baseColors.status.success },
    warning: { ...baseColors.status.warning },
    danger: { ...baseColors.status.danger },
    info: { ...baseColors.status.info },
    neutral: { ...baseColors.status.neutral },
  },
};

const darkThemeColors: ThemeColors = {
  primary: baseColors.dark.primary,
  primaryPressed: "#7AC79E",
  primaryFg: baseColors.dark.onPrimary,
  surface: baseColors.dark.surface,
  surfaceAlt: baseColors.dark.surfaceElevated,
  surfaceElevated: "#2D3F35",
  background: baseColors.dark.background,
  card: baseColors.dark.surface,
  border: "#25362E",
  controlBorder: baseColors.dark.controlBorder,
  borderStrong: "#82988A",
  textPrimary: baseColors.dark.textPrimary,
  textSecondary: baseColors.dark.textSecondary,
  textMuted: "#82988A",
  accent: "#E2BA65",
  status: {
    success: {
      bg: "#132E22",
      border: "#1E4B37",
      text: "#8DDBB0",
      fill: "#10b981",
    },
    warning: {
      bg: "#322712",
      border: "#4A3B18",
      text: "#FCD34D",
      fill: "#f59e0b",
    },
    danger: {
      bg: "#351B17",
      border: "#56231C",
      text: "#FCA5A5",
      fill: "#ef4444",
    },
    info: {
      bg: "#16283C",
      border: "#234162",
      text: "#93C5FD",
      fill: "#3b82f6",
    },
    neutral: {
      bg: "#1F2B25",
      border: "#2F3F37",
      text: "#B6C7BD",
      fill: "#9ca3af",
    },
  },
};

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>("system");

  const isDark = mode === "system" ? systemColorScheme === "dark" : mode === "dark";
  const colors = isDark ? darkThemeColors : lightThemeColors;

  const toggleTheme = () => {
    setMode((prev) => {
      if (prev === "system") {
        return systemColorScheme === "dark" ? "light" : "dark";
      }
      return prev === "dark" ? "light" : "dark";
    });
  };

  return (
    <ThemeContext.Provider
      value={{
        mode,
        isDark,
        colors,
        spacing,
        borderRadius,
        typography,
        setMode,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      mode: "system",
      isDark: false,
      colors: lightThemeColors,
      spacing,
      borderRadius,
      typography,
      setMode: () => {},
      toggleTheme: () => {},
    };
  }
  return context;
};
