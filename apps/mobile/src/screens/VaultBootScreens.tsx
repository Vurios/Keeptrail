/**
 * What the app shows while the vault is opening, and when it cannot open.
 *
 * Opening is asynchronous because the encryption key comes from the platform
 * keystore. Both states are real screens rather than a blank frame: the failure
 * case in particular has to explain that records may still exist and are
 * recoverable from a backup, because the alternative — an empty-looking app —
 * invites the user to start again on top of data that is still there.
 */

import React from "react";
import { View } from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { AppText, Notice } from "../components/primitives";
import { Icon } from "../components/Icon";

export function VaultLoadingScreen() {
  const { colors, spacing } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.md,
        padding: spacing.gutter,
      }}
      accessibilityLiveRegion="polite"
    >
      <Icon name="vault" size={32} color={colors.primary} label="Keeptrail" />
      <AppText role="small" tone="secondary">
        Unlocking your vault…
      </AppText>
    </View>
  );
}

export function VaultFailureScreen({ message }: { message: string }) {
  const { colors, spacing } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        justifyContent: "center",
        padding: spacing.gutter,
        gap: spacing.lg,
      }}
    >
      <Notice
        tone="danger"
        icon="lock"
        title="Keeptrail could not open your vault"
        body={message}
      />
      <AppText role="small" tone="secondary">
        Your receipts have not been deleted. If you have an encrypted backup file, install Keeptrail
        fresh and restore from it — the archive is unlocked by the password you chose, not by this
        device's key.
      </AppText>
    </View>
  );
}
