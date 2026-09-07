/**
 * Material-style snackbar.
 *
 * Replaces the previous top-anchored card toast. Two things changed that matter
 * beyond styling: it anchors to the bottom above the navigation inset where
 * Android users look for transient feedback, and it carries an optional single
 * action — which is what turns "Moved to Trash. You can restore it anytime"
 * from a four-step recovery into one tap on Undo.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Animated, Pressable, Text, View, type TextStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeContext";
import { Icon, type IconName } from "./Icon";

export type SnackbarTone = "neutral" | "success" | "warning" | "danger";

export interface SnackbarOptions {
  message: string;
  tone?: SnackbarTone;
  /** Longer for anything the user may need to act on. */
  durationMs?: number;
  action?: { label: string; onPress: () => void };
}

interface SnackbarContextValue {
  showSnackbar: (options: SnackbarOptions) => void;
  dismissSnackbar: () => void;
}

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

const TONE_ICON: Record<SnackbarTone, IconName> = {
  neutral: "info",
  success: "success",
  warning: "warning",
  danger: "error",
};

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const { colors, spacing, radius, typography, elevation, motion, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<SnackbarOptions | null>(null);
  const translate = useRef(new Animated.Value(80)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const dismissSnackbar = useCallback(() => {
    clearTimer();
    setCurrent(null);
  }, [clearTimer]);

  const showSnackbar = useCallback(
    (options: SnackbarOptions) => {
      clearTimer();
      setCurrent(options);
      const duration = options.durationMs ?? (options.action ? 6000 : 3500);
      timer.current = setTimeout(() => setCurrent(null), duration);
    },
    [clearTimer],
  );

  useEffect(() => clearTimer, [clearTimer]);

  useEffect(() => {
    if (!current) return;
    if (reduceMotion) {
      translate.setValue(0);
      return;
    }
    translate.setValue(80);
    Animated.timing(translate, {
      toValue: 0,
      duration: motion.base,
      useNativeDriver: true,
    }).start();
  }, [current, reduceMotion, translate, motion.base]);

  const value = useMemo(() => ({ showSnackbar, dismissSnackbar }), [showSnackbar, dismissSnackbar]);

  const tone = current?.tone ?? "neutral";
  const set = colors.status[tone === "neutral" ? "neutral" : tone];

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      {current ? (
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: spacing.lg,
            right: spacing.lg,
            bottom: insets.bottom + spacing.xxxl + spacing.xl,
            transform: [{ translateY: translate }],
          }}
        >
          <View
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              paddingVertical: spacing.md,
              paddingLeft: spacing.lg,
              paddingRight: current.action ? spacing.sm : spacing.lg,
              borderRadius: radius.control,
              backgroundColor: colors.surfaceRaised,
              borderWidth: 1,
              borderColor: set.border,
              elevation: elevation.sheet,
              maxWidth: 560,
              alignSelf: "center",
              width: "100%",
            }}
          >
            <Icon name={TONE_ICON[tone]} size={20} color={set.text} />
            <Text
              style={[typography.small as TextStyle, { color: colors.textPrimary, flex: 1 }]}
              numberOfLines={3}
            >
              {current.message}
            </Text>
            {current.action ? (
              <Pressable
                onPress={() => {
                  const handler = current.action?.onPress;
                  dismissSnackbar();
                  handler?.();
                }}
                accessibilityRole="button"
                accessibilityLabel={current.action.label}
                android_ripple={{ color: colors.scrim }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  minHeight: 40,
                  paddingHorizontal: spacing.md,
                  justifyContent: "center",
                  borderRadius: radius.control,
                }}
              >
                <Text style={[typography.smallStrong as TextStyle, { color: colors.primary }]}>
                  {current.action.label}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </SnackbarContext.Provider>
  );
}

export function useSnackbar(): SnackbarContextValue {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error("useSnackbar must be used within a SnackbarProvider");
  }
  return context;
}
