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
import { formatMoney, ActionRecord, ActionType } from "@katibay/shared";

export const RemindersScreen: React.FC = () => {
  const { actions, toggleActionStatus, saveAction, receipts } = useLocalVault();
  const [filter, setFilter] = useState<"pending" | "completed">("pending");
  const [isAdding, setIsAdding] = useState(false);

  // New action form state
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [actionType, setActionType] = useState<ActionType>("return_deadline");
  const [notes, setNotes] = useState("");

  const filteredActions = actions.filter((a) => a.status === filter);

  const handleAddAction = () => {
    if (!title.trim() || !dueDate.trim()) return;

    saveAction({
      id: `act_${Date.now()}`,
      receipt_id: receipts[0]?.id || "",
      action_type: actionType,
      title: title.trim(),
      due_date: dueDate.trim(),
      status: "pending",
      amount_minor_units: null,
      currency: null,
      notes: notes.trim() || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    setTitle("");
    setDueDate("");
    setNotes("");
    setIsAdding(false);
  };

  const ACTION_TYPES: { type: ActionType; label: string }[] = [
    { type: "return_deadline", label: "Return Deadline" },
    { type: "reimbursement", label: "HMO / Work Reimbursement" },
    { type: "refund_followup", label: "Refund Follow-up" },
    { type: "custom_reminder", label: "Custom Reminder" },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Reminders & Actions</Text>
            <Text style={styles.headerSubtitle}>
              Never miss a return window or reimbursement deadline
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setIsAdding(true)}
          >
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Tabs */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabChip, filter === "pending" && styles.tabChipActive]}
            onPress={() => setFilter("pending")}
          >
            <Text
              style={[
                styles.tabChipText,
                filter === "pending" && styles.tabChipTextActive,
              ]}
            >
              Pending ({actions.filter((a) => a.status === "pending").length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabChip,
              filter === "completed" && styles.tabChipActive,
            ]}
            onPress={() => setFilter("completed")}
          >
            <Text
              style={[
                styles.tabChipText,
                filter === "completed" && styles.tabChipTextActive,
              ]}
            >
              Completed ({actions.filter((a) => a.status === "completed").length})
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {filteredActions.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>⏰</Text>
              <Text style={styles.emptyTitle}>
                No {filter} reminders or deadlines
              </Text>
              <Text style={styles.emptySubtitle}>
                Add a return reminder or reimbursement deadline to stay on track.
              </Text>
            </View>
          ) : (
            filteredActions.map((act) => {
              const linkedReceipt = receipts.find((r) => r.id === act.receipt_id);

              return (
                <View key={act.id} style={styles.actionCard}>
                  <TouchableOpacity
                    style={styles.checkCircle}
                    onPress={() => toggleActionStatus(act.id)}
                  >
                    <Text style={styles.checkCircleText}>
                      {act.status === "completed" ? "✓" : "○"}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.actionContent}>
                    <Text
                      style={[
                        styles.actionTitle,
                        act.status === "completed" && styles.actionTitleCompleted,
                      ]}
                    >
                      {act.title}
                    </Text>

                    <View style={styles.metaRow}>
                      <Text style={styles.dueDate}>Due: {act.due_date}</Text>
                      {linkedReceipt && (
                        <Text style={styles.linkedReceipt} numberOfLines={1}>
                          • {linkedReceipt.merchant || linkedReceipt.title}
                        </Text>
                      )}
                    </View>

                    {act.notes && (
                      <Text style={styles.notesText}>{act.notes}</Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Add Action Modal */}
        <Modal
          visible={isAdding}
          animationType="slide"
          presentationStyle="formSheet"
          onRequestClose={() => setIsAdding(false)}
        >
          <SafeAreaView style={styles.modalSafe}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setIsAdding(false)}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>New Reminder</Text>
              <TouchableOpacity onPress={handleAddAction}>
                <Text style={styles.modalDone}>Save</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              <Text style={styles.inputLabel}>Title</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Return defective mouse to store"
                value={title}
                onChangeText={setTitle}
              />

              <Text style={styles.inputLabel}>Due Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="2026-09-15"
                value={dueDate}
                onChangeText={setDueDate}
              />

              <Text style={styles.inputLabel}>Reminder Type</Text>
              <View style={styles.typeCol}>
                {ACTION_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.type}
                    style={[
                      styles.typeOption,
                      actionType === t.type && styles.typeOptionSelected,
                    ]}
                    onPress={() => setActionType(t.type)}
                  >
                    <Text
                      style={[
                        styles.typeText,
                        actionType === t.type && styles.typeTextSelected,
                      ]}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Notes (Optional)</Text>
              <TextInput
                style={[styles.textInput, styles.notesInput]}
                placeholder="Details, requirements, or return policy terms..."
                value={notes}
                onChangeText={setNotes}
                multiline
              />
            </ScrollView>
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
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl * 2,
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    ...typography.bodyBold,
    color: colors.brand.textPrimary,
  },
  emptySubtitle: {
    ...typography.supporting,
    color: colors.brand.textSecondary,
    textAlign: "center",
    marginTop: 4,
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.brand.surface,
    borderRadius: borderRadius.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.brand.border,
    marginBottom: spacing.sm,
  },
  checkCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.brand.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
    marginTop: 2,
  },
  checkCircleText: {
    fontSize: 16,
    color: colors.brand.primary,
    fontWeight: "700",
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    ...typography.bodyBold,
    color: colors.brand.textPrimary,
  },
  actionTitleCompleted: {
    textDecorationLine: "line-through",
    color: colors.brand.textMuted,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  dueDate: {
    ...typography.caption,
    fontWeight: "600",
    color: colors.brand.primary,
  },
  linkedReceipt: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginLeft: 6,
    flex: 1,
  },
  notesText: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginTop: 4,
    fontStyle: "italic",
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
  typeCol: {
    marginTop: 4,
  },
  typeOption: {
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.brand.border,
    marginBottom: 6,
    backgroundColor: colors.brand.background,
  },
  typeOptionSelected: {
    backgroundColor: colors.brand.surfaceAlt,
    borderColor: colors.brand.primary,
  },
  typeText: {
    ...typography.supporting,
    color: colors.brand.textPrimary,
  },
  typeTextSelected: {
    fontWeight: "700",
    color: colors.brand.primary,
  },
  notesInput: {
    height: 80,
    textAlignVertical: "top",
    paddingTop: spacing.sm,
  },
});
