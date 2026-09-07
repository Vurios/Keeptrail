import { Vibration, Platform } from "react-native";

/**
 * Haptic and tactile feedback utilities for Keeptrail Mobile
 * Uses native device vibration patterns to provide immediate physical feedback.
 */

export const haptics = {
  /** Light tick for button presses, tab changes, and card taps */
  tap: () => {
    try {
      if (Platform.OS === "android") {
        Vibration.vibrate(10);
      } else {
        Vibration.vibrate(1);
      }
    } catch {
      // Ignore vibration errors on unsupported environments
    }
  },

  /** Success notification tick for saves, exports, and confirmations */
  success: () => {
    try {
      if (Platform.OS === "android") {
        Vibration.vibrate([0, 15, 30, 20]);
      } else {
        Vibration.vibrate(15);
      }
    } catch {
      // Ignore
    }
  },

  /** Warning or destructive action feedback (trash, clear, delete) */
  warning: () => {
    try {
      if (Platform.OS === "android") {
        Vibration.vibrate([0, 30, 50, 40]);
      } else {
        Vibration.vibrate(35);
      }
    } catch {
      // Ignore
    }
  },

  /** Error or validation failure feedback */
  error: () => {
    try {
      if (Platform.OS === "android") {
        Vibration.vibrate([0, 40, 60, 40]);
      } else {
        Vibration.vibrate(40);
      }
    } catch {
      // Ignore
    }
  },
};
