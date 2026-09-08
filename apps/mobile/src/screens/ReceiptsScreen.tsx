/**
 * Receipts.
 *
 * Collections used to be a fourth tab that showed a taxonomy nothing could be
 * filed into, with an empty state instructing the user to do something the app
 * did not support. A collection is a slice of the receipt list, so it lives
 * here as a filter, and assignment now exists in the editor below.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  TextInput,
  View,
  type ListRenderItemInfo,
} from "react-native";
import {
  formatMoney,
  parseMoneyToMinorUnits,
  type AttachmentRecord,
  type DocumentType,
  type ReceiptRecord,
  type ReviewStatus,
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
  EmptyState,
  Field,
  IconButton,
  Money,
  Notice,
  OptionRow,
  StatusBadge,
  TagEditor,
  useContentInsets,
} from "../components/primitives";
import { Icon } from "../components/Icon";
import { ReceiptRow } from "../components/ReceiptRow";
import { CURRENCY_OPTIONS, DOCUMENT_TYPE_OPTIONS } from "../constants/options";
import { formatDate, validateDateInput } from "../utils/dates";
import { haptics } from "../utils/haptics";

type ListScope = "all" | "review" | "unfiled" | "trash";

interface ReceiptsScreenProps {
  initialFilter: {
    collectionId?: string;
    reviewOnly?: boolean;
    unfiledOnly?: boolean;
    focusReceiptId?: string;
  };
  onFilterConsumed: () => void;
  onStartCapture: () => void;
}

interface EditorState {
  merchant: string;
  date: string;
  amount: string;
  currency: string;
  documentType: DocumentType;
  purpose: string;
  notes: string;
  collectionIds: string[];
  tags: string[];
  customValues: Record<string, string>;
  reviewStatus: ReviewStatus;
}

function toEditorState(receipt: ReceiptRecord): EditorState {
  return {
    merchant: receipt.merchant ?? "",
    date: receipt.transaction_date ?? "",
    amount: receipt.total_minor_units === null ? "" : (receipt.total_minor_units / 100).toFixed(2),
    currency: receipt.currency ?? "PHP",
    documentType: receipt.document_type,
    purpose: receipt.purpose ?? "",
    notes: receipt.notes ?? "",
    collectionIds: [...receipt.collection_ids],
    tags: [...receipt.tags],
    customValues: { ...receipt.custom_fields },
    reviewStatus: receipt.review_status,
  };
}

function statesDiffer(a: EditorState, b: EditorState): boolean {
  return (
    a.merchant !== b.merchant ||
    a.date !== b.date ||
    a.amount !== b.amount ||
    a.currency !== b.currency ||
    a.documentType !== b.documentType ||
    a.purpose !== b.purpose ||
    a.notes !== b.notes ||
    a.reviewStatus !== b.reviewStatus ||
    a.collectionIds.slice().sort().join(",") !== b.collectionIds.slice().sort().join(",") ||
    a.tags.slice().sort().join(",") !== b.tags.slice().sort().join(",") ||
    JSON.stringify(a.customValues) !== JSON.stringify(b.customValues)
  );
}

export function ReceiptsScreen({
  initialFilter,
  onFilterConsumed,
  onStartCapture,
}: ReceiptsScreenProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const {
    vault,
    receipts,
    collections,
    customFields,
    tags: knownTags,
    setReceiptTags,
    setReceiptCustomFields,
    saveReceipt,
    setReceiptCollections,
    moveToTrash,
    restoreFromTrash,
    permanentlyDelete,
    getAttachments,
  } = useLocalVault();
  const { showSnackbar } = useSnackbar();
  const contentInsets = useContentInsets();

  const [scope, setScope] = useState<ListScope>(initialFilter.reviewOnly ? "review" : "all");
  const [collectionId, setCollectionId] = useState<string | null>(
    initialFilter.collectionId ?? null,
  );
  const [query, setQuery] = useState("");

  const [editing, setEditing] = useState<ReceiptRecord | null>(null);
  const [original, setOriginal] = useState<EditorState | null>(null);
  const [draft, setDraft] = useState<EditorState | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  // A caller (Home's review card, a collection chip, an assistant source) can
  // arrive with a filter or a specific record to open.
  useEffect(() => {
    if (initialFilter.reviewOnly) setScope("review");
    if (initialFilter.unfiledOnly) {
      setScope("unfiled");
      setCollectionId(null);
    }
    if (initialFilter.collectionId) {
      setCollectionId(initialFilter.collectionId);
      setScope("all");
    }
    if (initialFilter.focusReceiptId) {
      const target = vault.getReceipt(initialFilter.focusReceiptId);
      if (target) openEditor(target);
    }
    if (
      initialFilter.reviewOnly ||
      initialFilter.unfiledOnly ||
      initialFilter.collectionId ||
      initialFilter.focusReceiptId
    ) {
      onFilterConsumed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFilter]);

  const trashed = useMemo(() => vault.listReceipts({ trashScope: "trashed" }), [vault, receipts]);

  const visible = useMemo(() => {
    if (scope === "trash") {
      return query.trim()
        ? trashed.filter((r) =>
            `${r.merchant ?? ""} ${r.title} ${r.notes ?? ""}`
              .toLowerCase()
              .includes(query.trim().toLowerCase()),
          )
        : trashed;
    }
    const list = vault.listReceipts({
      trashScope: "active",
      searchQuery: query.trim() || undefined,
      collectionId: collectionId ?? undefined,
      reviewStatus: scope === "review" ? "unreviewed" : undefined,
    });
    // Unfiled means "in no collection at all", which the vault filter cannot
    // express as a collection id.
    return scope === "unfiled" ? list.filter((r) => r.collection_ids.length === 0) : list;
  }, [scope, query, collectionId, vault, receipts, trashed]);

  const collectionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const receipt of receipts) {
      for (const id of receipt.collection_ids) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    return counts;
  }, [receipts]);

  const reviewCount = useMemo(
    () => receipts.filter((r) => r.review_status !== "reviewed").length,
    [receipts],
  );

  /**
   * Possible duplicates of the receipt being edited. Suggestions only — the
   * blueprint is explicit that duplicate detection never deletes anything, so
   * this surfaces the match and leaves both records in place.
   */
  const editorDuplicates = useMemo(
    () => (editing ? vault.findDuplicatesOf(editing.id) : []),
    [editing, vault, receipts],
  );

  const editorAttachments = useMemo<AttachmentRecord[]>(
    () => (editing ? getAttachments(editing.id) : []),
    [editing, getAttachments],
  );

  const openEditor = useCallback((receipt: ReceiptRecord) => {
    const state = toEditorState(receipt);
    setEditing(receipt);
    setOriginal(state);
    setDraft(state);
    setAmountError(null);
    setDateError(null);
  }, []);

  const closeEditor = useCallback(() => {
    setEditing(null);
    setOriginal(null);
    setDraft(null);
  }, []);

  // Cancel and hardware Back both used to discard an edit silently. In an app
  // whose premise is never losing a record, that is the wrong default.
  const requestCloseEditor = useCallback(() => {
    if (!draft || !original || !statesDiffer(draft, original)) {
      closeEditor();
      return;
    }
    Alert.alert(
      "Discard your changes?",
      "The edits you made to this receipt have not been saved.",
      [
        { text: "Keep editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: closeEditor },
      ],
    );
  }, [draft, original, closeEditor]);

  const updateDraft = useCallback((patch: Partial<EditorState>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const handleSave = useCallback(() => {
    if (!editing || !draft) return;

    const dateProblem = validateDateInput(draft.date);
    if (dateProblem) {
      setDateError(dateProblem);
      haptics.error();
      return;
    }

    const trimmedAmount = draft.amount.trim();
    const parsedAmount = trimmedAmount
      ? parseMoneyToMinorUnits(trimmedAmount, draft.currency)
      : null;
    if (trimmedAmount && parsedAmount === null) {
      setAmountError("Enter an amount like 150.00, or leave it blank if you do not know it.");
      haptics.error();
      return;
    }

    saveReceipt({
      ...editing,
      merchant: draft.merchant.trim() || null,
      title: draft.merchant.trim() || editing.title,
      transaction_date: draft.date.trim() || null,
      // An unknown amount stays unknown. It is never coerced to zero.
      total_minor_units: parsedAmount,
      currency: draft.currency,
      document_type: draft.documentType,
      purpose: draft.purpose.trim() || null,
      notes: draft.notes.trim() || null,
      review_status: draft.reviewStatus,
    });
    setReceiptCollections(editing.id, draft.collectionIds);
    setReceiptTags(editing.id, draft.tags);
    setReceiptCustomFields(editing.id, draft.customValues);

    haptics.success();
    showSnackbar({ message: "Receipt updated on this phone.", tone: "success" });
    closeEditor();
  }, [
    editing,
    draft,
    saveReceipt,
    setReceiptCollections,
    setReceiptTags,
    setReceiptCustomFields,
    showSnackbar,
    closeEditor,
  ]);

  const handleTrash = useCallback(
    (receipt: ReceiptRecord) => {
      moveToTrash(receipt.id);
      haptics.warning();
      closeEditor();
      showSnackbar({
        message: `Moved "${receipt.merchant ?? receipt.title}" to Trash.`,
        tone: "warning",
        action: {
          label: "Undo",
          onPress: () => {
            restoreFromTrash(receipt.id);
            showSnackbar({ message: "Receipt restored.", tone: "success" });
          },
        },
      });
    },
    [moveToTrash, restoreFromTrash, closeEditor, showSnackbar],
  );

  const handlePermanentDelete = useCallback(
    (receipt: ReceiptRecord) => {
      Alert.alert(
        "Delete permanently?",
        `"${
          receipt.merchant ?? receipt.title
        }" and its attached original will be erased from this phone. This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              permanentlyDelete(receipt.id);
              haptics.warning();
              showSnackbar({ message: "Receipt permanently deleted.", tone: "danger" });
            },
          },
        ],
      );
    },
    [permanentlyDelete, showSnackbar],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ReceiptRecord>) =>
      scope === "trash" ? (
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <AppText role="bodyStrong" numberOfLines={1}>
                {item.merchant ?? item.title}
              </AppText>
              <AppText role="small" tone="muted">
                {formatDate(item.transaction_date)} ·{" "}
                {formatMoney(item.total_minor_units, item.currency)}
              </AppText>
            </View>
            <Button
              label="Restore"
              variant="tonal"
              icon="restore"
              onPress={() => {
                restoreFromTrash(item.id);
                showSnackbar({ message: "Receipt restored.", tone: "success" });
              }}
            />
            <IconButton
              icon="trash"
              tone="danger"
              label={`Delete ${item.merchant ?? item.title} permanently`}
              onPress={() => handlePermanentDelete(item)}
            />
          </View>
        </Card>
      ) : (
        <ReceiptRow
          receipt={item}
          onPress={openEditor}
          hasAttachment={getAttachments(item.id).length > 0}
        />
      ),
    [
      scope,
      spacing.md,
      restoreFromTrash,
      showSnackbar,
      handlePermanentDelete,
      openEditor,
      getAttachments,
    ],
  );

  const keyExtractor = useCallback((item: ReceiptRecord) => item.id, []);

  const activeCollection = collectionId
    ? collections.find((c) => c.id === collectionId) ?? null
    : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppBar
        title="Receipts"
        subtitle={
          scope === "trash"
            ? "Deleted receipts stay here until you empty the trash"
            : activeCollection
              ? `Filed in ${activeCollection.name}`
              : `${receipts.length} saved on this phone`
        }
      />

      <View style={{ paddingHorizontal: spacing.gutter, paddingTop: spacing.md, gap: spacing.md }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingHorizontal: spacing.md,
            backgroundColor: colors.surface,
            borderRadius: radius.control,
            borderWidth: 1.5,
            borderColor: colors.outline,
            minHeight: spacing.touch,
          }}
        >
          <Icon name="search" size={20} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Filter by merchant, note or text on the receipt"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel="Filter receipts"
            style={[typography.body, { flex: 1, color: colors.textPrimary, paddingVertical: 0 }]}
          />
          {query.length > 0 ? (
            <IconButton icon="clear" label="Clear filter" onPress={() => setQuery("")} />
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.gutter }}
        >
          <Chip
            label="All"
            selected={scope === "all" && !collectionId}
            onPress={() => {
              setScope("all");
              setCollectionId(null);
            }}
            count={receipts.length}
          />
          <Chip
            label="Needs review"
            selected={scope === "review"}
            onPress={() => {
              setScope("review");
              setCollectionId(null);
            }}
            count={reviewCount}
          />
          <Chip
            label="Unfiled"
            selected={scope === "unfiled"}
            onPress={() => {
              setScope("unfiled");
              setCollectionId(null);
            }}
            count={receipts.filter((r) => r.collection_ids.length === 0).length}
          />
          {collections.map((collection) => (
            <Chip
              key={collection.id}
              label={collection.name}
              selected={collectionId === collection.id && scope === "all"}
              onPress={() => {
                setScope("all");
                setCollectionId(collectionId === collection.id ? null : collection.id);
              }}
              count={collectionCounts.get(collection.id) ?? 0}
            />
          ))}
          <Chip
            label="Trash"
            selected={scope === "trash"}
            onPress={() => {
              setScope("trash");
              setCollectionId(null);
            }}
            count={trashed.length}
            icon="trash"
          />
        </ScrollView>
      </View>

      <FlatList
        data={visible}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        contentContainerStyle={contentInsets}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={9}
        removeClippedSubviews
        ListEmptyComponent={
          <EmptyState
            icon={scope === "trash" ? "trash" : scope === "review" ? "reviewed" : "receipts"}
            title={
              scope === "trash"
                ? "Trash is empty"
                : scope === "unfiled"
                  ? "Everything is filed"
                  : scope === "review"
                    ? "Everything has been reviewed"
                    : query.trim() || collectionId
                      ? "Nothing here yet"
                      : "No receipts saved yet"
            }
            body={
              scope === "trash"
                ? "Receipts you delete land here first, so a mistake is recoverable."
                : scope === "unfiled"
                  ? "Every receipt belongs to at least one collection."
                  : scope === "review"
                    ? "Every saved receipt has had its amount confirmed."
                    : collectionId
                      ? `Open a receipt and add it to ${
                          activeCollection?.name ?? "this collection"
                        } to file it here.`
                      : "Add your first receipt and it is written straight to this phone."
            }
            action={
              scope === "all" && !collectionId && !query.trim()
                ? { label: "Add a receipt", onPress: onStartCapture, icon: "add" }
                : undefined
            }
          />
        }
      />

      {/* --- Receipt editor --- */}
      <Modal
        visible={editing !== null}
        animationType="slide"
        onRequestClose={requestCloseEditor}
        transparent={false}
      >
        {editing && draft ? (
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            <AppBar
              title="Receipt details"
              onBack={requestCloseEditor}
              actions={
                <Button
                  label="Save"
                  onPress={handleSave}
                  style={{ paddingHorizontal: spacing.lg }}
                />
              }
            />

            <KeyboardAvoidingView
              style={{ flex: 1 }}
              // "height" is the behaviour that works on Android under
              // edge-to-edge, where the window no longer resizes for the IME.
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
                {/* Source evidence comes first: the record exists to point at
                    the original, so the original is what the eye meets. */}
                <View
                  style={{
                    backgroundColor: colors.surfaceSunken,
                    borderRadius: radius.card,
                    padding: spacing.lg,
                    gap: spacing.sm,
                  }}
                >
                  <AppText role="label" tone="muted">
                    ORIGINAL DOCUMENT
                  </AppText>
                  {editorAttachments.length === 0 ? (
                    <AppText role="small" tone="secondary">
                      No file attached — this record was typed in by hand.
                    </AppText>
                  ) : (
                    editorAttachments.map((attachment) => (
                      <View key={attachment.id} style={{ gap: spacing.xs }}>
                        <View
                          style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}
                        >
                          <Icon
                            name={attachment.mime_type.startsWith("image/") ? "image" : "document"}
                            size={18}
                            color={colors.textSecondary}
                          />
                          <AppText role="smallStrong" numberOfLines={1} style={{ flex: 1 }}>
                            {attachment.file_name}
                          </AppText>
                          <AppText role="small" tone="muted">
                            {(attachment.file_size_bytes / 1024).toFixed(1)} KB
                          </AppText>
                        </View>
                        {attachment.ocr_text ? (
                          <AppText role="small" tone="secondary" numberOfLines={6}>
                            {attachment.ocr_text}
                          </AppText>
                        ) : null}
                        <AppText role="small" tone="muted" numberOfLines={1}>
                          SHA-256 {attachment.sha256_hash.slice(0, 16)}…
                        </AppText>
                      </View>
                    ))
                  )}
                </View>

                {editorDuplicates.length > 0 ? (
                  <Notice
                    tone="warning"
                    icon="warning"
                    title={
                      editorDuplicates[0]?.confidence === "identical_file"
                        ? "You already have this exact file"
                        : "This may be a duplicate"
                    }
                    body={`${
                      editorDuplicates[0]?.reason ?? ""
                    } Both receipts are still here — Keeptrail never deletes one for you. Open Trash-worthy duplicates yourself if you want to remove one.`}
                    action={
                      <View style={{ marginTop: spacing.sm, alignSelf: "flex-start" }}>
                        <Button
                          label="Show the other receipt"
                          variant="tonal"
                          icon="receipts"
                          onPress={() => {
                            const other = editorDuplicates[0]
                              ? vault.getReceipt(editorDuplicates[0].candidateId)
                              : null;
                            if (other) {
                              closeEditor();
                              openEditor(other);
                            }
                          }}
                        />
                      </View>
                    }
                  />
                ) : null}

                {draft.reviewStatus !== "reviewed" ? (
                  <Notice
                    tone="warning"
                    icon="needsReview"
                    title="Confirm the amount"
                    body="These values have not been confirmed yet. Correct anything that is wrong, then mark the receipt reviewed."
                  />
                ) : null}

                <Field
                  label="Merchant"
                  value={draft.merchant}
                  onChangeText={(text) => updateDraft({ merchant: text })}
                  placeholder="e.g. National Book Store"
                />

                <Field
                  label="Transaction date"
                  value={draft.date}
                  onChangeText={(text) => {
                    updateDraft({ date: text });
                    setDateError(validateDateInput(text));
                  }}
                  placeholder="YYYY-MM-DD"
                  keyboardType="numbers-and-punctuation"
                  error={dateError}
                  hint="Leave blank if the date is not printed on the receipt."
                />

                <Field
                  label="Amount"
                  value={draft.amount}
                  onChangeText={(text) => {
                    updateDraft({ amount: text });
                    const cleaned = text.trim();
                    setAmountError(
                      cleaned && parseMoneyToMinorUnits(cleaned, draft.currency) === null
                        ? "Enter an amount like 150.00, or leave it blank."
                        : null,
                    );
                  }}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  error={amountError}
                  hint="Blank means the amount is unknown. It is never counted as zero."
                />

                {/* A picker, not a text field. A mistyped currency code used to
                    fork the totals silently and there was no way to find or fix
                    the affected record. */}
                <OptionRow
                  label="Currency"
                  options={CURRENCY_OPTIONS}
                  value={draft.currency}
                  onChange={(currency) => updateDraft({ currency })}
                  hint="Each currency is totalled separately and never blended."
                />

                <OptionRow
                  label="Document type"
                  options={DOCUMENT_TYPE_OPTIONS}
                  value={draft.documentType}
                  onChange={(documentType) => updateDraft({ documentType })}
                />

                {/* Collections are assignable here. Previously the app told the
                    user to "edit any receipt and assign it to this collection"
                    from a screen that had no such control. */}
                <View style={{ gap: spacing.sm }}>
                  <AppText role="smallStrong" tone="secondary">
                    Collections
                  </AppText>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                    {collections.map((collection) => {
                      const selected = draft.collectionIds.includes(collection.id);
                      return (
                        <Chip
                          key={collection.id}
                          label={collection.name}
                          selected={selected}
                          onPress={() =>
                            updateDraft({
                              collectionIds: selected
                                ? draft.collectionIds.filter((id) => id !== collection.id)
                                : [...draft.collectionIds, collection.id],
                            })
                          }
                        />
                      );
                    })}
                  </View>
                </View>

                <TagEditor
                  tags={draft.tags}
                  onChange={(tags) => updateDraft({ tags })}
                  suggestions={knownTags.map((entry) => entry.tag)}
                />

                <Field
                  label="What is this for?"
                  value={draft.purpose}
                  onChangeText={(text) => updateDraft({ purpose: text })}
                  placeholder="e.g. Office supplies, warranty proof"
                  hint="The reason you kept it is usually how you will search for it later."
                />

                <Field
                  label="Notes"
                  value={draft.notes}
                  onChangeText={(text) => updateDraft({ notes: text })}
                  placeholder="Claim reference, warranty terms, anything else"
                  multiline
                />

                {customFields.length > 0 ? (
                  <View style={{ gap: spacing.lg }}>
                    <Divider />
                    {customFields.map((definition) => (
                      <Field
                        key={definition.id}
                        label={definition.label}
                        value={draft.customValues[definition.id] ?? ""}
                        onChangeText={(text) =>
                          updateDraft({
                            customValues: { ...draft.customValues, [definition.id]: text },
                          })
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

                <View style={{ gap: spacing.md }}>
                  <AppText role="smallStrong" tone="secondary">
                    Review status
                  </AppText>
                  <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
                    <Chip
                      label="Reviewed"
                      selected={draft.reviewStatus === "reviewed"}
                      onPress={() => updateDraft({ reviewStatus: "reviewed" })}
                      icon="reviewed"
                    />
                    <Chip
                      label="Needs review"
                      selected={draft.reviewStatus !== "reviewed"}
                      onPress={() => updateDraft({ reviewStatus: "unreviewed" })}
                      icon="needsReview"
                    />
                  </View>
                </View>

                <Divider />

                <Button
                  label="Move to Trash"
                  variant="danger"
                  icon="trash"
                  fullWidth
                  onPress={() => handleTrash(editing)}
                  accessibilityHint="You can restore it from the Trash filter"
                />
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        ) : null}
      </Modal>
    </View>
  );
}
