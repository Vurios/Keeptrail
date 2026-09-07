import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Modal,
  Alert,
} from "react-native";
import { colors, spacing, borderRadius, typography } from "../theme/tokens";
import { useLocalVault } from "../vault-context";
import {
  extractReceiptFromText,
  parseMoneyToMinorUnits,
  computeSha256,
  DocumentType,
} from "@katibay/shared";

interface CaptureModalProps {
  visible: boolean;
  onClose: () => void;
}

export const CaptureModal: React.FC<CaptureModalProps> = ({
  visible,
  onClose,
}) => {
  const { vault, saveReceipt, refreshState } = useLocalVault();

  // Capture step: 'pick_method' | 'review_form'
  const [step, setStep] = useState<"pick_method" | "review_form">("pick_method");

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

  const resetForm = () => {
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
  };

  const handleCaptureSample = (scenario: "sample_food" | "sample_screenshot" | "manual") => {
    if (scenario === "manual") {
      setStep("review_form");
      setDate(new Date().toISOString().split("T")[0]);
      setSourceSnippet("Manual entry without image attachment.");
      return;
    }

    let mockOcrText = "";
    let mockFileName = "";

    if (scenario === "sample_food") {
      mockFileName = "receipt_cafe.jpg";
      mockOcrText = `
        HIGHLAND COFFEE ROASTERS
        SM MEGAMALL MANDALUYONG
        DATE: 2026-09-06
        1 ICED AMERICANO           150.00
        1 CROISSANT                120.00
        SUBTOTAL                   270.00
        VAT 12%                     32.40
        TOTAL AMOUNT DUE         ₱ 302.40
        THANK YOU!
      `;
    } else {
      mockFileName = "gcash_transfer.png";
      mockOcrText = `
        GCash
        Transfer Successful
        Sent to: Juan Dela Cruz
        09181234567
        Date: 2026-09-06
        Amount: PHP 1,500.00
      `;
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
      extracted.total_minor_units !== null
        ? (extracted.total_minor_units / 100).toFixed(2)
        : ""
    );
    setDocType(extracted.document_type);
    setStep("review_form");
  };

  const handleQuickSave = () => {
    const recId = `rec_${Date.now()}`;
    const parsedMinorUnits = amount.trim()
      ? parseMoneyToMinorUnits(amount, currency)
      : null;

    // 1. Save canonical receipt record in local vault
    saveReceipt({
      id: recId,
      title: merchant.trim() || `Receipt saved ${date}`,
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
        attachedBytes
      );
    }

    refreshState();
    resetForm();
    onClose();
    Alert.alert("Saved on this Phone", "Receipt stored securely in your private local vault.");
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
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              resetForm();
              onClose();
            }}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {step === "pick_method" ? "Add Receipt" : "Review & Quick Save"}
          </Text>
          {step === "review_form" ? (
            <TouchableOpacity onPress={handleQuickSave} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>

        {step === "pick_method" ? (
          <View style={styles.pickMethodContainer}>
            <Text style={styles.pickMethodTitle}>
              How would you like to save this record?
            </Text>
            <Text style={styles.pickMethodSubtitle}>
              All captures remain 100% on your device.
            </Text>

            <TouchableOpacity
              style={styles.methodCard}
              onPress={() => handleCaptureSample("sample_food")}
            >
              <Text style={styles.methodIcon}>📷</Text>
              <View style={styles.methodCol}>
                <Text style={styles.methodTitle}>Camera / Receipt Photo</Text>
                <Text style={styles.methodDesc}>
                  Capture paper receipt and run on-device OCR
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.methodCard}
              onPress={() => handleCaptureSample("sample_screenshot")}
            >
              <Text style={styles.methodIcon}>📱</Text>
              <View style={styles.methodCol}>
                <Text style={styles.methodTitle}>Payment Screenshot</Text>
                <Text style={styles.methodDesc}>
                  Import GCash, Maya, or bank transfer confirmation
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.methodCard}
              onPress={() => handleCaptureSample("manual")}
            >
              <Text style={styles.methodIcon}>✍️</Text>
              <View style={styles.methodCol}>
                <Text style={styles.methodTitle}>Enter Manually</Text>
                <Text style={styles.methodDesc}>
                  Quick record without a photo or document
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            style={styles.formContainer}
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Source Evidence Card */}
            <View style={styles.sourceCard}>
              <Text style={styles.sourceLabel}>ON-DEVICE EXTRACTION EVIDENCE</Text>
              <Text style={styles.sourceSnippet} numberOfLines={4}>
                {sourceSnippet}
              </Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Merchant / Payee</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Highland Coffee"
                value={merchant}
                onChangeText={setMerchant}
              />
            </View>

            <View style={styles.fieldRow}>
              <View style={[styles.fieldGroup, { flex: 1, marginRight: spacing.sm }]}>
                <Text style={styles.fieldLabel}>Date</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="YYYY-MM-DD"
                  value={date}
                  onChangeText={setDate}
                />
              </View>

              <View style={[styles.fieldGroup, { width: 90 }]}>
                <Text style={styles.fieldLabel}>Currency</Text>
                <TextInput
                  style={styles.textInput}
                  value={currency}
                  onChangeText={setCurrency}
                  autoCapitalize="characters"
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Total Amount (Optional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="0.00"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Purpose</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Client coffee, Groceries"
                value={purpose}
                onChangeText={setPurpose}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                style={[styles.textInput, styles.multilineInput]}
                placeholder="Any special details or warranty info..."
                value={notes}
                onChangeText={setNotes}
                multiline
              />
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.brand.surface,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.brand.border,
  },
  cancelText: {
    ...typography.body,
    color: colors.brand.textSecondary,
  },
  headerTitle: {
    ...typography.sectionTitle,
    color: colors.brand.textPrimary,
  },
  saveBtn: {
    backgroundColor: colors.brand.primary,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: borderRadius.md,
  },
  saveBtnText: {
    ...typography.bodyBold,
    color: colors.brand.primaryFg,
  },
  pickMethodContainer: {
    padding: spacing.xl,
  },
  pickMethodTitle: {
    ...typography.heading2,
    color: colors.brand.textPrimary,
    marginBottom: 4,
  },
  pickMethodSubtitle: {
    ...typography.supporting,
    color: colors.brand.textSecondary,
    marginBottom: spacing.xl,
  },
  methodCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brand.background,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    borderColor: colors.brand.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  methodIcon: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  methodCol: {
    flex: 1,
  },
  methodTitle: {
    ...typography.bodyBold,
    color: colors.brand.textPrimary,
  },
  methodDesc: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginTop: 2,
  },
  formContainer: {
    flex: 1,
  },
  formContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl * 2,
  },
  sourceCard: {
    backgroundColor: colors.brand.surfaceAlt,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.status.success.border,
    marginBottom: spacing.lg,
  },
  sourceLabel: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.brand.primary,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  sourceSnippet: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontStyle: "italic",
    lineHeight: 18,
  },
  fieldGroup: {
    marginBottom: spacing.md,
  },
  fieldRow: {
    flexDirection: "row",
  },
  fieldLabel: {
    ...typography.caption,
    fontWeight: "600",
    color: colors.brand.textSecondary,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: colors.brand.background,
    borderWidth: 1,
    borderColor: colors.brand.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 48,
    ...typography.body,
    color: colors.brand.textPrimary,
  },
  multilineInput: {
    height: 70,
    textAlignVertical: "top",
    paddingTop: spacing.sm,
  },
});
