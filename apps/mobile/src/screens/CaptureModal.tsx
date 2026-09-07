/**
 * Add a receipt.
 *
 * Two honesty rules govern this screen.
 *
 * First, camera and gallery capture are not implemented in this build, so the
 * screen says so rather than offering buttons that quietly substitute a canned
 * sample. What it does offer — a worked scan example, and manual entry — is
 * labelled as exactly that.
 *
 * Second, a record's review status follows where its values came from. Every
 * capture used to be written as `reviewed`, which meant the review queue, the
 * Home warning and the "all caught up" state described a workflow nothing could
 * ever feed.
 */

import React, { useCallback, useMemo, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, View } from "react-native";
import {
  buildAttachmentPath,
  computeSha256,
  extractReceiptFromText,
  parseMoneyToMinorUnits,
  type DocumentType,
} from "@katibay/shared";

import { useTheme } from "../theme/ThemeContext";
import { useLocalVault } from "../vault-context";
import { useSnackbar } from "../components/SnackbarContext";
import {
  AppBar,
  AppText,
  Button,
  Card,
  Chip,
  Divider,
  Field,
  Notice,
  OptionRow,
} from "../components/primitives";
import { Icon } from "../components/Icon";
import {
  CURRENCY_OPTIONS,
  DOCUMENT_TYPE_OPTIONS,
  defaultCollectionForDocumentType,
} from "../constants/options";
import { todayIso, validateDateInput } from "../utils/dates";
import { haptics } from "../utils/haptics";

type Step = "choose" | "scanning" | "form";
type Provenance = "scanned" | "manual";

const SAMPLE_SCAN_TEXT = `HIGHLAND COFFEE ROASTERS
SM MEGAMALL MANDALUYONG
DATE: 2026-09-06
1 ICED AMERICANO           150.00
1 CROISSANT                120.00
SUBTOTAL                   270.00
VAT 12%                     32.40
TOTAL AMOUNT DUE         PHP 302.40
THANK YOU!`;

interface CaptureModalProps {
  visible: boolean;
  onClose: () => void;
}

interface FormState {
  merchant: string;
  date: string;
  amount: string;
  currency: string;
  documentType: DocumentType;
  purpose: string;
  notes: string;
  collectionIds: string[];
}

const EMPTY_FORM: FormState = {
  merchant: "",
  date: "",
  amount: "",
  currency: "PHP",
  documentType: "receipt",
  purpose: "",
  notes: "",
  collectionIds: [],
};

export function CaptureModal({ visible, onClose }: CaptureModalProps) {
  const { colors, spacing, radius } = useTheme();
  const { collections, saveReceipt, saveAttachment } = useLocalVault();
  const { showSnackbar } = useSnackbar();

  const [step, setStep] = useState<Step>("choose");
  const [provenance, setProvenance] = useState<Provenance>("manual");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  /** Fields the scan filled and the user has not touched. */
  const [scannedFields, setScannedFields] = useState<Set<keyof FormState>>(new Set());
  const [scanText, setScanText] = useState<string>("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    if (scanTimer.current) {
      clearTimeout(scanTimer.current);
      scanTimer.current = null;
    }
    setStep("choose");
    setProvenance("manual");
    setForm(EMPTY_FORM);
    setScannedFields(new Set());
    setScanText("");
    setAmountError(null);
    setDateError(null);
    setSaving(false);
  }, []);

  const isDirty = useMemo(
    () =>
      form.merchant.trim() !== "" ||
      form.amount.trim() !== "" ||
      form.purpose.trim() !== "" ||
      form.notes.trim() !== "",
    [form],
  );

  const requestClose = useCallback(() => {
    if (step === "form" && isDirty) {
      Alert.alert("Discard this receipt?", "Nothing has been saved yet.", [
        { text: "Keep editing", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            reset();
            onClose();
          },
        },
      ]);
      return;
    }
    reset();
    onClose();
  }, [step, isDirty, reset, onClose]);

  const update = useCallback((patch: Partial<FormState>) => {
    setForm((current) => ({ ...current, ...patch }));
    // Editing a scanned field means the user has taken ownership of it.
    setScannedFields((current) => {
      const next = new Set(current);
      for (const key of Object.keys(patch) as (keyof FormState)[]) next.delete(key);
      return next;
    });
  }, []);

  const startManual = useCallback(() => {
    haptics.tap();
    setProvenance("manual");
    setScannedFields(new Set());
    setScanText("");
    setForm({ ...EMPTY_FORM, date: todayIso() });
    setStep("form");
  }, []);

  const startSampleScan = useCallback(() => {
    haptics.tap();
    setProvenance("scanned");
    setStep("scanning");

    scanTimer.current = setTimeout(() => {
      const extracted = extractReceiptFromText(SAMPLE_SCAN_TEXT);
      const filled = new Set<keyof FormState>();
      if (extracted.merchant) filled.add("merchant");
      if (extracted.transaction_date) filled.add("date");
      if (extracted.total_minor_units !== null) filled.add("amount");
      if (extracted.currency) filled.add("currency");

      setScanText(SAMPLE_SCAN_TEXT);
      setScannedFields(filled);
      setForm({
        ...EMPTY_FORM,
        merchant: extracted.merchant ?? "",
        date: extracted.transaction_date ?? "",
        amount:
          extracted.total_minor_units === null
            ? ""
            : (extracted.total_minor_units / 100).toFixed(2),
        currency: extracted.currency ?? "PHP",
        documentType: extracted.document_type === "unknown" ? "receipt" : extracted.document_type,
      });
      setStep("form");
      haptics.success();
    }, 500);
  }, []);

  const handleSave = useCallback(() => {
    if (saving) return;

    const dateProblem = validateDateInput(form.date);
    if (dateProblem) {
      setDateError(dateProblem);
      haptics.error();
      return;
    }

    const trimmedAmount = form.amount.trim();
    const parsedAmount = trimmedAmount
      ? parseMoneyToMinorUnits(trimmedAmount, form.currency)
      : null;
    if (trimmedAmount && parsedAmount === null) {
      setAmountError("Enter an amount like 150.00, or leave it blank if you do not know it.");
      haptics.error();
      return;
    }

    setSaving(true);
    const receiptId = `rec_${Date.now()}`;
    const collectionIds = form.collectionIds.length
      ? form.collectionIds
      : [defaultCollectionForDocumentType(form.documentType)];

    // A value the user typed is confirmed by definition. A value a scan
    // produced and the user did not touch still needs checking.
    const stillScanned = Array.from(scannedFields).length > 0;

    try {
      saveReceipt({
        id: receiptId,
        title: form.merchant.trim() || `Receipt saved ${todayIso()}`,
        merchant: form.merchant.trim() || null,
        transaction_date: form.date.trim() || null,
        currency: form.currency,
        total_minor_units: parsedAmount,
        subtotal_minor_units: null,
        tax_minor_units: null,
        document_type: form.documentType,
        review_status: provenance === "scanned" && stillScanned ? "unreviewed" : "reviewed",
        notes: form.notes.trim() || null,
        purpose: form.purpose.trim() || null,
        tags: [],
        collection_ids: collectionIds,
        is_trashed: false,
        deleted_at: null,
      });

      if (scanText) {
        const bytes = new TextEncoder().encode(scanText);
        const relativePath = buildAttachmentPath(receiptId, ".txt");
        saveAttachment(
          {
            id: `att_${receiptId}`,
            receipt_id: receiptId,
            file_name: `${receiptId}.txt`,
            relative_path: relativePath,
            mime_type: "text/plain",
            file_size_bytes: bytes.length,
            sha256_hash: computeSha256(bytes),
            page_order: 1,
            ocr_text: scanText,
            created_at: new Date().toISOString(),
          },
          bytes,
        );
      }

      haptics.success();
      showSnackbar({
        message: `Saved on this phone${
          provenance === "scanned" && stillScanned ? " — confirm the amount when you can." : "."
        }`,
        tone: "success",
      });
      reset();
      onClose();
    } catch (error) {
      haptics.error();
      setSaving(false);
      showSnackbar({
        message:
          error instanceof Error
            ? `Could not save the receipt: ${error.message}`
            : "Could not save the receipt.",
        tone: "danger",
        durationMs: 6000,
      });
    }
  }, [
    saving,
    form,
    scannedFields,
    provenance,
    scanText,
    saveReceipt,
    saveAttachment,
    showSnackbar,
    reset,
    onClose,
  ]);

  const scannedHint = (field: keyof FormState) =>
    scannedFields.has(field) ? "From the scan — check this is right." : undefined;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={requestClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <AppBar
          title={step === "form" ? "Check and save" : "Add a receipt"}
          onBack={requestClose}
          actions={
            step === "form" ? <Button label="Save" onPress={handleSave} busy={saving} /> : undefined
          }
        />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={{
              padding: spacing.gutter,
              paddingBottom: spacing.xxxl * 2,
              gap: spacing.lg,
            }}
            keyboardShouldPersistTaps="handled"
          >
            {step === "choose" ? (
              <>
                <Notice
                  tone="info"
                  icon="info"
                  title="Camera capture is not in this build"
                  body="This pilot cannot take a photo or read your gallery yet. You can type a receipt in by hand, or run the worked scan example to see how review works."
                />

                <Card onPress={startManual} accessibilityLabel="Enter receipt details by hand">
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                    <Icon name="keyboard" size={24} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <AppText role="bodyStrong">Type it in</AppText>
                      <AppText role="small" tone="secondary">
                        Merchant, amount and why you kept it. Nothing is required except a merchant.
                      </AppText>
                    </View>
                    <Icon name="chevron" size={20} color={colors.textMuted} />
                  </View>
                </Card>

                <Card onPress={startSampleScan} accessibilityLabel="Run the worked scan example">
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                    <Icon name="scan" size={24} color={colors.textSecondary} />
                    <View style={{ flex: 1 }}>
                      <AppText role="bodyStrong">Run the scan example</AppText>
                      <AppText role="small" tone="secondary">
                        Uses a fixed sample receipt to show extraction and the review step. The
                        record it creates is real and yours to keep or delete.
                      </AppText>
                    </View>
                    <Icon name="chevron" size={20} color={colors.textMuted} />
                  </View>
                </Card>
              </>
            ) : step === "scanning" ? (
              <Card>
                <View style={{ gap: spacing.sm }}>
                  <AppText role="bodyStrong">Reading the sample receipt…</AppText>
                  <AppText role="small" tone="secondary">
                    Text is parsed on this phone. Nothing is sent anywhere.
                  </AppText>
                  <View
                    style={{
                      height: 6,
                      borderRadius: radius.full,
                      backgroundColor: colors.skeleton,
                      marginTop: spacing.sm,
                    }}
                  />
                </View>
              </Card>
            ) : (
              <>
                {scanText ? (
                  <View
                    style={{
                      backgroundColor: colors.surfaceSunken,
                      borderRadius: radius.card,
                      padding: spacing.lg,
                      gap: spacing.sm,
                    }}
                  >
                    <AppText role="label" tone="muted">
                      WHAT THE SCAN READ
                    </AppText>
                    <AppText role="small" tone="secondary">
                      {scanText}
                    </AppText>
                  </View>
                ) : null}

                {scannedFields.size > 0 ? (
                  <Notice
                    tone="warning"
                    icon="needsReview"
                    body="Fields filled by the scan are marked below. Anything you leave untouched is saved as needing review."
                  />
                ) : null}

                <Field
                  label="Merchant"
                  value={form.merchant}
                  onChangeText={(text) => update({ merchant: text })}
                  placeholder="e.g. Highland Coffee"
                  hint={scannedHint("merchant")}
                />

                <Field
                  label="Transaction date"
                  value={form.date}
                  onChangeText={(text) => {
                    update({ date: text });
                    setDateError(validateDateInput(text));
                  }}
                  placeholder="YYYY-MM-DD"
                  keyboardType="numbers-and-punctuation"
                  error={dateError}
                  hint={dateError ? undefined : scannedHint("date")}
                />

                <Field
                  label="Amount"
                  value={form.amount}
                  onChangeText={(text) => {
                    update({ amount: text });
                    const cleaned = text.trim();
                    setAmountError(
                      cleaned && parseMoneyToMinorUnits(cleaned, form.currency) === null
                        ? "Enter an amount like 150.00, or leave it blank."
                        : null,
                    );
                  }}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  error={amountError}
                  hint={
                    amountError
                      ? undefined
                      : scannedHint("amount") ??
                        "Blank means unknown. An unknown amount is never counted as zero."
                  }
                />

                <OptionRow
                  label="Currency"
                  options={CURRENCY_OPTIONS}
                  value={form.currency}
                  onChange={(currency) => update({ currency })}
                />

                <OptionRow
                  label="Document type"
                  options={DOCUMENT_TYPE_OPTIONS}
                  value={form.documentType}
                  onChange={(documentType) => update({ documentType })}
                />

                <View style={{ gap: spacing.sm }}>
                  <AppText role="smallStrong" tone="secondary">
                    File it in
                  </AppText>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                    {collections.map((collection) => {
                      const selected = form.collectionIds.includes(collection.id);
                      return (
                        <Chip
                          key={collection.id}
                          label={collection.name}
                          selected={selected}
                          onPress={() =>
                            update({
                              collectionIds: selected
                                ? form.collectionIds.filter((id) => id !== collection.id)
                                : [...form.collectionIds, collection.id],
                            })
                          }
                        />
                      );
                    })}
                  </View>
                  <AppText role="small" tone="muted">
                    Left unset, it goes to{" "}
                    {collections.find(
                      (c) => c.id === defaultCollectionForDocumentType(form.documentType),
                    )?.name ?? "Inbox"}
                    .
                  </AppText>
                </View>

                <Field
                  label="What is this for?"
                  value={form.purpose}
                  onChangeText={(text) => update({ purpose: text })}
                  placeholder="e.g. Client coffee, warranty proof"
                  hint="The reason you kept it is usually how you will look for it later."
                />

                <Field
                  label="Notes"
                  value={form.notes}
                  onChangeText={(text) => update({ notes: text })}
                  placeholder="Anything else worth remembering"
                  multiline
                />

                <Divider />

                <Button
                  label="Save receipt"
                  onPress={handleSave}
                  busy={saving}
                  fullWidth
                  icon="check"
                />
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
