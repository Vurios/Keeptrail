import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, borderRadius, typography } from "../theme/tokens";

export type MobileSyncStatus =
  | "queued"
  | "uploading"
  | "synced"
  | "failed"
  | "verified"
  | "exception"
  | "active"
  | "expiring"
  | "expired";

interface StatusChipProps {
  status: MobileSyncStatus | string;
  label?: string;
  size?: "sm" | "md";
}

const STATUS_CONFIG: Record<
  MobileSyncStatus,
  {
    label: string;
    bg: string;
    border: string;
    text: string;
    symbol: string;
  }
> = {
  queued: {
    label: "Queued",
    bg: colors.status.neutral.bg,
    border: colors.status.neutral.border,
    text: colors.status.neutral.text,
    symbol: "⏱",
  },
  uploading: {
    label: "Uploading...",
    bg: colors.status.info.bg,
    border: colors.status.info.border,
    text: colors.status.info.text,
    symbol: "▲",
  },
  synced: {
    label: "Synced",
    bg: colors.status.success.bg,
    border: colors.status.success.border,
    text: colors.status.success.text,
    symbol: "✓",
  },
  failed: {
    label: "Sync Failed",
    bg: colors.status.danger.bg,
    border: colors.status.danger.border,
    text: colors.status.danger.text,
    symbol: "✕",
  },
  verified: {
    label: "Verified",
    bg: colors.status.success.bg,
    border: colors.status.success.border,
    text: colors.status.success.text,
    symbol: "🛡",
  },
  exception: {
    label: "Exception",
    bg: colors.status.danger.bg,
    border: colors.status.danger.border,
    text: colors.status.danger.text,
    symbol: "⚠",
  },
  active: {
    label: "Active Coverage",
    bg: colors.status.success.bg,
    border: colors.status.success.border,
    text: colors.status.success.text,
    symbol: "🛡",
  },
  expiring: {
    label: "Expiring Soon",
    bg: colors.status.warning.bg,
    border: colors.status.warning.border,
    text: colors.status.warning.text,
    symbol: "⏳",
  },
  expired: {
    label: "Expired",
    bg: colors.status.neutral.bg,
    border: colors.status.neutral.border,
    text: colors.status.neutral.text,
    symbol: "🔒",
  },
};

export function StatusChip({ status, label, size = "md" }: StatusChipProps) {
  const config = STATUS_CONFIG[status as MobileSyncStatus] || {
    label: status,
    bg: colors.status.neutral.bg,
    border: colors.status.neutral.border,
    text: colors.status.neutral.text,
    symbol: "•",
  };

  const displayText = label || config.label;

  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: config.bg, borderColor: config.border },
        size === "sm" ? styles.chipSm : styles.chipMd,
      ]}
    >
      <Text style={[styles.symbol, { color: config.text }]}>{config.symbol}</Text>
      <Text
        style={[
          styles.label,
          { color: config.text },
          size === "sm" ? styles.labelSm : styles.labelMd,
        ]}
      >
        {displayText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: borderRadius.full,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  chipSm: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 4,
  },
  chipMd: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 6,
  },
  symbol: {
    fontSize: 10,
    fontWeight: "700",
  },
  label: {
    fontWeight: "600",
  },
  labelSm: {
    fontSize: typography.caption.fontSize,
  },
  labelMd: {
    fontSize: typography.caption.fontSize + 1,
  },
});
