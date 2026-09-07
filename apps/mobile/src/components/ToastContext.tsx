import React, { createContext, useContext, useState, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  Animated,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  StatusBar,
} from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { haptics } from "../utils/haptics";

export type ToastType = "success" | "info" | "warning" | "error";

export interface ToastOptions {
  type?: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (options: ToastOptions) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { colors, spacing, borderRadius, typography, isDark } = useTheme();
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const hideToast = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToast(null);
    });
  };

  const showToast = (options: ToastOptions) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    const type = options.type || "info";
    // Trigger appropriate tactile feedback
    if (type === "success") haptics.success();
    else if (type === "warning") haptics.warning();
    else if (type === "error") haptics.error();
    else haptics.tap();

    setToast(options);

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 6,
        speed: 12,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    const duration = options.duration || 3200;
    timerRef.current = setTimeout(() => {
      hideToast();
    }, duration);
  };

  const getStatusStyle = (type: ToastType = "info") => {
    switch (type) {
      case "success":
        return {
          bg: colors.status.success.bg,
          border: colors.status.success.border,
          text: colors.status.success.text,
          icon: "✓",
        };
      case "warning":
        return {
          bg: colors.status.warning.bg,
          border: colors.status.warning.border,
          text: colors.status.warning.text,
          icon: "⚠️",
        };
      case "error":
        return {
          bg: colors.status.danger.bg,
          border: colors.status.danger.border,
          text: colors.status.danger.text,
          icon: "✕",
        };
      case "info":
      default:
        return {
          bg: colors.status.info.bg,
          border: colors.status.info.border,
          text: colors.status.info.text,
          icon: "ℹ️",
        };
    }
  };

  const statusStyle = toast ? getStatusStyle(toast.type) : getStatusStyle("info");
  const topInset = Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 8 : 12;

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}

      {toast && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              top: topInset,
              transform: [{ translateY }],
              opacity,
            },
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            style={[
              styles.toastCard,
              {
                backgroundColor: statusStyle.bg,
                borderColor: statusStyle.border,
                borderRadius: borderRadius.card,
                padding: spacing.md,
                shadowColor: isDark ? "#000" : "#223",
              },
            ]}
            onPress={hideToast}
            activeOpacity={0.9}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            <View style={styles.iconCircle}>
              <Text style={[styles.iconText, { color: statusStyle.text }]}>{statusStyle.icon}</Text>
            </View>

            <View style={styles.textContainer}>
              <Text style={[styles.toastTitle, { color: statusStyle.text }]}>{toast.title}</Text>
              {toast.message && (
                <Text
                  style={[
                    styles.toastMessage,
                    { color: isDark ? colors.textSecondary : colors.textPrimary },
                  ]}
                  numberOfLines={3}
                >
                  {toast.message}
                </Text>
              )}
            </View>

            <TouchableOpacity
              onPress={hideToast}
              style={styles.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Dismiss notification"
              accessibilityRole="button"
            >
              <Text style={[styles.closeIcon, { color: colors.textMuted }]}>✕</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

const styles = StyleSheet.create({
  toastContainer: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 99999,
    alignItems: "center",
  },
  toastCard: {
    width: "100%",
    maxWidth: 540,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 10,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  iconText: {
    fontSize: 16,
    fontWeight: "700",
  },
  textContainer: {
    flex: 1,
    paddingRight: 6,
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
  toastMessage: {
    fontSize: 13,
    lineHeight: 17,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 32,
    minHeight: 32,
  },
  closeIcon: {
    fontSize: 14,
    fontWeight: "600",
  },
});
