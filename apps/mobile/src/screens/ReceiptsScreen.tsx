import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  Modal,
  Alert,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { useToast } from "../components/ToastContext";
import { useLocalVault } from "../vault-context";
import {
  formatMoney,
  parseMoneyToMinorUnits,
  ReceiptRecord,
  DocumentType,
  ReviewStatus,
} from "@katibay/shared";
import { haptics } from "../utils/haptics";

interface ReceiptsScreenProps {
  selectedReceipt?: ReceiptRecord | null;
  onClearSelectedReceipt?: () => void;
}

export const ReceiptsScreen: React.FC<ReceiptsScreenProps> = ({
  selectedReceipt,
  onClearSelectedReceipt,
}) => {
  const { colors, spacing, borderRadius, typography, isDark } = useTheme();
  const { vault, receipts, saveReceipt, moveToTrash, restoreFromTrash, permanentlyDelete } =
    useLocalVault();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<"all" | "review" | "trash">("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [editingReceipt, setEditingReceipt] = useState<ReceiptRecord | null>(
    selectedReceipt || null,
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
  const [amountError, setAmountError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const openEditor = (r: ReceiptRecord) => {
    haptics.tap();
    setEditingReceipt(r);
    setFormMerchant(r.merchant || "");
    setFormDate(r.transaction_date || "");
    setFormAmount(r.total_minor_units !== null ? (r.total_minor_units / 100).toFixed(2) : "");
    setFormCurrency(r.currency || "PHP");
    setFormDocType(r.document_type);
    setFormPurpose(r.purpose || "");
    setFormNotes(r.notes || "");
    setFormStatus(r.review_status);
    setAmountError(null);
  };

  useEffect(() => {
    if (selectedReceipt) {
      openEditor(selectedReceipt);
    }
  }, [selectedReceipt]);

  const closeEditor = () => {
    haptics.tap();
    setEditingReceipt(null);
    setAmountError(null);
    if (onClearSelectedReceipt) onClearSelectedReceipt();
  };

  const handleAmountChange = (text: string) => {
    setFormAmount(text);
    if (!text.trim()) {
      setAmountError(null);
      return;
    }
    // Check if numeric
    const clean = text.replace(/,/g, "").trim();
    if (isNaN(Number(clean)) || Number(clean) < 0) {
      setAmountError("Please enter a valid positive number (e.g. 250.00)");
    } else {
      setAmountError(null);
    }
  };

  const handleSaveEdits = () => {
    if (!editingReceipt || isSaving) return;

    if (amountError) {
      haptics.error();
      showToast({
        type: "error",
        title: "Validation Error",
        message: "Please correct the amount format before saving.",
      });
      return;
    }

    setIsSaving(true);
    const parsedMinorUnits = formAmount.trim()
      ? parseMoneyToMinorUnits(formAmount, formCurrency)
      : null;

    saveReceipt({
      ...editingReceipt,
      title: formMerchant.trim() || editingReceipt.title || "Receipt",
      merchant: formMerchant.trim() || null,
      transaction_date: formDate.trim() || null,
      currency: formCurrency,
      total_minor_units: parsedMinorUnits,
      document_type: formDocType,
      purpose: formPurpose.trim() || null,
      notes: formNotes.trim() || null,
      review_status: formStatus,
    });

    haptics.success();
    showToast({
      type: "success",
      title: "Receipt Updated",
      message: `Changes saved for ${formMerchant.trim() || "receipt"}.`,
    });

    setIsSaving(false);
    closeEditor();
  };

  const handleTrashToggle = (r: ReceiptRecord) => {
    if (r.is_trashed) {
      restoreFromTrash(r.id);
      haptics.success();
      showToast({
        type: "success",
        title: "Receipt Restored",
        message: "Receipt returned to active vault.",
      });
    } else {
      moveToTrash(r.id);
      haptics.warning();
      showToast({
        type: "warning",
        title: "Moved to Trash",
        message: "Receipt moved to Trash. You can restore it anytime.",
      });
    }
    closeEditor();
  };

  const handleDeletePermanent = (r: ReceiptRecord) => {
    Alert.alert(
      "Permanently Delete",
      "Are you sure you want to permanently delete this receipt and its attached files? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Forever",
          style: "destructive",
          onPress: () => {
            permanentlyDelete(r.id);
            haptics.error();
            showToast({
              type: "error",
              title: "Permanently Deleted",
              message: "Receipt removed from device storage.",
            });
            closeEditor();
          },
        },
      ],
    );
  };

  // Filter items based on active tab
  let displayedList: ReceiptRecord[] = [];
  if (activeTab === "trash") {
    displayedList = vault.listReceipts({ includeTrashed: true }).filter((r) => r.is_trashed);
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
        (r.notes || "").toLowerCase().includes(q) ||
        (r.purpose || "").toLowerCase().includes(q),
    );
  }

  const renderReceiptItem = ({ item: r }: { item: ReceiptRecord }) => (
    <TouchableOpacity
      style={[
        styles.receiptCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        r.is_trashed && styles.trashedCard,
      ]}
      onPress={() => openEditor(r)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Receipt from ${r.merchant || r.title}, amount ${formatMoney(
        r.total_minor_units,
        r.currency,
      )}`}
    >
      <View style={styles.cardHeaderRow}>
        <Text style={[styles.cardMerchant, { color: colors.textPrimary }]} numberOfLines={1}>
          {r.merchant || r.title}
        </Text>
        <Text style={[styles.cardAmount, { color: colors.primary }]}>
          {formatMoney(r.total_minor_units, r.currency)}
        </Text>
      </View>

      <View style={styles.cardMetaRow}>
        <Text style={[styles.cardDate, { color: colors.textSecondary }]}>
          {r.transaction_date || "No date"}
        </Text>

        <View style={styles.badgeRow}>
          <View
            style={[
              styles.docTypeBadge,
              {
                backgroundColor: colors.surfaceAlt,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.docTypeBadgeText, { color: colors.textSecondary }]}>
              {r.document_type}
            </Text>
          </View>

          <View
            style={[
              styles.reviewBadge,
              {
                backgroundColor:
                  r.review_status === "reviewed"
                    ? colors.status.success.bg
                    : colors.status.warning.bg,
                borderColor:
                  r.review_status === "reviewed"
                    ? colors.status.success.border
                    : colors.status.warning.border,
              },
            ]}
          >
            <Text
              style={[
                styles.reviewBadgeText,
                {
                  color:
                    r.review_status === "reviewed"
                      ? colors.status.success.text
                      : colors.status.warning.text,
                },
              ]}
            >
              {r.review_status === "reviewed" ? "Reviewed" : "Needs Review"}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => {
    let title = "No receipts in this view";
    let message = "Receipts you add will appear here.";
    let actionLabel = "";
    let actionFn: (() => void) | null = null;

    if (searchFilter.trim()) {
      title = "No results found";
      message = `No receipts matched "${searchFilter}".`;
      actionLabel = "Clear Search";
      actionFn = () => setSearchFilter("");
    } else if (activeTab === "review") {
      title = "All Caught Up!";
      message = "Every receipt has been confirmed and reviewed.";
      actionLabel = "View All Receipts";
      actionFn = () => setActiveTab("all");
    } else if (activeTab === "trash") {
      title = "Trash is Empty";
      message = "Deleted receipts will be temporarily held here before permanent removal.";
    } else {
      title = "Your Vault is Empty";
      message = "Use the capture button (+) below to save your first receipt.";
    }

    return (
      <View
        style={[
          styles.emptyBox,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <Text style={styles.emptyIcon}>
          {activeTab === "review" ? "🎉" : activeTab === "trash" ? "🗑️" : "📂"}
        </Text>
        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>{message}</Text>
        {actionLabel && actionFn && (
          <TouchableOpacity
            style={[
              styles.emptyActionBtn,
              {
                backgroundColor: colors.surfaceAlt,
                borderColor: colors.border,
              },
            ]}
            onPress={() => {
              haptics.tap();
              actionFn();
            }}
            accessibilityRole="button"
          >
            <Text style={[styles.emptyActionBtnText, { color: colors.primary }]}>
              {actionLabel}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.container}>
        {/* Header Title */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Receipts</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {receipts.length} total saved locally on phone
          </Text>
        </View>

        {/* Tab Filter Chips */}
        <View style={styles.tabRow} accessibilityRole="tablist">
          <TouchableOpacity
            style={[
              styles.tabChip,
              {
                backgroundColor: activeTab === "all" ? colors.primary : colors.surface,
                borderColor: activeTab === "all" ? colors.primary : colors.border,
              },
            ]}
            onPress={() => {
              haptics.tap();
              setActiveTab("all");
            }}
            accessibilityRole="tab"
            accessibilityLabel="All receipts tab"
            accessibilityState={{ selected: activeTab === "all" }}
          >
            <Text
              style={[
                styles.tabChipText,
                { color: activeTab === "all" ? colors.primaryFg : colors.textSecondary },
                activeTab === "all" && styles.tabChipTextActive,
              ]}
            >
              All ({receipts.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabChip,
              {
                backgroundColor: activeTab === "review" ? colors.primary : colors.surface,
                borderColor: activeTab === "review" ? colors.primary : colors.border,
              },
            ]}
            onPress={() => {
              haptics.tap();
              setActiveTab("review");
            }}
            accessibilityRole="tab"
            accessibilityLabel="Needs review tab"
            accessibilityState={{ selected: activeTab === "review" }}
          >
            <Text
              style={[
                styles.tabChipText,
                { color: activeTab === "review" ? colors.primaryFg : colors.textSecondary },
                activeTab === "review" && styles.tabChipTextActive,
              ]}
            >
              Needs Review ({receipts.filter((r) => r.review_status !== "reviewed").length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabChip,
              {
                backgroundColor: activeTab === "trash" ? colors.primary : colors.surface,
                borderColor: activeTab === "trash" ? colors.primary : colors.border,
              },
            ]}
            onPress={() => {
              haptics.tap();
              setActiveTab("trash");
            }}
            accessibilityRole="tab"
            accessibilityLabel="Trash tab"
            accessibilityState={{ selected: activeTab === "trash" }}
          >
            <Text
              style={[
                styles.tabChipText,
                { color: activeTab === "trash" ? colors.primaryFg : colors.textSecondary },
                activeTab === "trash" && styles.tabChipTextActive,
              ]}
            >
              Trash (
              {vault.listReceipts({ includeTrashed: true }).filter((r) => r.is_trashed).length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Filter by merchant, notes, or purpose..."
            placeholderTextColor={colors.textMuted}
            value={searchFilter}
            onChangeText={setSearchFilter}
            accessibilityRole="search"
            accessibilityLabel="Filter receipts"
          />
          {searchFilter.trim().length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchFilter("")}
              style={styles.clearSearchBtn}
              accessibilityLabel="Clear filter"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.clearSearchText, { color: colors.textMuted }]}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Virtualized List Content */}
        <FlatList
          data={displayedList}
          keyExtractor={(item) => item.id}
          renderItem={renderReceiptItem}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={styles.listContainer}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={Platform.OS === "android"}
        />

        {/* Receipt Detail / Review Editor Modal */}
        <Modal
          visible={!!editingReceipt}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={closeEditor}
        >
          {editingReceipt && (
            <SafeAreaView style={[styles.modalSafeArea, { backgroundColor: colors.background }]}>
              <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
              >
                <View
                  style={[
                    styles.modalHeader,
                    {
                      backgroundColor: colors.surface,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <TouchableOpacity
                    onPress={closeEditor}
                    style={styles.modalHeaderBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel editing"
                  >
                    <Text style={[styles.modalCloseText, { color: colors.textSecondary }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                    Receipt Details
                  </Text>
                  <TouchableOpacity
                    onPress={handleSaveEdits}
                    style={[
                      styles.modalSaveBtn,
                      {
                        backgroundColor: colors.primary,
                        opacity: isSaving ? 0.6 : 1,
                      },
                    ]}
                    disabled={isSaving}
                    accessibilityRole="button"
                    accessibilityLabel="Save receipt changes"
                  >
                    <Text style={[styles.modalSaveText, { color: colors.primaryFg }]}>
                      {isSaving ? "Saving..." : "Save"}
                    </Text>
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={styles.modalBody}
                  contentContainerStyle={styles.modalBodyContent}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Source Evidence Preview */}
                  <View
                    style={[
                      styles.sourceBox,
                      {
                        backgroundColor: colors.surfaceAlt,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.sourceBoxLabel, { color: colors.textSecondary }]}>
                      DOCUMENT SOURCE EVIDENCE
                    </Text>
                    <View style={styles.sourcePreviewCard}>
                      <Text style={[styles.sourceFileText, { color: colors.textPrimary }]}>
                        📄 Attached Original:{" "}
                        {vault.getAttachmentsForReceipt(editingReceipt.id)[0]?.file_name ||
                          "Manual Entry (No image)"}
                      </Text>
                      {vault.getAttachmentsForReceipt(editingReceipt.id)[0]?.ocr_text ? (
                        <Text
                          style={[styles.ocrSnippet, { color: colors.textSecondary }]}
                          numberOfLines={3}
                        >
                          OCR: {vault.getAttachmentsForReceipt(editingReceipt.id)[0]?.ocr_text}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {/* Editable Fields */}
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      Merchant / Payee
                    </Text>
                    <TextInput
                      style={[
                        styles.fieldInput,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.controlBorder,
                          color: colors.textPrimary,
                        },
                      ]}
                      value={formMerchant}
                      onChangeText={setFormMerchant}
                      placeholder="e.g. Jollibee, National Book Store"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>

                  <View style={styles.fieldRow}>
                    <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
                      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                        Date (YYYY-MM-DD)
                      </Text>
                      <TextInput
                        style={[
                          styles.fieldInput,
                          {
                            backgroundColor: colors.surface,
                            borderColor: colors.controlBorder,
                            color: colors.textPrimary,
                          },
                        ]}
                        value={formDate}
                        onChangeText={setFormDate}
                        placeholder="2026-09-06"
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>

                    <View style={[styles.fieldGroup, { width: 96 }]}>
                      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                        Currency
                      </Text>
                      <TextInput
                        style={[
                          styles.fieldInput,
                          {
                            backgroundColor: colors.surface,
                            borderColor: colors.controlBorder,
                            color: colors.textPrimary,
                          },
                        ]}
                        value={formCurrency}
                        onChangeText={setFormCurrency}
                        autoCapitalize="characters"
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      Total Amount
                    </Text>
                    <TextInput
                      style={[
                        styles.fieldInput,
                        {
                          backgroundColor: colors.surface,
                          borderColor: amountError
                            ? colors.status.danger.border
                            : colors.controlBorder,
                          color: colors.textPrimary,
                        },
                      ]}
                      value={formAmount}
                      onChangeText={handleAmountChange}
                      placeholder="0.00 (leave blank if unknown)"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="decimal-pad"
                    />
                    {amountError && (
                      <Text style={[styles.inlineError, { color: colors.status.danger.text }]}>
                        {amountError}
                      </Text>
                    )}
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      Purpose / Category
                    </Text>
                    <TextInput
                      style={[
                        styles.fieldInput,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.controlBorder,
                          color: colors.textPrimary,
                        },
                      ]}
                      value={formPurpose}
                      onChangeText={setFormPurpose}
                      placeholder="e.g. Office supplies, Groceries"
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Notes</Text>
                    <TextInput
                      style={[
                        styles.fieldInput,
                        styles.fieldMultiline,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.controlBorder,
                          color: colors.textPrimary,
                        },
                      ]}
                      value={formNotes}
                      onChangeText={setFormNotes}
                      placeholder="Additional details, claim reference, etc."
                      placeholderTextColor={colors.textMuted}
                      multiline
                    />
                  </View>

                  {/* Review Status Toggle */}
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                      Review Status
                    </Text>
                    <View style={styles.toggleRow}>
                      <TouchableOpacity
                        style={[
                          styles.toggleBtn,
                          {
                            backgroundColor:
                              formStatus === "reviewed" ? colors.primary : colors.surface,
                            borderColor: formStatus === "reviewed" ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => {
                          haptics.tap();
                          setFormStatus("reviewed");
                        }}
                        accessibilityRole="button"
                      >
                        <Text
                          style={[
                            styles.toggleBtnText,
                            {
                              color:
                                formStatus === "reviewed" ? colors.primaryFg : colors.textSecondary,
                            },
                          ]}
                        >
                          ✓ Reviewed
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.toggleBtn,
                          {
                            backgroundColor:
                              formStatus === "unreviewed" ? colors.primary : colors.surface,
                            borderColor:
                              formStatus === "unreviewed" ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => {
                          haptics.tap();
                          setFormStatus("unreviewed");
                        }}
                        accessibilityRole="button"
                      >
                        <Text
                          style={[
                            styles.toggleBtnText,
                            {
                              color:
                                formStatus === "unreviewed"
                                  ? colors.primaryFg
                                  : colors.textSecondary,
                            },
                          ]}
                        >
                          ⚠️ Needs Review
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Danger Zone: Trash / Permanent Delete */}
                  <View style={styles.dangerZone}>
                    <TouchableOpacity
                      style={[
                        styles.trashBtn,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                        },
                      ]}
                      onPress={() => handleTrashToggle(editingReceipt)}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.trashBtnText, { color: colors.textPrimary }]}>
                        {editingReceipt.is_trashed ? "Restore from Trash" : "Move to Trash"}
                      </Text>
                    </TouchableOpacity>

                    {editingReceipt.is_trashed && (
                      <TouchableOpacity
                        style={[
                          styles.deletePermanentBtn,
                          {
                            backgroundColor: colors.status.danger.bg,
                            borderColor: colors.status.danger.border,
                          },
                        ]}
                        onPress={() => handleDeletePermanent(editingReceipt)}
                        accessibilityRole="button"
                      >
                        <Text
                          style={[styles.deletePermanentText, { color: colors.status.danger.text }]}
                        >
                          Permanently Delete
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </ScrollView>
              </KeyboardAvoidingView>
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
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  tabChip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    minHeight: 36,
    justifyContent: "center",
  },
  tabChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  tabChipTextActive: {
    fontWeight: "700",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: "100%",
  },
  clearSearchBtn: {
    padding: 6,
  },
  clearSearchText: {
    fontSize: 14,
    fontWeight: "700",
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 110,
  },
  receiptCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  trashedCard: {
    opacity: 0.65,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  cardMerchant: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
    marginRight: 10,
  },
  cardAmount: {
    fontSize: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  cardMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardDate: {
    fontSize: 13,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 6,
  },
  docTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  docTypeBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  reviewBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  reviewBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  emptyBox: {
    alignItems: "center",
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 16,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },
  emptyActionBtn: {
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  emptyActionBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  modalSafeArea: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight || 24 : 0,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
  },
  modalHeaderBtn: {
    minWidth: 54,
    minHeight: 44,
    justifyContent: "center",
  },
  modalCloseText: {
    fontSize: 15,
    fontWeight: "600",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  modalSaveBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    minHeight: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  modalSaveText: {
    fontSize: 14,
    fontWeight: "700",
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sourceBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  sourceBoxLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  sourcePreviewCard: {
    gap: 4,
  },
  sourceFileText: {
    fontSize: 13,
    fontWeight: "600",
  },
  ocrSnippet: {
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
  fieldInput: {
    height: 48,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  fieldMultiline: {
    height: 80,
    paddingTop: 10,
    textAlignVertical: "top",
  },
  inlineError: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 10,
  },
  toggleBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  toggleBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  dangerZone: {
    marginTop: 20,
    gap: 12,
  },
  trashBtn: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  trashBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  deletePermanentBtn: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  deletePermanentText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
