import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Modal,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
} from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { useToast } from "../components/ToastContext";
import { useLocalVault } from "../vault-context";
import {
  extractReceiptFromText,
  parseMoneyToMinorUnits,
  computeSha256,
  DocumentType,
} from "@katibay/shared";
import { Skeleton } from "../components/Skeleton";
import { haptics } from "../utils/haptics";

interface CaptureModalProps {
  visible: boolean;
  onClose: () => void;
}

export const CaptureModal: React.FC<CaptureModalProps> = ({ visible, onClose }) => {
  const { colors, spacing, borderRadius, typography, isDark } = useTheme();
  const { vault, saveReceipt, refreshState } = useLocalVault();
  const { showToast } = useToast();

  // Capture step: 'pick_method' | 'processing' | 'review_form'
  const [step, setStep] = useState<"pick_method" | "processing" | "review_form">("pick_method");

  // Captured form fields
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("PHP");
  const [docType, setDocType] = useState<DocumentType>("receipt");
  const [purpose, setPurpose] = useState("");
  const [notes, setNotes] = useState("");
  const [sourceSnippet, setSourceSnippet] = useState("");
  const [attachedBytes, setAttachedBytes] = useState<Uint8Array | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const processingTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (processingTimerRef.current) {
        clearTimeout(processingTimerRef.current);
      }
    };
  }, []);

  const resetForm = () => {
    if (processingTimerRef.current) {
      clearTimeout(processingTimerRef.current);
      processingTimerRef.current = null;
    }
    setStep("pick_method");
    setMerchant("");
    setDate("");
    setAmount("");
    setCurrency("PHP");
    setDocType("receipt");
    setPurpose("");
    setNotes("");
    setSourceSnippet("");
    setAttachedBytes(null);
    setAmountError(null);
    setIsSaving(false);
  };

  const handleAmountChange = (text: string) => {
    setAmount(text);
    if (!text.trim()) {
      setAmountError(null);
      return;
    }
    const clean = text.replace(/,/g, "").trim();
    if (isNaN(Number(clean)) || Number(clean) < 0) {
      setAmountError("Please enter a valid amount (e.g. 150.00)");
    } else {
      setAmountError(null);
    }
  };

  const handleCaptureScenario = (scenario: "sample_food" | "sample_screenshot" | "manual") => {
    haptics.tap();

    if (scenario === "manual") {
      setDate(new Date().toISOString().split("T")[0]);
      setSourceSnippet("Manual entry without image attachment.");
      setStep("review_form");
      return;
    }

    setStep("processing");

    processingTimerRef.current = setTimeout(() => {
      let mockOcrText = "";

      if (scenario === "sample_food") {
        mockOcrText = `HIGHLAND COFFEE ROASTERS\nSM MEGAMALL MANDALUYONG\nDATE: 2026-09-06\n1 ICED AMERICANO           150.00\n1 CROISSANT                120.00\nSUBTOTAL                   270.00\nVAT 12%                     32.40\nTOTAL AMOUNT DUE         ₱ 302.40\nTHANK YOU!`;
      } else {
        mockOcrText = `GCash\nTransfer Successful\nSent to: Juan Dela Cruz\n09181234567\nDate: 2026-09-06\nAmount: PHP 1,500.00`;
      }

      // Run on-device OCR extraction
      const extracted = extractReceiptFromText(mockOcrText);
      const mockBytes = new TextEncoder().encode(mockOcrText);

      setAttachedBytes(mockBytes);
      setSourceSnippet(mockOcrText.trim());
      setMerchant(extracted.merchant || "");
      setDate(extracted.transaction_date || new Date().toISOString().split("T")[0]);
      setCurrency(extracted.currency || "PHP");
      setAmount(
        extracted.total_minor_units !== null ? (extracted.total_minor_units / 100).toFixed(2) : "",
      );
      setDocType(extracted.document_type);
      setStep("review_form");
      haptics.success();
    }, 450);
  };

  const handleQuickSave = () => {
    if (isSaving) return;

    if (amountError) {
      haptics.error();
      showToast({
        type: "error",
        title: "Invalid Amount",
        message: "Please enter a valid amount before saving.",
      });
      return;
    }

    setIsSaving(true);
    const recId = `rec_${Date.now()}`;
    const parsedMinorUnits = amount.trim() ? parseMoneyToMinorUnits(amount, currency) : null;
    const safeDate = date.trim() || new Date().toISOString().split("T")[0];

    // 1. Save canonical receipt record in local vault
    saveReceipt({
      id: recId,
      title: merchant.trim() || `Receipt saved ${safeDate}`,
      merchant: merchant.trim() || null,
      transaction_date: date.trim() || null,
      currency: currency.trim() || "PHP",
      total_minor_units: parsedMinorUnits,
      subtotal_minor_units: null,
      tax_minor_units: null,
      document_type: docType,
      review_status: "reviewed",
      notes: notes.trim() || null,
      purpose: purpose.trim() || null,
      tags: [docType],
      collection_ids: ["col_purchases"],
      is_trashed: false,
      deleted_at: null,
    });

    // 2. Save durable attachment file if bytes exist
    if (attachedBytes) {
      const relPath = `originals/2026/09/${recId}.jpg`;
      vault.saveAttachment(
        {
          id: `att_${Date.now()}`,
          receipt_id: recId,
          file_name: `${recId}.jpg`,
          relative_path: relPath,
          mime_type: "image/jpeg",
          file_size_bytes: attachedBytes.length,
          sha256_hash: computeSha256(attachedBytes),
          page_order: 1,
          ocr_text: sourceSnippet,
          created_at: new Date().toISOString(),
        },
        attachedBytes,
      );
    }

    refreshState();
    haptics.success();
    showToast({
      type: "success",
      title: "Saved on this Phone",
      message: `Receipt from "${
        merchant.trim() || "unnamed merchant"
      }" stored securely in your private vault.`,
      duration: 3500,
    });

    resetForm();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        resetForm();
        onClose();
      }}
    >
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.surface }]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View
            style={[
              styles.header,
              {
                backgroundColor: colors.surface,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => {
                haptics.tap();
                resetForm();
                onClose();
              }}
              style={styles.headerBtn}
              accessibilityRole="button"
              accessibilityLabel="Cancel receipt capture"
            >
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>

            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              {step === "pick_method"
                ? "Add Receipt"
                : step === "processing"
                  ? "Scanning..."
                  : "Review & Quick Save"}
            </Text>

            {step === "review_form" ? (
              <TouchableOpacity
                onPress={handleQuickSave}
                style={[
                  styles.saveBtn,
                  {
                    backgroundColor: colors.primary,
                    opacity: isSaving ? 0.6 : 1,
                  },
                ]}
                disabled={isSaving}
                accessibilityRole="button"
                accessibilityLabel="Save receipt to local vault"
              >
                <Text style={[styles.saveBtnText, { color: colors.primaryFg }]}>
                  {isSaving ? "Saving..." : "Save"}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: 54 }} />
            )}
          </View>

          {step === "pick_method" ? (
            <ScrollView
              contentContainerStyle={styles.pickMethodContainer}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.pickMethodTitle, { color: colors.textPrimary }]}>
                How would you like to save this record?
              </Text>
              <Text style={[styles.pickMethodSubtitle, { color: colors.textSecondary }]}>
                All images and text are analyzed on-device with zero cloud exposure.
              </Text>

              <TouchableOpacity
                style={[
                  styles.methodCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => handleCaptureScenario("sample_food")}
                accessibilityRole="button"
                accessibilityLabel="Take a photo of paper receipt"
              >
                <Text style={styles.methodIcon}>📷</Text>
                <View style={styles.methodCol}>
                  <Text style={[styles.methodTitle, { color: colors.textPrimary }]}>
                    Camera / Receipt Photo
                  </Text>
                  <Text style={[styles.methodDesc, { color: colors.textSecondary }]}>
                    Capture paper receipt and run on-device OCR
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.methodCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => handleCaptureScenario("sample_screenshot")}
                accessibilityRole="button"
                accessibilityLabel="Import payment screenshot from gallery"
              >
                <Text style={styles.methodIcon}>📱</Text>
                <View style={styles.methodCol}>
                  <Text style={[styles.methodTitle, { color: colors.textPrimary }]}>
                    Payment Screenshot
                  </Text>
                  <Text style={[styles.methodDesc, { color: colors.textSecondary }]}>
                    Import GCash, Maya, or banking screenshot
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.methodCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => handleCaptureScenario("manual")}
                accessibilityRole="button"
                accessibilityLabel="Enter receipt details manually"
              >
                <Text style={styles.methodIcon}>✍️</Text>
                <View style={styles.methodCol}>
                  <Text style={[styles.methodTitle, { color: colors.textPrimary }]}>
                    Enter Manually
                  </Text>
                  <Text style={[styles.methodDesc, { color: colors.textSecondary }]}>
                    Quick record without an image file
                  </Text>
                </View>
              </TouchableOpacity>
            </ScrollView>
          ) : step === "processing" ? (
            <View style={styles.processingContainer}>
              <View
                style={[
                  styles.processingCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text style={styles.processingIcon}>⚡</Text>
                <Text style={[styles.processingTitle, { color: colors.textPrimary }]}>
                  Analyzing On-Device
                </Text>
                <Text style={[styles.processingSubtitle, { color: colors.textSecondary }]}>
                  Reading merchant, date, and currency without cloud servers...
                </Text>
                <View style={{ width: "100%", gap: 8, marginTop: 16 }}>
                  <Skeleton width="100%" height={16} />
                  <Skeleton width="80%" height={16} />
                  <Skeleton width="60%" height={16} />
                </View>
              </View>
            </View>
          ) : (
            <ScrollView
              style={[styles.formContainer, { backgroundColor: colors.background }]}
              contentContainerStyle={styles.formContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Source Evidence Card */}
              <View
                style={[
                  styles.sourceCard,
                  {
                    backgroundColor: colors.surfaceAlt,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.sourceLabel, { color: colors.textSecondary }]}>
                  ON-DEVICE EXTRACTION EVIDENCE
                </Text>
                <Text
                  style={[styles.sourceSnippet, { color: colors.textPrimary }]}
                  numberOfLines={4}
                >
                  {sourceSnippet}
                </Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
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
                  placeholder="e.g. Highland Coffee"
                  placeholderTextColor={colors.textMuted}
                  value={merchant}
                  onChangeText={setMerchant}
                />
              </View>

              <View style={styles.fieldRow}>
                <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Date</Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.controlBorder,
                        color: colors.textPrimary,
                      },
                    ]}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textMuted}
                    value={date}
                    onChangeText={setDate}
                  />
                </View>

                <View style={[styles.fieldGroup, { width: 96 }]}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Currency</Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.controlBorder,
                        color: colors.textPrimary,
                      },
                    ]}
                    value={currency}
                    onChangeText={setCurrency}
                    autoCapitalize="characters"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                  Total Amount (Optional)
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colors.surface,
                      borderColor: amountError ? colors.status.danger.border : colors.controlBorder,
                      color: colors.textPrimary,
                    },
                  ]}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  value={amount}
                  onChangeText={handleAmountChange}
                  keyboardType="decimal-pad"
                />
                {amountError && (
                  <Text style={[styles.inlineError, { color: colors.status.danger.text }]}>
                    {amountError}
                  </Text>
                )}
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Purpose</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.controlBorder,
                      color: colors.textPrimary,
                    },
                  ]}
                  placeholder="e.g. Client coffee, Groceries"
                  placeholderTextColor={colors.textMuted}
                  value={purpose}
                  onChangeText={setPurpose}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Notes</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    styles.multilineInput,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.controlBorder,
                      color: colors.textPrimary,
                    },
                  ]}
                  placeholder="Any special details or warranty info..."
                  placeholderTextColor={colors.textMuted}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                />
              </View>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight || 24 : 0,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
  },
  headerBtn: {
    minWidth: 54,
    minHeight: 44,
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 15,
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  saveBtn: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 8,
    minHeight: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  pickMethodContainer: {
    padding: 20,
    paddingBottom: 60,
  },
  pickMethodTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 6,
  },
  pickMethodSubtitle: {
    fontSize: 13,
    marginBottom: 20,
    lineHeight: 18,
  },
  methodCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 12,
    minHeight: 68,
  },
  methodIcon: {
    fontSize: 28,
    marginRight: 14,
  },
  methodCol: {
    flex: 1,
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  methodDesc: {
    fontSize: 12,
    marginTop: 3,
  },
  processingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  processingCard: {
    width: "100%",
    padding: 24,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
  },
  processingIcon: {
    fontSize: 36,
    marginBottom: 10,
  },
  processingTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  processingSubtitle: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  formContainer: {
    flex: 1,
  },
  formContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sourceCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  sourceLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  sourceSnippet: {
    fontSize: 12,
    lineHeight: 16,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldRow: {
    flexDirection: "row",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  textInput: {
    height: 48,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  inlineError: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  multilineInput: {
    height: 72,
    paddingTop: 10,
    textAlignVertical: "top",
  },
});
