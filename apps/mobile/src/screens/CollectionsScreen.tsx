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
} from "react-native";
import { colors, spacing, borderRadius, typography } from "../theme/tokens";
import { useLocalVault } from "../vault-context";
import {
  formatMoney,
  calculateReceiptTotals,
  CollectionRecord,
  ReceiptRecord,
} from "@katibay/shared";

interface CollectionsScreenProps {
  onOpenReceipt: (receipt: ReceiptRecord) => void;
}

export const CollectionsScreen: React.FC<CollectionsScreenProps> = ({
  onOpenReceipt,
}) => {
  const { collections, receipts, saveCollection } = useLocalVault();
  const [selectedCollection, setSelectedCollection] =
    useState<CollectionRecord | null>(null);

  // New collection modal state
  const [isCreating, setIsCreating] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColDesc, setNewColDesc] = useState("");
  const [newColColor, setNewColColor] = useState("#146B55");

  const COLOR_OPTIONS = ["#146B55", "#245BB2", "#865500", "#B42318", "#5C6C65"];

  const handleCreateCollection = () => {
    if (!newColName.trim()) return;

    saveCollection({
      id: `col_${Date.now()}`,
      name: newColName.trim(),
      color: newColColor,
      icon: "folder",
      description: newColDesc.trim() || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    setNewColName("");
    setNewColDesc("");
    setIsCreating(false);
  };

  const getCollectionReceipts = (colId: string) => {
    return receipts.filter((r) => r.collection_ids.includes(colId));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Collections</Text>
            <Text style={styles.headerSubtitle}>
              Organize receipts for projects, trips, or taxes
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setIsCreating(true)}
          >
            <Text style={styles.addBtnText}>+ New</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {collections.map((col) => {
            const colReceipts = getCollectionReceipts(col.id);
            const totals = calculateReceiptTotals(colReceipts);
            const currKey = Object.keys(totals.currencies)[0];
            const formattedTotal = currKey
              ? totals.currencies[currKey].formatted
              : "₱0.00";

            const isExpanded = selectedCollection?.id === col.id;

            return (
              <View key={col.id} style={styles.collectionCard}>
                <TouchableOpacity
                  style={styles.collectionHeader}
                  onPress={() =>
                    setSelectedCollection(isExpanded ? null : col)
                  }
                  activeOpacity={0.7}
                >
                  <View
                    style={[styles.colorIndicator, { backgroundColor: col.color }]}
                  />
                  <View style={styles.colInfo}>
                    <Text style={styles.colName}>{col.name}</Text>
                    {col.description && (
                      <Text style={styles.colDesc}>{col.description}</Text>
                    )}
                  </View>
                  <View style={styles.colTotals}>
                    <Text style={styles.colAmount}>{formattedTotal}</Text>
                    <Text style={styles.colCount}>
                      {colReceipts.length} item(s) {isExpanded ? "▲" : "▼"}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Expanded Receipts in this collection */}
                {isExpanded && (
                  <View style={styles.expandedItems}>
                    {colReceipts.length === 0 ? (
                      <Text style={styles.emptyColText}>
                        No receipts filed in this collection yet.
                      </Text>
                    ) : (
                      colReceipts.map((r) => (
                        <TouchableOpacity
                          key={r.id}
                          style={styles.colReceiptRow}
                          onPress={() => onOpenReceipt(r)}
                        >
                          <Text style={styles.colReceiptTitle} numberOfLines={1}>
                            {r.merchant || r.title}
                          </Text>
                          <Text style={styles.colReceiptAmount}>
                            {formatMoney(r.total_minor_units, r.currency)}
                          </Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>

        {/* Create Collection Modal */}
        <Modal
          visible={isCreating}
          animationType="slide"
          presentationStyle="formSheet"
          onRequestClose={() => setIsCreating(false)}
        >
          <SafeAreaView style={styles.modalSafe}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setIsCreating(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>New Collection</Text>
              <TouchableOpacity onPress={handleCreateCollection}>
                <Text style={styles.modalDone}>Create</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalForm}>
              <Text style={styles.inputLabel}>Collection Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Home Renovation, Tax Year 2026"
                value={newColName}
                onChangeText={setNewColName}
              />

              <Text style={styles.inputLabel}>Description (Optional)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="What receipts belong here?"
                value={newColDesc}
                onChangeText={setNewColDesc}
              />

              <Text style={styles.inputLabel}>Color Tag</Text>
              <View style={styles.colorsRow}>
                {COLOR_OPTIONS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.colorCircle,
                      { backgroundColor: c },
                      newColColor === c && styles.colorCircleSelected,
                    ]}
                    onPress={() => setNewColColor(c)}
                  />
                ))}
              </View>
            </View>
          </SafeAreaView>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
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
  addBtn: {
    backgroundColor: colors.brand.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: borderRadius.md,
  },
  addBtnText: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.brand.primaryFg,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl * 2,
  },
  collectionCard: {
    backgroundColor: colors.brand.surface,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    borderColor: colors.brand.border,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  collectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
  },
  colorIndicator: {
    width: 12,
    height: 40,
    borderRadius: borderRadius.sm,
    marginRight: spacing.md,
  },
  colInfo: {
    flex: 1,
  },
  colName: {
    ...typography.bodyBold,
    color: colors.brand.textPrimary,
  },
  colDesc: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginTop: 2,
  },
  colTotals: {
    alignItems: "flex-end",
    marginLeft: spacing.sm,
  },
  colAmount: {
    ...typography.bodyBold,
    color: colors.brand.primary,
  },
  colCount: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginTop: 2,
  },
  expandedItems: {
    borderTopWidth: 1,
    borderTopColor: colors.brand.border,
    padding: spacing.md,
    backgroundColor: colors.brand.background,
  },
  emptyColText: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontStyle: "italic",
  },
  colReceiptRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.brand.border,
  },
  colReceiptTitle: {
    ...typography.supporting,
    color: colors.brand.textPrimary,
    flex: 1,
    marginRight: spacing.md,
  },
  colReceiptAmount: {
    ...typography.supporting,
    fontWeight: "600",
    color: colors.brand.primary,
  },
  modalSafe: {
    flex: 1,
    backgroundColor: colors.brand.surface,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.brand.border,
  },
  modalCancel: {
    ...typography.body,
    color: colors.brand.textSecondary,
  },
  modalTitle: {
    ...typography.sectionTitle,
    color: colors.brand.textPrimary,
  },
  modalDone: {
    ...typography.bodyBold,
    color: colors.brand.primary,
  },
  modalForm: {
    padding: spacing.lg,
  },
  inputLabel: {
    ...typography.caption,
    fontWeight: "600",
    color: colors.brand.textSecondary,
    marginBottom: 6,
    marginTop: spacing.md,
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
  colorsRow: {
    flexDirection: "row",
    marginTop: spacing.sm,
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: spacing.md,
  },
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: colors.brand.textPrimary,
  },
});
