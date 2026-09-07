/**
 * The app's icon vocabulary.
 *
 * Every glyph goes through this component. Emoji were previously used as the
 * icon system, which meant icons could not be tinted, changed appearance per
 * OEM font, and were read aloud by TalkBack as "house", "receipt", "alarm
 * clock" in front of every label. Material Symbols tint, scale, and stay
 * silent.
 */

import React from "react";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { StyleProp, TextStyle } from "react-native";

/**
 * Named by role, not by picture, so a screen asks for `"needsReview"` rather
 * than choosing a glyph and the meaning stays consistent everywhere.
 */
export const ICONS = {
  home: "home-variant-outline",
  homeActive: "home-variant",
  receipts: "receipt-text-outline",
  receiptsActive: "receipt-text",
  reminders: "bell-outline",
  remindersActive: "bell",
  vault: "shield-lock-outline",
  vaultActive: "shield-lock",

  add: "plus",
  search: "magnify",
  clear: "close-circle",
  close: "close",
  back: "arrow-left",
  chevron: "chevron-right",
  check: "check",
  edit: "pencil-outline",
  filter: "tune-variant",

  collection: "folder-outline",
  collectionOpen: "folder-open-outline",
  attachment: "paperclip",
  document: "file-document-outline",
  image: "image-outline",
  scan: "line-scan",
  camera: "camera-outline",
  gallery: "image-multiple-outline",
  keyboard: "form-textbox",

  assistant: "message-question-outline",
  send: "send",
  retry: "refresh",

  trash: "trash-can-outline",
  restore: "restore",
  reviewed: "check-decagram-outline",
  needsReview: "alert-decagram-outline",

  backup: "archive-arrow-down-outline",
  restoreArchive: "archive-arrow-up-outline",
  storage: "database-outline",
  lock: "lock-outline",
  key: "key-outline",

  due: "calendar-clock",
  overdue: "calendar-alert",
  done: "check-circle-outline",

  info: "information-outline",
  warning: "alert-outline",
  error: "alert-circle-outline",
  success: "check-circle",

  light: "white-balance-sunny",
  dark: "weather-night",
  guide: "book-open-outline",
  money: "cash",
} as const;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  color: string;
  style?: StyleProp<TextStyle>;
  /**
   * Set when the icon carries meaning no adjacent text conveys. Left unset the
   * icon is hidden from the screen reader, which is right for the common case
   * where it sits beside its own label.
   */
  label?: string;
}

export function Icon({ name, size = 20, color, style, label }: IconProps) {
  return (
    <MaterialCommunityIcons
      name={ICONS[name]}
      size={size}
      color={color}
      style={style}
      accessible={Boolean(label)}
      accessibilityRole={label ? "image" : undefined}
      accessibilityLabel={label}
      importantForAccessibility={label ? "yes" : "no-hide-descendants"}
    />
  );
}
