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
  Platform,
  StatusBar,
  KeyboardAvoidingView,
} from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { useLocalVault } from "../vault-context";
import { haptics } from "../utils/haptics";

interface OnboardingModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenSampleReceipt?: () => void;
  onStartCapture?: () => void;
}

type OnboardingStep = 1 | 2 | 3 | 4 | 5;

export function OnboardingModal({ visible, onClose, onOpenSampleReceipt }: OnboardingModalProps) {
  const { colors, spacing, borderRadius, typography, isDark } = useTheme();
  const { saveReceipt } = useLocalVault();
  const [step, setStep] = useState<OnboardingStep>(1);

  // Form states for Step 4 (Quick Save)
  const [merchant, setMerchant] = useState("National Bookstore");
  const [amountInput, setAmountInput] = useState("450.00");
  const [purpose, setPurpose] = useState("Office supplies & notebooks");
  const [savedReceiptId, setSavedReceiptId] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleAmountChange = (text: string) => {
    setAmountInput(text);
    if (!text.trim()) {
      setAmountError(null);
      return;
    }
    const clean = text.replace(/,/g, "").trim();
    if (isNaN(Number(clean)) || Number(clean) < 0) {
      setAmountError("Please enter a valid amount (e.g. 450.00)");
    } else {
      setAmountError(null);
    }
  };

  const handleGetStarted = () => {
    haptics.tap();
    setStep(2);
  };

  const handleSeeExample = () => {
    haptics.tap();
    onClose();
    if (onOpenSampleReceipt) {
      onOpenSampleReceipt();
    }
  };

  const handleAcceptLocalVault = () => {
    haptics.tap();
    setStep(3);
  };

  const handleSelectCaptureMode = (mode: "camera" | "gallery" | "manual") => {
    haptics.tap();
    if (mode === "manual") {
      setMerchant("");
      setAmountInput("");
      setPurpose("");
    } else {
      setMerchant("National Bookstore");
      setAmountInput("450.00");
      setPurpose("Office supplies & notebooks");
    }
    setAmountError(null);
    setStep(4);
  };

  const handleQuickSave = () => {
    if (isSaving) return;

    if (amountError) {
      haptics.error();
      return;
    }

    setIsSaving(true);
    const rawMinor = amountInput.trim()
      ? Math.round(parseFloat(amountInput.replace(/[^0-9.]/g, "")) * 100)
      : null;

    const newRecord = saveReceipt({
      id: `rec_onboard_${Date.now()}`,
      title: merchant.trim() || `Receipt saved ${new Date().toISOString().split("T")[0]}`,
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

    haptics.success();
    setSavedReceiptId(newRecord.id);
    setIsSaving(false);
    setStep(5);
  };

  const handleFinish = () => {
    haptics.tap();
    onClose();
    setStep(1);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Step Indicator Header */}
          <View
            style={[
              styles.stepHeader,
              {
                backgroundColor: colors.surface,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <View style={styles.stepProgressContainer}>
              {([1, 2, 3, 4, 5] as OnboardingStep[]).map((s) => (
                <View
                  key={s}
                  style={[
                    styles.progressDot,
                    {
                      backgroundColor: s <= step ? colors.primary : colors.border,
                    },
                  ]}
                />
              ))}
            </View>
            {step > 1 && (
              <TouchableOpacity
                onPress={handleFinish}
                style={styles.skipButton}
                accessibilityLabel="Skip Onboarding"
                accessibilityRole="button"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip</Text>
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
                {/* Brand Symbol */}
                <View style={styles.brandMarkContainer}>
                  <View style={[styles.foldedDocSymbol, { backgroundColor: colors.primary }]}>
                    <View
                      style={[styles.symbolCorner, { backgroundColor: colors.primaryPressed }]}
                    />
                    <View
                      style={[styles.symbolTrailLine1, { backgroundColor: colors.primaryFg }]}
                    />
                    <View
                      style={[styles.symbolTrailLine2, { backgroundColor: colors.primaryFg }]}
                    />
                    <View style={[styles.symbolTrailDot, { backgroundColor: colors.primaryFg }]} />
                  </View>
                </View>

                <Text style={[styles.title, { color: colors.textPrimary }]}>
                  Keep the receipts that matter.
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  Save photos and screenshots. Find them when you need them.
                </Text>

                {/* Sample Card */}
                <View
                  style={[
                    styles.sampleReceiptCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.sampleCardHeader}>
                    <Text style={[styles.sampleMerchant, { color: colors.textPrimary }]}>
                      Mercury Drug
                    </Text>
                    <Text style={[styles.sampleAmount, { color: colors.primary }]}>₱ 328.50</Text>
                  </View>
                  <Text style={[styles.sampleDate, { color: colors.textSecondary }]}>
                    Aug 28, 2026 • Medical prescription
                  </Text>
                  <View style={styles.sampleTagRow}>
                    <View
                      style={[
                        styles.sampleBadge,
                        {
                          backgroundColor: colors.status.success.bg,
                        },
                      ]}
                    >
                      <Text style={[styles.sampleBadgeText, { color: colors.status.success.text }]}>
                        Saved on this phone
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.sampleBadge,
                        {
                          backgroundColor: colors.surfaceAlt,
                        },
                      ]}
                    >
                      <Text style={[styles.sampleBadgeText, { color: colors.primary }]}>
                        In Box
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.actionGroup}>
                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                    onPress={handleGetStarted}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Get started with Keeptrail"
                  >
                    <Text style={[styles.primaryBtnText, { color: colors.primaryFg }]}>
                      Get started
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.secondaryBtn,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={handleSeeExample}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="See an example receipt"
                  >
                    <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>
                      See an example
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ======================================================= */}
            {/* SCREEN 2: Local Vault Notice (No Accounts / Honest Privacy) */}
            {/* ======================================================= */}
            {step === 2 && (
              <View style={styles.stepContainer}>
                <View style={[styles.iconCircle, { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={styles.iconCircleGlyph}>🛡️</Text>
                </View>

                <Text style={[styles.title, { color: colors.textPrimary }]}>
                  Private on this phone.
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  No account required. Your receipts and photos stay in a private vault on this
                  device.
                </Text>

                <View
                  style={[
                    styles.infoBox,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.infoBoxTitle, { color: colors.textPrimary }]}>
                    What this means for you
                  </Text>
                  <Text style={[styles.infoItem, { color: colors.textSecondary }]}>
                    •{" "}
                    <Text style={[styles.infoItemBold, { color: colors.textPrimary }]}>
                      Zero Cloud Uploads:
                    </Text>{" "}
                    We do not operate a receipt backend or upload your photos to remote servers.
                  </Text>
                  <Text style={[styles.infoItem, { color: colors.textSecondary }]}>
                    •{" "}
                    <Text style={[styles.infoItemBold, { color: colors.textPrimary }]}>
                      Offline First:
                    </Text>{" "}
                    OCR, search, and calculations run entirely on your phone without an internet
                    connection.
                  </Text>
                  <Text style={[styles.infoItem, { color: colors.textSecondary }]}>
                    •{" "}
                    <Text style={[styles.infoItemBold, { color: colors.textPrimary }]}>
                      Encrypted Backup:
                    </Text>{" "}
                    Export AES-256 encrypted backups whenever you want to transfer or protect your
                    records.
                  </Text>
                </View>

                <View
                  style={[
                    styles.cautionBox,
                    {
                      backgroundColor: colors.status.warning.bg,
                      borderColor: colors.status.warning.border,
                    },
                  ]}
                >
                  <Text style={[styles.cautionText, { color: colors.status.warning.text }]}>
                    ⚠️ Note: Because there are no accounts, we cannot reset a forgotten backup
                    password. Keep your backup password safe.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                  onPress={handleAcceptLocalVault}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <Text style={[styles.primaryBtnText, { color: colors.primaryFg }]}>
                    I understand — Continue
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ======================================================= */}
            {/* SCREEN 3: First Receipt Capture Choice                  */}
            {/* ======================================================= */}
            {step === 3 && (
              <View style={styles.stepContainer}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>
                  Save your first receipt.
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  Choose how you want to add evidence into your private vault.
                </Text>

                <View style={styles.choiceGroup}>
                  <TouchableOpacity
                    style={[
                      styles.choiceCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => handleSelectCaptureMode("camera")}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                  >
                    <Text style={styles.choiceIcon}>📷</Text>
                    <View style={styles.choiceTextCol}>
                      <Text style={[styles.choiceTitle, { color: colors.textPrimary }]}>
                        Take a photo
                      </Text>
                      <Text style={[styles.choiceDesc, { color: colors.textSecondary }]}>
                        Snap a paper receipt or physical invoice
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.choiceCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => handleSelectCaptureMode("gallery")}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                  >
                    <Text style={styles.choiceIcon}>🖼️</Text>
                    <View style={styles.choiceTextCol}>
                      <Text style={[styles.choiceTitle, { color: colors.textPrimary }]}>
                        Choose a photo
                      </Text>
                      <Text style={[styles.choiceDesc, { color: colors.textSecondary }]}>
                        Import a screenshot or saved receipt image
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.choiceCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => handleSelectCaptureMode("manual")}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                  >
                    <Text style={styles.choiceIcon}>✍️</Text>
                    <View style={styles.choiceTextCol}>
                      <Text style={[styles.choiceTitle, { color: colors.textPrimary }]}>
                        Enter manually
                      </Text>
                      <Text style={[styles.choiceDesc, { color: colors.textSecondary }]}>
                        Record details directly without an image
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[
                    styles.secondaryBtn,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={handleFinish}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>
                    Maybe later
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ======================================================= */}
            {/* SCREEN 4: Quick Save and Review                         */}
            {/* ======================================================= */}
            {step === 4 && (
              <View style={styles.stepContainer}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>
                  Quick Save & Review
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  Review details. You can save immediately before on-device recognition completes.
                </Text>

                {/* Form inputs */}
                <View
                  style={[
                    styles.formSection,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                    Merchant / Payee
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.controlBorder,
                        color: colors.textPrimary,
                      },
                    ]}
                    value={merchant}
                    onChangeText={setMerchant}
                    placeholder="e.g. National Bookstore, Shell"
                    placeholderTextColor={colors.textMuted}
                  />

                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                    Total Amount (₱)
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: colors.surface,
                        borderColor: amountError
                          ? colors.status.danger.border
                          : colors.controlBorder,
                        color: colors.textPrimary,
                      },
                    ]}
                    value={amountInput}
                    onChangeText={handleAmountChange}
                    placeholder="0.00"
                    keyboardType="numeric"
                    placeholderTextColor={colors.textMuted}
                  />
                  {amountError && (
                    <Text style={[styles.inlineError, { color: colors.status.danger.text }]}>
                      {amountError}
                    </Text>
                  )}

                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                    What is this for? (Optional)
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.controlBorder,
                        color: colors.textPrimary,
                      },
                    ]}
                    value={purpose}
                    onChangeText={setPurpose}
                    placeholder="e.g. Project supplies, warranty proof"
                    placeholderTextColor={colors.textMuted}
                  />

                  <View style={styles.metaRow}>
                    <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
                      Default Collection:
                    </Text>
                    <View style={[styles.inboxPill, { backgroundColor: colors.surfaceAlt }]}>
                      <Text style={[styles.inboxPillText, { color: colors.primary }]}>
                        📥 Inbox
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.actionGroup}>
                  <TouchableOpacity
                    style={[
                      styles.primaryBtn,
                      {
                        backgroundColor: colors.primary,
                        opacity: isSaving ? 0.6 : 1,
                      },
                    ]}
                    onPress={handleQuickSave}
                    disabled={isSaving}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.primaryBtnText, { color: colors.primaryFg }]}>
                      {isSaving ? "Saving..." : "Save receipt"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.secondaryBtn,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={handleFinish}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>
                      Finish later
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ======================================================= */}
            {/* SCREEN 5: First Value (Confirmation & Discovery)       */}
            {/* ======================================================= */}
            {step === 5 && (
              <View style={styles.stepContainer}>
                <View
                  style={[
                    styles.successIconCircle,
                    {
                      backgroundColor: colors.status.success.bg,
                    },
                  ]}
                >
                  <Text style={[styles.successIconGlyph, { color: colors.status.success.text }]}>
                    ✓
                  </Text>
                </View>

                <Text style={[styles.title, { color: colors.textPrimary }]}>
                  Saved on this phone.
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  Your receipt is securely saved in your local private vault.
                </Text>

                {/* Tip card */}
                <View
                  style={[
                    styles.tipCard,
                    {
                      backgroundColor: colors.surfaceAlt,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.tipTitle, { color: colors.primary }]}>💡 Quick Tip</Text>
                  <Text style={[styles.tipDesc, { color: colors.textSecondary }]}>
                    You can find this later by searching for "{merchant || "Bookstore"}", item
                    keywords, or your note.
                  </Text>
                </View>

                <View style={styles.actionGroup}>
                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                    onPress={handleFinish}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.primaryBtnText, { color: colors.primaryFg }]}>Done</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.secondaryBtn,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => {
                      haptics.tap();
                      setStep(3);
                    }}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>
                      Add another receipt
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight || 24 : 0,
  },
  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  stepProgressContainer: {
    flexDirection: "row",
    gap: 6,
  },
  progressDot: {
    width: 24,
    height: 4,
    borderRadius: 2,
  },
  skipButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    minHeight: 44,
    justifyContent: "center",
  },
  skipText: {
    fontSize: 14,
    fontWeight: "600",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  stepContainer: {
    paddingVertical: 12,
  },
  brandMarkContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  foldedDocSymbol: {
    width: 64,
    height: 76,
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
    borderBottomLeftRadius: 4,
  },
  symbolTrailLine1: {
    height: 4,
    borderRadius: 2,
    marginBottom: 6,
    width: "75%",
  },
  symbolTrailLine2: {
    height: 4,
    borderRadius: 2,
    marginBottom: 6,
    width: "55%",
  },
  symbolTrailDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  sampleReceiptCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  sampleCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  sampleMerchant: {
    fontSize: 16,
    fontWeight: "700",
  },
  sampleAmount: {
    fontSize: 18,
    fontWeight: "800",
  },
  sampleDate: {
    fontSize: 13,
    marginBottom: 12,
  },
  sampleTagRow: {
    flexDirection: "row",
    gap: 8,
  },
  sampleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sampleBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  actionGroup: {
    gap: 12,
  },
  primaryBtn: {
    height: 52,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryBtn: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: "600",
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  iconCircleGlyph: {
    fontSize: 28,
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  successIconGlyph: {
    fontSize: 28,
    fontWeight: "700",
  },
  infoBox: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  infoBoxTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 8,
  },
  infoItem: {
    fontSize: 13,
    marginBottom: 8,
    lineHeight: 18,
  },
  infoItemBold: {
    fontWeight: "700",
  },
  cautionBox: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 24,
  },
  cautionText: {
    fontSize: 12,
    lineHeight: 18,
  },
  choiceGroup: {
    gap: 12,
    marginBottom: 24,
  },
  choiceCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    minHeight: 64,
  },
  choiceIcon: {
    fontSize: 28,
    marginRight: 14,
  },
  choiceTextCol: {
    flex: 1,
  },
  choiceTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  choiceDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  formSection: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
    marginTop: 10,
  },
  textInput: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
    fontSize: 15,
  },
  inlineError: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 8,
  },
  metaLabel: {
    fontSize: 13,
  },
  inboxPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  inboxPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  tipCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  tipDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
});
