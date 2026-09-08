/**
 * Add a receipt.
 *
 * Real capture: camera, gallery and file import, each asking for its permission
 * at the moment it is chosen and each leaving the other routes open if it is
 * refused (blueprint §4, §7).
 *
 * Two rules shape the rest of the screen.
 *
 * **The original is committed before the record.** As soon as bytes exist they
 * are written to durable storage and a draft is saved pointing at them, so a
 * process death mid-capture loses neither the file nor what was typed. The
 * draft and its file are discarded only if the user abandons the capture.
 *
 * **Review status follows provenance.** A value the user typed is confirmed by
 * definition; a value extraction produced and nobody checked is not. Marking
 * every capture "reviewed" is what made the review queue unfeedable.
 *
 * There is no text-recognition engine in this build, so a photo is stored as
 * evidence and its fields are typed by hand. The screen says so rather than
 * implying the image was read.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, View } from "react-native";
import {
  extractReceiptFromText,
  parseMoneyToMinorUnits,
  type CaptureDraft,
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
  TagEditor,
} from "../components/primitives";
import { Icon, type IconName } from "../components/Icon";
import {
  CURRENCY_OPTIONS,
  DOCUMENT_TYPE_OPTIONS,
  defaultCollectionForDocumentType,
} from "../constants/options";
import {
  captureFromCamera,
  captureFromFiles,
  captureFromGallery,
  permissionDeniedMessage,
  type CaptureResult,
  type CaptureSource,
} from "../services/capture-sources";
import { todayIso, validateDateInput } from "../utils/dates";
import { haptics } from "../utils/haptics";

type Step = "choose" | "working" | "form";

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
  /** Set when reopening a draft recovered after the app was killed. */
  resumeDraftId?: string | null;
}

interface FormState {
  merchant: string;
  date: string;
  amount: string;
  currency: string;
  documentType: DocumentType;
  purpose: string;
  notes: string;
  tags: string[];
  collectionIds: string[];
}

interface AttachedOriginal {
  relativePath: string;
  fileName: string;
  mimeType: string;
  sha256: string;
  sizeBytes: number;
  source: CaptureSource | "sample";
}

const EMPTY_FORM: FormState = {
  merchant: "",
  date: "",
  amount: "",
  currency: "PHP",
  documentType: "receipt",
  purpose: "",
  notes: "",
  tags: [],
  collectionIds: [],
};

const SOURCE_LABEL: Record<AttachedOriginal["source"], string> = {
  camera: "Photo you took",
  gallery: "Image from your gallery",
  file: "Imported file",
  sample: "Worked example",
};

export function CaptureModal({ visible, onClose, resumeDraftId }: CaptureModalProps) {
  const { colors, spacing, radius } = useTheme();
  const {
    vault,
    collections,
    customFields,
    tags: knownTags,
    saveReceipt,
    commitAttachment,
    stageAttachment,
    saveDraft,
    discardDraft,
    setReceiptTags,
    setReceiptCustomFields,
    getAttachmentBytes,
  } = useLocalVault();
  const { showSnackbar } = useSnackbar();

  const [step, setStep] = useState<Step>("choose");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [attached, setAttached] = useState<AttachedOriginal | null>(null);
  const [sourceText, setSourceText] = useState<string | null>(null);
  /** Fields extraction filled that the user has not touched. */
  const [unconfirmed, setUnconfirmed] = useState<Set<keyof FormState>>(new Set());
  const [amountError, setAmountError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");

  const draftId = useRef<string>(`draft_${Date.now()}`);

  const reset = useCallback(() => {
    draftId.current = `draft_${Date.now()}`;
    setStep("choose");
    setForm(EMPTY_FORM);
    setCustomValues({});
    setAttached(null);
    setSourceText(null);
    setUnconfirmed(new Set());
    setAmountError(null);
    setDateError(null);
    setSaving(false);
    setBusyLabel("");
  }, []);

  // Resuming a draft recovered after the process was killed.
  useEffect(() => {
    if (!visible || !resumeDraftId) return;
    const draft = vault.getDraft(resumeDraftId);
    if (!draft) return;

    draftId.current = draft.id;
    setForm({
      merchant: draft.merchant,
      date: draft.transaction_date,
      amount: draft.amount,
      currency: draft.currency,
      documentType: draft.document_type,
      purpose: draft.purpose,
      notes: draft.notes,
      tags: draft.tags,
      collectionIds: draft.collection_ids,
    });
    setSourceText(draft.source_text);
    setUnconfirmed(new Set(draft.unconfirmed_fields as (keyof FormState)[]));
    setAttached(
      draft.attachment_relative_path
        ? {
            relativePath: draft.attachment_relative_path,
            fileName: draft.attachment_file_name ?? "original",
            mimeType: draft.attachment_mime_type ?? "application/octet-stream",
            sha256: draft.attachment_sha256 ?? "",
            sizeBytes: draft.attachment_size_bytes ?? 0,
            source: "file",
          }
        : null,
    );
    setStep("form");
  }, [visible, resumeDraftId, vault]);

  const isDirty = useMemo(
    () =>
      attached !== null ||
      form.merchant.trim() !== "" ||
      form.amount.trim() !== "" ||
      form.purpose.trim() !== "" ||
      form.notes.trim() !== "",
    [attached, form],
  );

  /** Persists the in-progress capture so a process death does not lose it. */
  const persistDraft = useCallback(
    (nextForm: FormState, nextUnconfirmed: Set<keyof FormState>) => {
      const now = new Date().toISOString();
      const draft: CaptureDraft = {
        id: draftId.current,
        merchant: nextForm.merchant,
        transaction_date: nextForm.date,
        amount: nextForm.amount,
        currency: nextForm.currency,
        document_type: nextForm.documentType,
        purpose: nextForm.purpose,
        notes: nextForm.notes,
        tags: nextForm.tags,
        collection_ids: nextForm.collectionIds,
        attachment_relative_path: attached?.relativePath ?? null,
        attachment_file_name: attached?.fileName ?? null,
        attachment_mime_type: attached?.mimeType ?? null,
        attachment_sha256: attached?.sha256 ?? null,
        attachment_size_bytes: attached?.sizeBytes ?? null,
        source_text: sourceText,
        unconfirmed_fields: Array.from(nextUnconfirmed),
        created_at: now,
        updated_at: now,
      };
      saveDraft(draft);
    },
    [attached, sourceText, saveDraft],
  );

  const update = useCallback(
    (patch: Partial<FormState>) => {
      setForm((current) => {
        const next = { ...current, ...patch };
        setUnconfirmed((currentUnconfirmed) => {
          const remaining = new Set(currentUnconfirmed);
          // Editing a field means the user has taken ownership of it.
          for (const key of Object.keys(patch) as (keyof FormState)[]) remaining.delete(key);
          persistDraft(next, remaining);
          return remaining;
        });
        return next;
      });
    },
    [persistDraft],
  );

  const requestClose = useCallback(() => {
    if (step === "form" && isDirty) {
      Alert.alert(
        "Keep this draft?",
        "Nothing has been saved as a receipt yet. Keeptrail can hold on to what you have so far, including the file.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              // Abandoned: the staged original goes with the draft.
              discardDraft(draftId.current, false);
              reset();
              onClose();
            },
          },
          {
            text: "Keep draft",
            onPress: () => {
              persistDraft(form, unconfirmed);
              reset();
              onClose();
              showSnackbar({
                message: "Draft kept. Add a receipt again to pick up where you left off.",
                tone: "neutral",
              });
            },
          },
        ],
      );
      return;
    }
    reset();
    onClose();
  }, [step, isDirty, discardDraft, reset, onClose, persistDraft, form, unconfirmed, showSnackbar]);

  /** Runs a capture source, commits the original, and opens the form. */
  const runCapture = useCallback(
    async (label: string, run: () => Promise<CaptureResult>, source: CaptureSource) => {
      haptics.tap();
      setBusyLabel(label);
      setStep("working");

      const result = await run();

      if (result.status === "cancelled") {
        setStep("choose");
        setBusyLabel("");
        return;
      }

      if (result.status === "permission_denied") {
        setStep("choose");
        setBusyLabel("");
        haptics.error();
        showSnackbar({
          message: permissionDeniedMessage(result),
          tone: "warning",
          durationMs: 6000,
        });
        return;
      }

      if (result.status === "failed") {
        setStep("choose");
        setBusyLabel("");
        haptics.error();
        showSnackbar({ message: result.reason, tone: "danger", durationMs: 6000 });
        return;
      }

      try {
        // Durable before anything else, so a crash from here on is recoverable.
        const staged = stageAttachment(draftId.current, result.file.bytes, result.file.fileName);
        setAttached({
          relativePath: staged.relativePath,
          fileName: result.file.fileName,
          mimeType: result.file.mimeType,
          sha256: staged.sha256,
          sizeBytes: staged.sizeBytes,
          source,
        });
        setSourceText(null);
        setUnconfirmed(new Set());
        setForm({ ...EMPTY_FORM, date: todayIso() });
        setStep("form");
        haptics.success();
      } catch (error) {
        setStep("choose");
        haptics.error();
        showSnackbar({
          message:
            error instanceof Error
              ? `The file could not be saved: ${error.message}`
              : "The file could not be saved.",
          tone: "danger",
          durationMs: 6000,
        });
      } finally {
        setBusyLabel("");
      }
    },
    [stageAttachment, showSnackbar],
  );

  const startManual = useCallback(() => {
    haptics.tap();
    setAttached(null);
    setSourceText(null);
    setUnconfirmed(new Set());
    setForm({ ...EMPTY_FORM, date: todayIso() });
    setStep("form");
  }, []);

  const startSampleExtraction = useCallback(() => {
    haptics.tap();
    const extracted = extractReceiptFromText(SAMPLE_SCAN_TEXT);
    const filled = new Set<keyof FormState>();
    if (extracted.merchant) filled.add("merchant");
    if (extracted.transaction_date) filled.add("date");
    if (extracted.total_minor_units !== null) filled.add("amount");

    const bytes = new TextEncoder().encode(SAMPLE_SCAN_TEXT);
    const staged = stageAttachment(draftId.current, bytes, "example-receipt.txt");
    setAttached({
      relativePath: staged.relativePath,
      fileName: "example-receipt.txt",
      mimeType: "text/plain",
      sha256: staged.sha256,
      sizeBytes: staged.sizeBytes,
      source: "sample",
    });
    setSourceText(SAMPLE_SCAN_TEXT);
    setUnconfirmed(filled);
    setForm({
      ...EMPTY_FORM,
      merchant: extracted.merchant ?? "",
      date: extracted.transaction_date ?? todayIso(),
      amount:
        extracted.total_minor_units === null ? "" : (extracted.total_minor_units / 100).toFixed(2),
      currency: extracted.currency ?? "PHP",
      documentType: extracted.document_type === "unknown" ? "receipt" : extracted.document_type,
    });
    setStep("form");
    haptics.success();
  }, [stageAttachment]);

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
    const stillUnconfirmed = unconfirmed.size > 0;

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
        // An unchecked extracted value still needs review; a typed one does not.
        review_status: stillUnconfirmed ? "unreviewed" : "reviewed",
        notes: form.notes.trim() || null,
        purpose: form.purpose.trim() || null,
        tags: form.tags,
        collection_ids: collectionIds,
        is_trashed: false,
        deleted_at: null,
      });

      if (form.tags.length > 0) setReceiptTags(receiptId, form.tags);
      if (Object.keys(customValues).length > 0) setReceiptCustomFields(receiptId, customValues);

      if (attached) {
        // Re-read the staged bytes and commit them under the receipt's own
        // path, so the stored original is addressed by the record that owns it.
        const bytes = getAttachmentBytes(attached.relativePath);
        if (bytes) {
          commitAttachment({
            receiptId,
            bytes,
            fileName: attached.fileName,
            mimeType: attached.mimeType,
            sourceText,
          });
        }
      }

      // The staged file has been superseded by the committed one.
      discardDraft(draftId.current, false);

      haptics.success();
      showSnackbar({
        message: stillUnconfirmed
          ? "Saved on this phone — confirm the amount when you can."
          : "Saved on this phone.",
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
    customValues,
    unconfirmed,
    attached,
    sourceText,
    saveReceipt,
    setReceiptTags,
    setReceiptCustomFields,
    getAttachmentBytes,
    commitAttachment,
    discardDraft,
    showSnackbar,
    reset,
    onClose,
  ]);

  const unconfirmedHint = (field: keyof FormState) =>
    unconfirmed.has(field) ? "Read from the example — check this is right." : undefined;

  const sourceOptions: { icon: IconName; title: string; body: string; onPress: () => void }[] = [
    {
      icon: "camera",
      title: "Take a photo",
      body: "Keeptrail asks for the camera only when you tap this.",
      onPress: () => runCapture("Opening the camera…", captureFromCamera, "camera"),
    },
    {
      icon: "gallery",
      title: "Choose an image",
      body: "Pick one photo or screenshot. Keeptrail never reads your whole gallery.",
      onPress: () => runCapture("Opening your gallery…", captureFromGallery, "gallery"),
    },
    {
      icon: "document",
      title: "Import a PDF or file",
      body: "Bring in an emailed invoice or a saved document.",
      onPress: () => runCapture("Opening your files…", captureFromFiles, "file"),
    },
    {
      icon: "keyboard",
      title: "Type it in",
      body: "No file needed. Merchant, amount, and why you kept it.",
      onPress: startManual,
    },
  ];

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
                {sourceOptions.map((option) => (
                  <Card
                    key={option.title}
                    onPress={option.onPress}
                    accessibilityLabel={option.title}
                    accessibilityHint={option.body}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                      <Icon name={option.icon} size={24} color={colors.primary} />
                      <View style={{ flex: 1 }}>
                        <AppText role="bodyStrong">{option.title}</AppText>
                        <AppText role="small" tone="secondary">
                          {option.body}
                        </AppText>
                      </View>
                      <Icon name="chevron" size={20} color={colors.textMuted} />
                    </View>
                  </Card>
                ))}

                <Notice
                  tone="neutral"
                  icon="info"
                  title="Photos are stored, not read"
                  body="This build has no text recognition, so Keeptrail keeps your photo as the original and you fill in the details yourself. The worked example shows how the review step behaves."
                  action={
                    <View style={{ marginTop: spacing.sm, alignSelf: "flex-start" }}>
                      <Button
                        label="Run the worked example"
                        variant="tonal"
                        icon="scan"
                        onPress={startSampleExtraction}
                      />
                    </View>
                  }
                />
              </>
            ) : step === "working" ? (
              <Card>
                <View style={{ gap: spacing.sm }} accessibilityLiveRegion="polite">
                  <AppText role="bodyStrong">{busyLabel}</AppText>
                  <AppText role="small" tone="secondary">
                    Nothing leaves this phone.
                  </AppText>
                </View>
              </Card>
            ) : (
              <>
                {attached ? (
                  <View
                    style={{
                      backgroundColor: colors.surfaceSunken,
                      borderRadius: radius.card,
                      padding: spacing.lg,
                      gap: spacing.sm,
                    }}
                  >
                    <AppText role="label" tone="muted">
                      ORIGINAL SAVED
                    </AppText>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                      <Icon
                        name={attached.mimeType.startsWith("image/") ? "image" : "document"}
                        size={18}
                        color={colors.textSecondary}
                      />
                      <AppText role="smallStrong" numberOfLines={1} style={{ flex: 1 }}>
                        {attached.fileName}
                      </AppText>
                      <AppText role="small" tone="muted">
                        {(attached.sizeBytes / 1024).toFixed(1)} KB
                      </AppText>
                    </View>
                    <AppText role="small" tone="muted">
                      {SOURCE_LABEL[attached.source]} · already written to this phone
                    </AppText>
                    {sourceText ? (
                      <AppText role="small" tone="secondary">
                        {sourceText}
                      </AppText>
                    ) : null}
                  </View>
                ) : null}

                {unconfirmed.size > 0 ? (
                  <Notice
                    tone="warning"
                    icon="needsReview"
                    body="Fields read from the example are marked below. Anything you leave untouched is saved as needing review."
                  />
                ) : null}

                <Field
                  label="Merchant"
                  value={form.merchant}
                  onChangeText={(text) => update({ merchant: text })}
                  placeholder="e.g. Highland Coffee"
                  hint={unconfirmedHint("merchant")}
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
                  hint={dateError ? undefined : unconfirmedHint("date")}
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
                      : unconfirmedHint("amount") ??
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

                <TagEditor
                  tags={form.tags}
                  onChange={(tags) => update({ tags })}
                  suggestions={knownTags.map((entry) => entry.tag)}
                />

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

                {customFields.length > 0 ? (
                  <View style={{ gap: spacing.lg }}>
                    <Divider />
                    {customFields.map((definition) => (
                      <Field
                        key={definition.id}
                        label={definition.label}
                        value={customValues[definition.id] ?? ""}
                        onChangeText={(text) =>
                          setCustomValues((current) => ({ ...current, [definition.id]: text }))
                        }
                        placeholder={
                          definition.field_type === "date"
                            ? "YYYY-MM-DD"
                            : definition.field_type === "number"
                              ? "0"
                              : ""
                        }
                        keyboardType={
                          definition.field_type === "number" ? "decimal-pad" : "default"
                        }
                      />
                    ))}
                  </View>
                ) : null}

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
