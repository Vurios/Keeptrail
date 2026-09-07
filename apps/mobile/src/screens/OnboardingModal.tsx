import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  SafeAreaView,
  TextInput,
} from "react-native";
import { colors, spacing, borderRadius, typography } from "../theme/tokens";
import { useLocalVault } from "../vault-context";

interface OnboardingModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenSampleReceipt?: () => void;
}

type OnboardingStep = 1 | 2 | 3 | 4 | 5;

export function OnboardingModal({ visible, onClose, onOpenSampleReceipt }: OnboardingModalProps) {
  const { saveReceipt } = useLocalVault();
  const [step, setStep] = useState<OnboardingStep>(1);

  // Form states for Step 4 (Quick Save)
  const [merchant, setMerchant] = useState("National Bookstore");
  const [amountInput, setAmountInput] = useState("450.00");
  const [purpose, setPurpose] = useState("Office supplies & notebooks");
  const [savedReceiptId, setSavedReceiptId] = useState<string | null>(null);

  const handleGetStarted = () => {
    setStep(2);
  };

  const handleSeeExample = () => {
    // Closes onboarding and shows sample record
    onClose();
    if (onOpenSampleReceipt) {
      onOpenSampleReceipt();
    }
  };

  const handleAcceptLocalVault = () => {
    setStep(3);
  };

  const handleSelectCaptureMode = (mode: "camera" | "gallery" | "manual") => {
    if (mode === "manual") {
      setMerchant("");
      setAmountInput("");
      setPurpose("");
    } else {
      setMerchant("National Bookstore");
      setAmountInput("450.00");
      setPurpose("Office supplies & notebooks");
    }
    setStep(4);
  };

  const handleQuickSave = () => {
    const rawMinor = amountInput.trim()
      ? Math.round(parseFloat(amountInput.replace(/[^0-9.]/g, "")) * 100)
      : null;

    const newRecord = saveReceipt({
      id: `rec_onboard_${Date.now()}`,
      title: merchant.trim() || "Receipt saved Sep 6",
      merchant: merchant.trim() || null,
      transaction_date: new Date().toISOString().split("T")[0],
      total_minor_units: rawMinor !== null && !isNaN(rawMinor) ? rawMinor : null,
      subtotal_minor_units: null,
      tax_minor_units: null,
      currency: "PHP",
      purpose: purpose.trim() || null,
      notes: null,
      document_type: "receipt",
      review_status: "reviewed",
      tags: ["supplies"],
      collection_ids: ["col_purchases"],
      is_trashed: false,
      deleted_at: null,
    });

    setSavedReceiptId(newRecord.id);
    setStep(5);
  };

  const handleFinish = () => {
    onClose();
    setStep(1);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        {/* Step Indicator Header */}
        <View style={styles.stepHeader}>
          <View style={styles.stepProgressContainer}>
            {([1, 2, 3, 4, 5] as OnboardingStep[]).map((s) => (
              <View key={s} style={[styles.progressDot, s <= step && styles.progressDotActive]} />
            ))}
          </View>
          {step > 1 && (
            <TouchableOpacity
              onPress={handleFinish}
              style={styles.skipButton}
              accessibilityLabel="Skip Onboarding"
            >
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ======================================================= */}
          {/* SCREEN 1: Welcome                                       */}
          {/* ======================================================= */}
          {step === 1 && (
            <View style={styles.stepContainer}>
              {/* Minimal Vector Mark */}
              <View style={styles.brandMarkContainer}>
                <View style={styles.foldedDocSymbol}>
                  <View style={styles.symbolCorner} />
                  <View style={styles.symbolTrailLine1} />
                  <View style={styles.symbolTrailLine2} />
                  <View style={styles.symbolTrailDot} />
                </View>
              </View>

              <Text style={styles.title}>Keep the receipts that matter.</Text>
              <Text style={styles.subtitle}>
                Save photos and screenshots. Find them when you need them.
              </Text>

              {/* Realistic Fictional Sample Card */}
              <View style={styles.sampleReceiptCard}>
                <View style={styles.sampleCardHeader}>
                  <Text style={styles.sampleMerchant}>Mercury Drug</Text>
                  <Text style={styles.sampleAmount}>₱ 328.50</Text>
                </View>
                <Text style={styles.sampleDate}>Aug 28, 2026 • Medical prescription</Text>
                <View style={styles.sampleTagRow}>
                  <View style={styles.sampleBadge}>
                    <Text style={styles.sampleBadgeText}>Saved on this phone</Text>
                  </View>
                  <View style={[styles.sampleBadge, styles.sampleBadgeAlt]}>
                    <Text style={[styles.sampleBadgeText, styles.sampleBadgeAltText]}>In Box</Text>
                  </View>
                </View>
              </View>

              <View style={styles.actionGroup}>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleGetStarted}
                  activeOpacity={0.85}
                  accessibilityLabel="Get started with Keeptrail"
                >
                  <Text style={styles.primaryBtnText}>Get started</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={handleSeeExample}
                  activeOpacity={0.85}
                  accessibilityLabel="See an example receipt"
                >
                  <Text style={styles.secondaryBtnText}>See an example</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ======================================================= */}
          {/* SCREEN 2: Local Vault Notice (No Accounts / Honest Privacy) */}
          {/* ======================================================= */}
          {step === 2 && (
            <View style={styles.stepContainer}>
              <View style={styles.iconCircle}>
                <Text style={styles.iconCircleGlyph}>🛡️</Text>
              </View>

              <Text style={styles.title}>Private on this phone.</Text>
              <Text style={styles.subtitle}>
                No account required. Your receipts and photos stay in a private vault on this
                device.
              </Text>

              <View style={styles.infoBox}>
                <Text style={styles.infoBoxTitle}>What this means for you</Text>
                <Text style={styles.infoItem}>
                  • <Text style={styles.infoItemBold}>Zero Cloud Uploads:</Text> We do not operate a
                  receipt backend or upload your photos to remote servers.
                </Text>
                <Text style={styles.infoItem}>
                  • <Text style={styles.infoItemBold}>Offline First:</Text> OCR, search, and
                  calculations run entirely on your phone without an internet connection.
                </Text>
                <Text style={styles.infoItem}>
                  • <Text style={styles.infoItemBold}>Encrypted Backup:</Text> Export AES-256
                  encrypted backups whenever you want to transfer or protect your records.
                </Text>
              </View>

              <View style={styles.cautionBox}>
                <Text style={styles.cautionText}>
                  ⚠️ Note: Because there are no accounts, we cannot reset a forgotten backup
                  password. Keep your backup password safe.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleAcceptLocalVault}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>I understand — Continue</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ======================================================= */}
          {/* SCREEN 3: First Receipt Capture Choice                  */}
          {/* ======================================================= */}
          {step === 3 && (
            <View style={styles.stepContainer}>
              <Text style={styles.title}>Save your first receipt.</Text>
              <Text style={styles.subtitle}>
                Choose how you want to add evidence into your private vault.
              </Text>

              <View style={styles.choiceGroup}>
                <TouchableOpacity
                  style={styles.choiceCard}
                  onPress={() => handleSelectCaptureMode("camera")}
                  activeOpacity={0.7}
                >
                  <Text style={styles.choiceIcon}>📷</Text>
                  <View style={styles.choiceTextCol}>
                    <Text style={styles.choiceTitle}>Take a photo</Text>
                    <Text style={styles.choiceDesc}>Snap a paper receipt or physical invoice</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.choiceCard}
                  onPress={() => handleSelectCaptureMode("gallery")}
                  activeOpacity={0.7}
                >
                  <Text style={styles.choiceIcon}>🖼️</Text>
                  <View style={styles.choiceTextCol}>
                    <Text style={styles.choiceTitle}>Choose a photo</Text>
                    <Text style={styles.choiceDesc}>
                      Import a screenshot or saved receipt image
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.choiceCard}
                  onPress={() => handleSelectCaptureMode("manual")}
                  activeOpacity={0.7}
                >
                  <Text style={styles.choiceIcon}>✍️</Text>
                  <View style={styles.choiceTextCol}>
                    <Text style={styles.choiceTitle}>Enter manually</Text>
                    <Text style={styles.choiceDesc}>Record details directly without an image</Text>
                  </View>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={handleFinish}
                activeOpacity={0.85}
              >
                <Text style={styles.secondaryBtnText}>Maybe later</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ======================================================= */}
          {/* SCREEN 4: Quick Save and Review                         */}
          {/* ======================================================= */}
          {step === 4 && (
            <View style={styles.stepContainer}>
              <Text style={styles.title}>Quick Save & Review</Text>
              <Text style={styles.subtitle}>
                Review details. You can save immediately before on-device recognition completes.
              </Text>

              {/* Form inputs */}
              <View style={styles.formSection}>
                <Text style={styles.inputLabel}>Merchant / Payee</Text>
                <TextInput
                  style={styles.textInput}
                  value={merchant}
                  onChangeText={setMerchant}
                  placeholder="e.g. National Bookstore, Shell"
                  placeholderTextColor={colors.brand.textMuted}
                />

                <Text style={styles.inputLabel}>Total Amount (₱)</Text>
                <TextInput
                  style={styles.textInput}
                  value={amountInput}
                  onChangeText={setAmountInput}
                  placeholder="0.00"
                  keyboardType="numeric"
                  placeholderTextColor={colors.brand.textMuted}
                />

                <Text style={styles.inputLabel}>What is this for? (Optional)</Text>
                <TextInput
                  style={styles.textInput}
                  value={purpose}
                  onChangeText={setPurpose}
                  placeholder="e.g. Project supplies, warranty proof"
                  placeholderTextColor={colors.brand.textMuted}
                />

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Default Collection:</Text>
                  <View style={styles.inboxPill}>
                    <Text style={styles.inboxPillText}>📥 Inbox</Text>
                  </View>
                </View>
              </View>

              <View style={styles.actionGroup}>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleQuickSave}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnText}>Save receipt</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={handleFinish}
                  activeOpacity={0.85}
                >
                  <Text style={styles.secondaryBtnText}>Finish later</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ======================================================= */}
          {/* SCREEN 5: First Value (Confirmation & Discovery)       */}
          {/* ======================================================= */}
          {step === 5 && (
            <View style={styles.stepContainer}>
              <View style={styles.successIconCircle}>
                <Text style={styles.successIconGlyph}>✓</Text>
              </View>

              <Text style={styles.title}>Saved on this phone.</Text>
              <Text style={styles.subtitle}>
                Your receipt is securely saved in your local SQLite vault.
              </Text>

              {/* Tip card */}
              <View style={styles.tipCard}>
                <Text style={styles.tipTitle}>💡 Quick Tip</Text>
                <Text style={styles.tipDesc}>
                  You can find this later by searching for "{merchant || "Bookstore"}", item
                  keywords, or your note.
                </Text>
              </View>

              <View style={styles.actionGroup}>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleFinish}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnText}>Done</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => setStep(3)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.secondaryBtnText}>Add another receipt</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.brand.background,
  },
  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.brand.border,
  },
  stepProgressContainer: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  progressDot: {
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.brand.border,
  },
  progressDotActive: {
    backgroundColor: colors.brand.primary,
  },
  skipButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    minHeight: 48,
    justifyContent: "center",
  },
  skipText: {
    ...typography.supporting,
    color: colors.brand.textSecondary,
    fontWeight: "600",
  },
  scrollContent: {
    padding: spacing.lg,
  },
  stepContainer: {
    paddingVertical: spacing.md,
  },
  brandMarkContainer: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  foldedDocSymbol: {
    width: 64,
    height: 76,
    backgroundColor: colors.brand.primary,
    borderRadius: 8,
    position: "relative",
    padding: 8,
    justifyContent: "center",
  },
  symbolCorner: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 18,
    height: 18,
    backgroundColor: colors.brand.primaryPressed,
    borderBottomLeftRadius: 4,
  },
  symbolTrailLine1: {
    height: 4,
    backgroundColor: colors.brand.primaryFg,
    borderRadius: 2,
    marginBottom: 6,
    width: "75%",
  },
  symbolTrailLine2: {
    height: 4,
    backgroundColor: colors.brand.primaryFg,
    borderRadius: 2,
    marginBottom: 6,
    width: "55%",
  },
  symbolTrailDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand.primaryFg,
  },
  title: {
    ...typography.mainTitle,
    color: colors.brand.textPrimary,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.brand.textSecondary,
    textAlign: "center",
    marginBottom: spacing.xxl,
    lineHeight: 22,
  },
  sampleReceiptCard: {
    backgroundColor: colors.brand.surface,
    borderRadius: borderRadius.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.brand.border,
    marginBottom: spacing.xxl,
  },
  sampleCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  sampleMerchant: {
    ...typography.bodyBold,
    color: colors.brand.textPrimary,
  },
  sampleAmount: {
    ...typography.heading2,
    color: colors.brand.primary,
    fontWeight: "700",
  },
  sampleDate: {
    ...typography.supporting,
    color: colors.brand.textSecondary,
    marginBottom: spacing.md,
  },
  sampleTagRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  sampleBadge: {
    backgroundColor: colors.status.success.bg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  sampleBadgeText: {
    ...typography.caption,
    color: colors.status.success.text,
    fontWeight: "600",
  },
  sampleBadgeAlt: {
    backgroundColor: colors.brand.surfaceAlt,
  },
  sampleBadgeAltText: {
    color: colors.brand.primary,
  },
  actionGroup: {
    gap: spacing.md,
  },
  primaryBtn: {
    backgroundColor: colors.brand.primary,
    height: spacing.buttonHeight,
    borderRadius: borderRadius.control,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryBtnText: {
    ...typography.bodyBold,
    color: colors.brand.primaryFg,
  },
  secondaryBtn: {
    height: spacing.buttonHeight,
    borderRadius: borderRadius.control,
    borderWidth: 1,
    borderColor: colors.brand.controlBorder,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.brand.surface,
  },
  secondaryBtnText: {
    ...typography.bodyBold,
    color: colors.brand.textPrimary,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brand.surfaceAlt,
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  iconCircleGlyph: {
    fontSize: 28,
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.status.success.bg,
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  successIconGlyph: {
    fontSize: 28,
    color: colors.status.success.text,
    fontWeight: "700",
  },
  infoBox: {
    backgroundColor: colors.brand.surface,
    borderRadius: borderRadius.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.brand.border,
    marginBottom: spacing.md,
  },
  infoBoxTitle: {
    ...typography.bodyBold,
    color: colors.brand.textPrimary,
    marginBottom: spacing.sm,
  },
  infoItem: {
    ...typography.supporting,
    color: colors.brand.textSecondary,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  infoItemBold: {
    fontWeight: "700",
    color: colors.brand.textPrimary,
  },
  cautionBox: {
    backgroundColor: colors.status.warning.bg,
    borderRadius: borderRadius.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.status.warning.border,
    marginBottom: spacing.xxl,
  },
  cautionText: {
    ...typography.caption,
    color: colors.status.warning.text,
    lineHeight: 18,
  },
  choiceGroup: {
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  choiceCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brand.surface,
    padding: spacing.lg,
    borderRadius: borderRadius.card,
    borderWidth: 1.5,
    borderColor: colors.brand.border,
    minHeight: 64,
  },
  choiceIcon: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  choiceTextCol: {
    flex: 1,
  },
  choiceTitle: {
    ...typography.bodyBold,
    color: colors.brand.textPrimary,
  },
  choiceDesc: {
    ...typography.supporting,
    color: colors.brand.textSecondary,
    marginTop: 2,
  },
  formSection: {
    backgroundColor: colors.brand.surface,
    borderRadius: borderRadius.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.brand.border,
    marginBottom: spacing.xxl,
  },
  inputLabel: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: "700",
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  textInput: {
    borderWidth: 1.5,
    borderColor: colors.brand.controlBorder,
    borderRadius: borderRadius.control,
    paddingHorizontal: spacing.md,
    height: 48,
    ...typography.body,
    color: colors.brand.textPrimary,
    backgroundColor: colors.brand.surface,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  metaLabel: {
    ...typography.supporting,
    color: colors.brand.textSecondary,
  },
  inboxPill: {
    backgroundColor: colors.brand.surfaceAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  inboxPillText: {
    ...typography.caption,
    color: colors.brand.primary,
    fontWeight: "700",
  },
  tipCard: {
    backgroundColor: colors.status.info.bg,
    borderRadius: borderRadius.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.status.info.border,
    marginBottom: spacing.xxl,
  },
  tipTitle: {
    ...typography.bodyBold,
    color: colors.status.info.text,
    marginBottom: spacing.xs,
  },
  tipDesc: {
    ...typography.supporting,
    color: colors.status.info.text,
    lineHeight: 20,
  },
});
