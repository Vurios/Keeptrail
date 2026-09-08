/**
 * Onboarding.
 *
 * Three steps, matching blueprint §7: "Keep what matters", "Private, on your
 * phone", "Back up before you need it" — each stating plainly that there is no
 * account, no recovery and no automatic sync.
 *
 * The previous version had five steps and pre-filled its capture form with
 * invented values ("National Bookstore / 450.00") that the user had to delete,
 * breaching the rule "Never seed fake receipts into real totals". Sample data
 * is now an explicit, clearly labelled, disposable choice on the last step.
 *
 * No permission is requested here. §7 requires camera and notification prompts at
 * the relevant action: the camera prompt lives in the capture flow, and the
 * notification prompt fires when the user saves their first reminder.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Modal, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../theme/ThemeContext";
import { useLocalVault } from "../vault-context";
import { useSnackbar } from "../components/SnackbarContext";
import { AppBar, AppText, Button, Card, Notice } from "../components/primitives";
import { Icon, type IconName } from "../components/Icon";
import { haptics } from "../utils/haptics";

interface OnboardingModalProps {
  visible: boolean;
  onClose: () => void;
  onStartCapture: () => void;
}

interface Step {
  key: string;
  icon: IconName;
  title: string;
  body: string;
  points: string[];
}

const STEPS: Step[] = [
  {
    key: "keep",
    icon: "receipts",
    title: "Keep what matters",
    body: "Save a receipt with the reason you kept it, and it stays findable — by merchant, by an item printed on it, or by the note you wrote.",
    points: [
      "Warranty proof, reimbursements, returns, anything you may need to produce later",
      "Photograph a receipt, pick one from your gallery, import a PDF, or type it in",
      "Keeptrail asks for the camera only at the moment you choose to use it",
    ],
  },
  {
    key: "private",
    icon: "lock",
    title: "Private, on your phone",
    body: "Keeptrail has no account and no server. Your receipts are written to storage only this app can read, and nothing is uploaded anywhere.",
    points: [
      "No sign-in, no password to forget, no subscription",
      "Nothing syncs between phones — this app holds one copy, on this device",
      "Uninstalling Keeptrail deletes everything it stored",
    ],
  },
  {
    key: "backup",
    icon: "backup",
    title: "Back up before you need it",
    body: "Because there is no account, there is nobody who can recover your receipts for you. A backup is the only way they survive losing this phone.",
    points: [
      "The Vault screen writes one encrypted file holding every record and original",
      "You choose the password — it cannot be reset, and we cannot open the file without it",
      "A backup that stays on this phone dies with the phone: copy it somewhere else",
    ],
  },
];

export function OnboardingModal({ visible, onClose, onStartCapture }: OnboardingModalProps) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { loadSampleReceipts, receipts } = useLocalVault();
  const { showSnackbar } = useSnackbar();
  const [index, setIndex] = useState(0);

  // Reopening the guide starts at the beginning. Without this the modal keeps
  // the index it closed on, so a user who finished it once can never see the
  // first two steps again.
  useEffect(() => {
    if (visible) setIndex(0);
  }, [visible]);

  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  const finish = useCallback(() => {
    setIndex(0);
    onClose();
  }, [onClose]);

  const handleNext = useCallback(() => {
    haptics.tap();
    if (isLast) {
      finish();
      return;
    }
    setIndex((current) => current + 1);
  }, [isLast, finish]);

  const handleSample = useCallback(() => {
    haptics.tap();
    const created = loadSampleReceipts();
    finish();
    showSnackbar({
      message:
        created > 0
          ? `Added ${created} sample receipts, each named "Sample". Delete them whenever you like.`
          : "The sample receipts are already in your vault.",
      tone: "neutral",
      durationMs: 5000,
    });
  }, [loadSampleReceipts, finish, showSnackbar]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={finish}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <AppBar
          title="Welcome to Keeptrail"
          subtitle={`Step ${index + 1} of ${STEPS.length}`}
          actions={<Button label="Skip" variant="text" onPress={finish} />}
        />

        <ScrollView
          contentContainerStyle={{
            padding: spacing.gutter,
            paddingBottom: spacing.xxxl,
            gap: spacing.xl,
          }}
        >
          {/* Progress is a row of bars, not dots: it shows how much is left,
              and it does not depend on colour alone to say where you are. */}
          <View
            style={{ flexDirection: "row", gap: spacing.xs }}
            accessibilityRole="progressbar"
            accessibilityLabel={`Step ${index + 1} of ${STEPS.length}`}
            accessibilityValue={{ min: 1, max: STEPS.length, now: index + 1 }}
          >
            {STEPS.map((entry, position) => (
              <View
                key={entry.key}
                style={{
                  flex: 1,
                  height: spacing.xs,
                  borderRadius: spacing.xxs,
                  backgroundColor: position <= index ? colors.primary : colors.divider,
                }}
              />
            ))}
          </View>

          <View style={{ gap: spacing.md }}>
            <Icon name={step.icon} size={32} color={colors.primary} />
            <AppText role="display">{step.title}</AppText>
            <AppText role="body" tone="secondary">
              {step.body}
            </AppText>
          </View>

          <View style={{ gap: spacing.md }}>
            {step.points.map((point) => (
              <View key={point} style={{ flexDirection: "row", gap: spacing.md }}>
                <View
                  style={{
                    width: spacing.sm - spacing.xxs,
                    height: spacing.sm - spacing.xxs,
                    borderRadius: spacing.xs,
                    backgroundColor: colors.textMuted,
                    marginTop: spacing.sm,
                  }}
                />
                <AppText role="small" tone="secondary" style={{ flex: 1 }}>
                  {point}
                </AppText>
              </View>
            ))}
          </View>

          {isLast ? (
            <Notice
              tone="warning"
              icon="key"
              title="There is no password reset"
              body="If you forget a backup password, that archive cannot be opened again — not by you and not by us. Write it down somewhere safe."
            />
          ) : null}
        </ScrollView>

        <View
          style={{
            gap: spacing.sm,
            padding: spacing.gutter,
            paddingBottom: spacing.gutter + insets.bottom,
            borderTopWidth: 1,
            borderTopColor: colors.divider,
            backgroundColor: colors.surface,
          }}
        >
          <Button
            label={isLast ? "Save my first receipt" : "Next"}
            fullWidth
            icon={isLast ? "add" : undefined}
            onPress={
              isLast
                ? () => {
                    haptics.tap();
                    onStartCapture();
                  }
                : handleNext
            }
          />

          {isLast ? (
            <>
              <Button label="Look around first" variant="outlined" fullWidth onPress={finish} />
              {receipts.length === 0 ? (
                <Button
                  label="Load disposable sample receipts"
                  variant="text"
                  fullWidth
                  onPress={handleSample}
                  accessibilityHint="Adds two records named Sample that you can delete at any time"
                />
              ) : null}
            </>
          ) : (
            <Button
              label="Back"
              variant="text"
              fullWidth
              disabled={index === 0}
              onPress={() => setIndex((current) => Math.max(0, current - 1))}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
