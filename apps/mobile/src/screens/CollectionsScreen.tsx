import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Modal,
  TextInput,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
} from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { useToast } from "../components/ToastContext";
import { useLocalVault } from "../vault-context";
import {
  formatMoney,
  calculateReceiptTotals,
  CollectionRecord,
  ReceiptRecord,
} from "@katibay/shared";
import { haptics } from "../utils/haptics";

interface CollectionsScreenProps {
  onOpenReceipt: (receipt: ReceiptRecord) => void;
}

export const CollectionsScreen: React.FC<CollectionsScreenProps> = ({ onOpenReceipt }) => {
  const { colors, spacing, borderRadius, typography, isDark } = useTheme();
  const { collections, receipts, saveCollection } = useLocalVault();
  const { showToast } = useToast();
  const [selectedCollection, setSelectedCollection] = useState<CollectionRecord | null>(null);

  // New collection modal state
  const [isCreating, setIsCreating] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColDesc, setNewColDesc] = useState("");
  const [newColColor, setNewColColor] = useState("#146B55");
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const COLOR_OPTIONS = ["#146B55", "#245BB2", "#865500", "#B42318", "#5C6C65"];

  const handleNameChange = (text: string) => {
    setNewColName(text);
    if (text.trim().length > 0) {
      setNameError(null);
    }
  };

  const handleCreateCollection = () => {
    if (isSubmitting) return;

    if (!newColName.trim()) {
      haptics.error();
      setNameError("Collection name is required");
      return;
    }

    setIsSubmitting(true);
    const created = {
      id: `col_${Date.now()}`,
      name: newColName.trim(),
      color: newColColor,
      icon: "folder",
      description: newColDesc.trim() || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    saveCollection(created);
    haptics.success();
    showToast({
      type: "success",
      title: "Collection Created",
      message: `"${created.name}" is ready for receipts.`,
    });

    setNewColName("");
    setNewColDesc("");
    setNameError(null);
    setIsSubmitting(false);
    setIsCreating(false);
  };

  const getCollectionReceipts = (colId: string) => {
    return receipts.filter((r) => r.collection_ids.includes(colId));
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Collections</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              Organize receipts for projects, trips, or taxes
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.addBtn,
              {
                backgroundColor: colors.primary,
              },
            ]}
            onPress={() => {
              haptics.tap();
              setIsCreating(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Create new collection"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.addBtnText, { color: colors.primaryFg }]}>+ New</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {collections.length === 0 ? (
            <View
              style={[
                styles.emptyBox,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={styles.emptyIcon}>📁</Text>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                No Collections Yet
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Create collections like "Taxes 2026", "Medical Claims", or "Trip to Cebu" to group
                your receipts.
              </Text>
            </View>
          ) : (
            collections.map((col) => {
              const colReceipts = getCollectionReceipts(col.id);
              const totals = calculateReceiptTotals(colReceipts);
              const currKey = Object.keys(totals.currencies)[0];
              const formattedTotal = currKey ? totals.currencies[currKey].formatted : "₱0.00";

              const isExpanded = selectedCollection?.id === col.id;

              return (
                <View
                  key={col.id}
                  style={[
                    styles.collectionCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.collectionHeader}
                    onPress={() => {
                      haptics.tap();
                      setSelectedCollection(isExpanded ? null : col);
                    }}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isExpanded }}
                    accessibilityLabel={`${col.name}, ${colReceipts.length} receipts, total ${formattedTotal}`}
                  >
                    <View style={[styles.colorIndicator, { backgroundColor: col.color }]} />
                    <View style={styles.colInfo}>
                      <Text style={[styles.colName, { color: colors.textPrimary }]}>
                        {col.name}
                      </Text>
                      {col.description && (
                        <Text style={[styles.colDesc, { color: colors.textSecondary }]}>
                          {col.description}
                        </Text>
                      )}
                    </View>
                    <View style={styles.colTotals}>
                      <Text style={[styles.colAmount, { color: colors.primary }]}>
                        {formattedTotal}
                      </Text>
                      <Text style={[styles.colCount, { color: colors.textSecondary }]}>
                        {colReceipts.length} item(s) {isExpanded ? "▲" : "▼"}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Expanded Receipts in this collection */}
                  {isExpanded && (
                    <View
                      style={[
                        styles.expandedItems,
                        {
                          borderTopColor: colors.border,
                          backgroundColor: colors.surfaceAlt,
                        },
                      ]}
                    >
                      {colReceipts.length === 0 ? (
                        <View style={styles.emptyColBox}>
                          <Text style={[styles.emptyColText, { color: colors.textSecondary }]}>
                            No receipts filed in this collection yet.
                          </Text>
                          <Text style={[styles.emptyColSubtext, { color: colors.textMuted }]}>
                            Edit any receipt and assign it to this collection.
                          </Text>
                        </View>
                      ) : (
                        colReceipts.map((r) => (
                          <TouchableOpacity
                            key={r.id}
                            style={[
                              styles.colReceiptRow,
                              {
                                borderBottomColor: colors.border,
                              },
                            ]}
                            onPress={() => onOpenReceipt(r)}
                            accessibilityRole="button"
                            accessibilityLabel={`Receipt ${r.merchant || r.title}`}
                          >
                            <Text
                              style={[styles.colReceiptTitle, { color: colors.textPrimary }]}
                              numberOfLines={1}
                            >
                              {r.merchant || r.title}
                            </Text>
                            <Text style={[styles.colReceiptAmount, { color: colors.primary }]}>
                              {formatMoney(r.total_minor_units, r.currency)}
                            </Text>
                          </TouchableOpacity>
                        ))
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Create Collection Modal */}
        <Modal
          visible={isCreating}
          animationType="slide"
          presentationStyle="formSheet"
          onRequestClose={() => setIsCreating(false)}
        >
          <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.background }]}>
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
                  onPress={() => {
                    haptics.tap();
                    setIsCreating(false);
                    setNameError(null);
                  }}
                  style={styles.modalHeaderBtn}
                  accessibilityRole="button"
                >
                  <Text style={[styles.modalCancel, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  New Collection
                </Text>
                <TouchableOpacity
                  onPress={handleCreateCollection}
                  style={[
                    styles.modalDoneBtn,
                    {
                      backgroundColor: colors.primary,
                      opacity: isSubmitting ? 0.6 : 1,
                    },
                  ]}
                  disabled={isSubmitting}
                  accessibilityRole="button"
                >
                  <Text style={[styles.modalDone, { color: colors.primaryFg }]}>
                    {isSubmitting ? "Creating..." : "Create"}
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalForm}
                contentContainerStyle={{ padding: 16 }}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  Collection Name *
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colors.surface,
                      borderColor: nameError ? colors.status.danger.border : colors.controlBorder,
                      color: colors.textPrimary,
                    },
                  ]}
                  placeholder="e.g. Home Renovation, Tax Year 2026"
                  placeholderTextColor={colors.textMuted}
                  value={newColName}
                  onChangeText={handleNameChange}
                />
                {nameError && (
                  <Text style={[styles.inlineError, { color: colors.status.danger.text }]}>
                    {nameError}
                  </Text>
                )}

                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  Description (Optional)
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
                  placeholder="What receipts belong here?"
                  placeholderTextColor={colors.textMuted}
                  value={newColDesc}
                  onChangeText={setNewColDesc}
                />

                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Color Tag</Text>
                <View style={styles.colorsRow}>
                  {COLOR_OPTIONS.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: c },
                        newColColor === c && [
                          styles.colorCircleSelected,
                          { borderColor: colors.primary },
                        ],
                      ]}
                      onPress={() => {
                        haptics.tap();
                        setNewColColor(c);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Select color ${c}`}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    />
                  ))}
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  addBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    minHeight: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 110,
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
  collectionCard: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
  },
  collectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    minHeight: 64,
  },
  colorIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 12,
  },
  colInfo: {
    flex: 1,
  },
  colName: {
    fontSize: 16,
    fontWeight: "700",
  },
  colDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  colTotals: {
    alignItems: "flex-end",
  },
  colAmount: {
    fontSize: 15,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  colCount: {
    fontSize: 11,
    marginTop: 2,
  },
  expandedItems: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  emptyColBox: {
    paddingVertical: 14,
    alignItems: "center",
  },
  emptyColText: {
    fontSize: 13,
    fontStyle: "italic",
  },
  emptyColSubtext: {
    fontSize: 11,
    marginTop: 2,
  },
  colReceiptRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    minHeight: 44,
  },
  colReceiptTitle: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
    marginRight: 10,
  },
  colReceiptAmount: {
    fontSize: 14,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  modalSafe: {
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
  modalCancel: {
    fontSize: 15,
    fontWeight: "600",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  modalDoneBtn: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 8,
    minHeight: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  modalDone: {
    fontSize: 14,
    fontWeight: "700",
  },
  modalForm: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 14,
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
  colorsRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 6,
  },
  colorCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  colorCircleSelected: {
    borderWidth: 3,
    transform: [{ scale: 1.15 }],
  },
});
