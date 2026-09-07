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
  formatMoney,
  parseMoneyToMinorUnits,
  ReceiptRecord,
  DocumentType,
  ReviewStatus,
} from "@katibay/shared";

interface ReceiptsScreenProps {
  selectedReceipt?: ReceiptRecord | null;
  onClearSelectedReceipt?: () => void;
}

export const ReceiptsScreen: React.FC<ReceiptsScreenProps> = ({
  selectedReceipt,
  onClearSelectedReceipt,
}) => {
  const {
    vault,
    receipts,
    saveReceipt,
    moveToTrash,
    restoreFromTrash,
    permanentlyDelete,
    collections,
  } = useLocalVault();

  const [activeTab, setActiveTab] = useState<"all" | "review" | "trash">("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [editingReceipt, setEditingReceipt] = useState<ReceiptRecord | null>(
    selectedReceipt || null
  );

  // Edit form state
  const [formMerchant, setFormMerchant] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formCurrency, setFormCurrency] = useState("PHP");
  const [formDocType, setFormDocType] = useState<DocumentType>("receipt");
  const [formPurpose, setFormPurpose] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formStatus, setFormStatus] = useState<ReviewStatus>("reviewed");

  const openEditor = (r: ReceiptRecord) => {
    setEditingReceipt(r);
    setFormMerchant(r.merchant || "");
    setFormDate(r.transaction_date || "");
    setFormAmount(
      r.total_minor_units !== null
        ? (r.total_minor_units / 100).toFixed(2)
        : ""
    );
    setFormCurrency(r.currency || "PHP");
    setFormDocType(r.document_type);
    setFormPurpose(r.purpose || "");
    setFormNotes(r.notes || "");
    setFormStatus(r.review_status);
  };

  const closeEditor = () => {
    setEditingReceipt(null);
    if (onClearSelectedReceipt) onClearSelectedReceipt();
  };

  const handleSaveEdits = () => {
    if (!editingReceipt) return;

    const parsedMinorUnits = formAmount.trim()
      ? parseMoneyToMinorUnits(formAmount, formCurrency)
      : null;

    saveReceipt({
      ...editingReceipt,
      merchant: formMerchant.trim() || null,
      transaction_date: formDate.trim() || null,
      currency: formCurrency,
      total_minor_units: parsedMinorUnits,
      document_type: formDocType,
      purpose: formPurpose.trim() || null,
      notes: formNotes.trim() || null,
      review_status: formStatus,
    });

    closeEditor();
  };

  const handleTrashToggle = (r: ReceiptRecord) => {
    if (r.is_trashed) {
      restoreFromTrash(r.id);
    } else {
      moveToTrash(r.id);
    }
    closeEditor();
  };

  const handleDeletePermanent = (r: ReceiptRecord) => {
    Alert.alert(
      "Permanently Delete",
      "Are you sure you want to permanently delete this receipt and its attachments? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Forever",
          style: "destructive",
          onPress: () => {
            permanentlyDelete(r.id);
            closeEditor();
          },
        },
      ]
    );
  };

  // Determine list items based on active tab
  let displayedList: ReceiptRecord[] = [];
  if (activeTab === "trash") {
    displayedList = vault.listReceipts({ includeTrashed: true });
  } else if (activeTab === "review") {
    displayedList = receipts.filter((r) => r.review_status !== "reviewed");
  } else {
    displayedList = receipts;
  }

  if (searchFilter.trim()) {
    const q = searchFilter.toLowerCase();
    displayedList = displayedList.filter(
      (r) =>
        (r.merchant || "").toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        (r.notes || "").toLowerCase().includes(q)
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header Title */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Receipts</Text>
          <Text style={styles.headerSubtitle}>
            {receipts.length} total saved on phone
          </Text>
        </View>

        {/* Tab Filter Chips */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabChip, activeTab === "all" && styles.tabChipActive]}
            onPress={() => setActiveTab("all")}
          >
            <Text
              style={[
                styles.tabChipText,
                activeTab === "all" && styles.tabChipTextActive,
              ]}
            >
              All ({receipts.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabChip, activeTab === "review" && styles.tabChipActive]}
            onPress={() => setActiveTab("review")}
          >
            <Text
              style={[
                styles.tabChipText,
                activeTab === "review" && styles.tabChipTextActive,
              ]}
            >
              Needs Review (
              {receipts.filter((r) => r.review_status !== "reviewed").length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabChip, activeTab === "trash" && styles.tabChipActive]}
            onPress={() => setActiveTab("trash")}
          >
            <Text
              style={[
                styles.tabChipText,
                activeTab === "trash" && styles.tabChipTextActive,
              ]}
            >
              Trash ({vault.listReceipts({ includeTrashed: true }).length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Filter by merchant or notes..."
            placeholderTextColor={colors.brand.textMuted}
            value={searchFilter}
            onChangeText={setSearchFilter}
          />
        </View>

        {/* List Content */}
        <ScrollView contentContainerStyle={styles.listContainer}>
          {displayedList.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>📂</Text>
              <Text style={styles.emptyTitle}>No receipts in this view</Text>
            </View>
          ) : (
            displayedList.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={[styles.receiptCard, r.is_trashed && styles.trashedCard]}
                onPress={() => openEditor(r)}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardMerchant} numberOfLines={1}>
                    {r.merchant || r.title}
                  </Text>
                  <Text style={styles.cardAmount}>
                    {formatMoney(r.total_minor_units, r.currency)}
                  </Text>
                </View>

                <View style={styles.cardMetaRow}>
                  <Text style={styles.cardDate}>
                    {r.transaction_date || "No date"}
                  </Text>

                  <View style={styles.badgeRow}>
                    <View style={styles.docTypeBadge}>
                      <Text style={styles.docTypeBadgeText}>{r.document_type}</Text>
                    </View>

                    <View
                      style={[
                        styles.reviewBadge,
                        r.review_status === "reviewed"
                          ? styles.badgeReviewed
                          : styles.badgeUnreviewed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.reviewBadgeText,
                          r.review_status === "reviewed"
                            ? styles.textReviewed
                            : styles.textUnreviewed,
                        ]}
                      >
                        {r.review_status === "reviewed"
                          ? "Reviewed"
                          : "Needs Review"}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        {/* Receipt Detail / Review Editor Modal */}
        <Modal
          visible={!!editingReceipt}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={closeEditor}
        >
          {editingReceipt && (
            <SafeAreaView style={styles.modalSafeArea}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={closeEditor} style={styles.modalCloseBtn}>
                  <Text style={styles.modalCloseText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Receipt Details</Text>
                <TouchableOpacity onPress={handleSaveEdits} style={styles.modalSaveBtn}>
                  <Text style={styles.modalSaveText}>Save</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalBody}
                contentContainerStyle={styles.modalBodyContent}
              >
                {/* Source Above Fields Preview */}
                <View style={styles.sourceBox}>
                  <Text style={styles.sourceBoxLabel}>DOCUMENT SOURCE EVIDENCE</Text>
                  <View style={styles.sourcePreviewCard}>
                    <Text style={styles.sourceFileText}>
                      📄 Attached Original:{" "}
                      {vault.getAttachmentsForReceipt(editingReceipt.id)[0]?.file_name ||
                        "Manual Entry (No image)"}
                    </Text>
                    {vault.getAttachmentsForReceipt(editingReceipt.id)[0]?.ocr_text ? (
                      <Text style={styles.ocrSnippet} numberOfLines={3}>
                        OCR:{" "}
                        {vault.getAttachmentsForReceipt(editingReceipt.id)[0]
                          ?.ocr_text}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* Editable Fields */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Merchant / Payee</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={formMerchant}
                    onChangeText={setFormMerchant}
                    placeholder="e.g. Jollibee, National Book Store"
                  />
                </View>

                <View style={styles.fieldRow}>
                  <View style={[styles.fieldGroup, { flex: 1, marginRight: spacing.sm }]}>
                    <Text style={styles.fieldLabel}>Date (YYYY-MM-DD)</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={formDate}
                      onChangeText={setFormDate}
                      placeholder="2026-09-06"
                    />
                  </View>

                  <View style={[styles.fieldGroup, { width: 90 }]}>
                    <Text style={styles.fieldLabel}>Currency</Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={formCurrency}
                      onChangeText={setFormCurrency}
                      autoCapitalize="characters"
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Total Amount</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={formAmount}
                    onChangeText={setFormAmount}
                    placeholder="0.00 (leave blank if unknown)"
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Purpose / Category</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={formPurpose}
                    onChangeText={setFormPurpose}
                    placeholder="e.g. Office supplies, Groceries"
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Notes</Text>
                  <TextInput
                    style={[styles.fieldInput, styles.fieldMultiline]}
                    value={formNotes}
                    onChangeText={setFormNotes}
                    placeholder="Additional details..."
                    multiline
                  />
                </View>

                {/* Review Status Toggle */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Review Status</Text>
                  <View style={styles.toggleRow}>
                    <TouchableOpacity
                      style={[
                        styles.toggleBtn,
                        formStatus === "reviewed" && styles.toggleBtnActive,
                      ]}
                      onPress={() => setFormStatus("reviewed")}
                    >
                      <Text
                        style={[
                          styles.toggleBtnText,
                          formStatus === "reviewed" && styles.toggleBtnTextActive,
                        ]}
                      >
                        ✓ Reviewed
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.toggleBtn,
                        formStatus === "unreviewed" && styles.toggleBtnActive,
                      ]}
                      onPress={() => setFormStatus("unreviewed")}
                    >
                      <Text
                        style={[
                          styles.toggleBtnText,
                          formStatus === "unreviewed" && styles.toggleBtnTextActive,
                        ]}
                      >
                        ⚠️ Needs Attention
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Danger Zone: Trash / Permanent Delete */}
                <View style={styles.dangerZone}>
                  <TouchableOpacity
                    style={styles.trashBtn}
                    onPress={() => handleTrashToggle(editingReceipt)}
                  >
                    <Text style={styles.trashBtnText}>
                      {editingReceipt.is_trashed
                        ? "Restore from Trash"
                        : "Move to Trash"}
                    </Text>
                  </TouchableOpacity>

                  {editingReceipt.is_trashed && (
                    <TouchableOpacity
                      style={styles.deletePermanentBtn}
                      onPress={() => handleDeletePermanent(editingReceipt)}
                    >
                      <Text style={styles.deletePermanentText}>
                        Permanently Delete
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            </SafeAreaView>
          )}
        </Modal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.brand.background,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    ...typography.mainTitle,
    color: colors.brand.textPrimary,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginTop: 2,
  },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  tabChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: borderRadius.full,
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: colors.brand.border,
    marginRight: spacing.sm,
  },
  tabChipActive: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  tabChipText: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: "600",
  },
  tabChipTextActive: {
    color: colors.brand.primaryFg,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: colors.brand.border,
    borderRadius: borderRadius.control,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    height: 44,
    marginBottom: spacing.md,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.supporting,
    color: colors.brand.textPrimary,
  },
  listContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl * 2,
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    ...typography.bodyBold,
    color: colors.brand.textSecondary,
  },
  receiptCard: {
    backgroundColor: colors.brand.surface,
    borderRadius: borderRadius.control,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.brand.border,
    marginBottom: spacing.sm,
  },
  trashedCard: {
    opacity: 0.6,
    backgroundColor: "#F3F4F6",
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cardMerchant: {
    ...typography.bodyBold,
    color: colors.brand.textPrimary,
    flex: 1,
    marginRight: spacing.md,
  },
  cardAmount: {
    ...typography.bodyBold,
    color: colors.brand.primary,
  },
  cardMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardDate: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  badgeRow: {
    flexDirection: "row",
  },
  docTypeBadge: {
    backgroundColor: colors.brand.surfaceAlt,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: borderRadius.sm,
    marginRight: 6,
  },
  docTypeBadgeText: {
    ...typography.caption,
    fontSize: 10,
    color: colors.brand.primary,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  reviewBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: borderRadius.sm,
  },
  badgeReviewed: {
    backgroundColor: colors.status.success.bg,
  },
  badgeUnreviewed: {
    backgroundColor: colors.status.warning.bg,
  },
  reviewBadgeText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: "700",
  },
  textReviewed: {
    color: colors.status.success.text,
  },
  textUnreviewed: {
    color: colors.status.warning.text,
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: colors.brand.surface,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.brand.border,
  },
  modalCloseBtn: {
    padding: spacing.xs,
  },
  modalCloseText: {
    ...typography.body,
    color: colors.brand.textSecondary,
  },
  modalTitle: {
    ...typography.sectionTitle,
    color: colors.brand.textPrimary,
  },
  modalSaveBtn: {
    backgroundColor: colors.brand.primary,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: borderRadius.md,
  },
  modalSaveText: {
    ...typography.bodyBold,
    color: colors.brand.primaryFg,
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  sourceBox: {
    marginBottom: spacing.lg,
  },
  sourceBoxLabel: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  sourcePreviewCard: {
    backgroundColor: colors.brand.surfaceAlt,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.status.success.border,
  },
  sourceFileText: {
    ...typography.supporting,
    color: colors.brand.textPrimary,
    fontWeight: "600",
  },
  ocrSnippet: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginTop: 4,
    fontStyle: "italic",
  },
  fieldGroup: {
    marginBottom: spacing.md,
  },
  fieldRow: {
    flexDirection: "row",
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: "600",
    marginBottom: 4,
  },
  fieldInput: {
    backgroundColor: colors.brand.background,
    borderWidth: 1,
    borderColor: colors.brand.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 48,
    ...typography.body,
    color: colors.brand.textPrimary,
  },
  fieldMultiline: {
    height: 80,
    textAlignVertical: "top",
    paddingTop: spacing.sm,
  },
  toggleRow: {
    flexDirection: "row",
    marginTop: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.brand.border,
    borderRadius: borderRadius.md,
    alignItems: "center",
    marginRight: spacing.sm,
  },
  toggleBtnActive: {
    backgroundColor: colors.brand.surfaceAlt,
    borderColor: colors.brand.primary,
  },
  toggleBtnText: {
    ...typography.supporting,
    color: colors.brand.textSecondary,
  },
  toggleBtnTextActive: {
    fontWeight: "700",
    color: colors.brand.primary,
  },
  dangerZone: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.brand.border,
  },
  trashBtn: {
    backgroundColor: "#FEECE9",
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  trashBtnText: {
    ...typography.bodyBold,
    color: "#B42318",
  },
  deletePermanentBtn: {
    backgroundColor: "#B42318",
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    alignItems: "center",
  },
  deletePermanentText: {
    ...typography.bodyBold,
    color: "#FFFFFF",
  },
});
