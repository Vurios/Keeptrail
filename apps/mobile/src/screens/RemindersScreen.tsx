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
import { ActionRecord, ActionType } from "@katibay/shared";
import { haptics } from "../utils/haptics";

export const RemindersScreen: React.FC = () => {
  const { colors, spacing, borderRadius, typography, isDark } = useTheme();
  const { actions, toggleActionStatus, saveAction, receipts } = useLocalVault();
  const { showToast } = useToast();
  const [filter, setFilter] = useState<"pending" | "completed">("pending");
  const [isAdding, setIsAdding] = useState(false);

  // New action form state
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [actionType, setActionType] = useState<ActionType>("return_deadline");
  const [notes, setNotes] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredActions = actions.filter((a) => a.status === filter);

  const handleTitleChange = (text: string) => {
    setTitle(text);
    if (text.trim()) setTitleError(null);
  };

  const handleDateChange = (text: string) => {
    setDueDate(text);
    if (text.trim()) setDateError(null);
  };

  const handleAddAction = () => {
    if (isSubmitting) return;

    let hasErr = false;
    if (!title.trim()) {
      setTitleError("Reminder title is required");
      hasErr = true;
    }
    if (!dueDate.trim()) {
      setDateError("Due date is required (YYYY-MM-DD)");
      hasErr = true;
    }

    if (hasErr) {
      haptics.error();
      return;
    }

    setIsSubmitting(true);
    const newAction: ActionRecord = {
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
    };

    saveAction(newAction);
    haptics.success();
    showToast({
      type: "success",
      title: "Reminder Created",
      message: `Due ${newAction.due_date}: ${newAction.title}`,
    });

    setTitle("");
    setDueDate("");
    setNotes("");
    setTitleError(null);
    setDateError(null);
    setIsSubmitting(false);
    setIsAdding(false);
  };

  const handleToggle = (act: ActionRecord) => {
    toggleActionStatus(act.id);
    const willBeCompleted = act.status === "pending";
    if (willBeCompleted) {
      haptics.success();
      showToast({
        type: "success",
        title: "Action Completed",
        message: `Marked "${act.title}" as completed.`,
      });
    } else {
      haptics.tap();
      showToast({
        type: "info",
        title: "Action Reopened",
        message: `Moved "${act.title}" back to pending.`,
      });
    }
  };

  const ACTION_TYPES: { type: ActionType; label: string }[] = [
    { type: "return_deadline", label: "Return Deadline" },
    { type: "reimbursement", label: "HMO / Work Reimbursement" },
    { type: "refund_followup", label: "Refund Follow-up" },
    { type: "custom_reminder", label: "Custom Reminder" },
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              Reminders & Deadlines
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              Never miss a return window or reimbursement deadline
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
              setDueDate(new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]);
              setIsAdding(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Add new reminder"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.addBtnText, { color: colors.primaryFg }]}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Tabs */}
        <View style={styles.tabRow} accessibilityRole="tablist">
          <TouchableOpacity
            style={[
              styles.tabChip,
              {
                backgroundColor: filter === "pending" ? colors.primary : colors.surface,
                borderColor: filter === "pending" ? colors.primary : colors.border,
              },
            ]}
            onPress={() => {
              haptics.tap();
              setFilter("pending");
            }}
            accessibilityRole="tab"
            accessibilityLabel="Pending reminders tab"
            accessibilityState={{ selected: filter === "pending" }}
          >
            <Text
              style={[
                styles.tabChipText,
                { color: filter === "pending" ? colors.primaryFg : colors.textSecondary },
                filter === "pending" && styles.tabChipTextActive,
              ]}
            >
              Pending ({actions.filter((a) => a.status === "pending").length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabChip,
              {
                backgroundColor: filter === "completed" ? colors.primary : colors.surface,
                borderColor: filter === "completed" ? colors.primary : colors.border,
              },
            ]}
            onPress={() => {
              haptics.tap();
              setFilter("completed");
            }}
            accessibilityRole="tab"
            accessibilityLabel="Completed reminders tab"
            accessibilityState={{ selected: filter === "completed" }}
          >
            <Text
              style={[
                styles.tabChipText,
                { color: filter === "completed" ? colors.primaryFg : colors.textSecondary },
                filter === "completed" && styles.tabChipTextActive,
              ]}
            >
              Completed ({actions.filter((a) => a.status === "completed").length})
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {filteredActions.length === 0 ? (
            <View
              style={[
                styles.emptyBox,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={styles.emptyIcon}>{filter === "pending" ? "⏰" : "✓"}</Text>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                No {filter} reminders or deadlines
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                {filter === "pending"
                  ? "Add a return window, warranty expiry, or reimbursement deadline."
                  : "Completed actions and reminders will show up here."}
              </Text>
              {filter === "pending" && (
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
                    setDueDate(new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]);
                    setIsAdding(true);
                  }}
                  accessibilityRole="button"
                >
                  <Text style={[styles.emptyActionBtnText, { color: colors.primary }]}>
                    Add a Reminder
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredActions.map((act) => {
              const linkedReceipt = receipts.find((r) => r.id === act.receipt_id);

              return (
                <View
                  key={act.id}
                  style={[
                    styles.actionCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={[
                      styles.checkCircle,
                      {
                        borderColor:
                          act.status === "completed"
                            ? colors.status.success.border
                            : colors.primary,
                        backgroundColor:
                          act.status === "completed" ? colors.status.success.bg : "transparent",
                      },
                    ]}
                    onPress={() => handleToggle(act)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: act.status === "completed" }}
                    accessibilityLabel={`Mark "${act.title}" as ${
                      act.status === "completed" ? "pending" : "completed"
                    }`}
                  >
                    <Text
                      style={[
                        styles.checkCircleText,
                        {
                          color:
                            act.status === "completed"
                              ? colors.status.success.text
                              : colors.primary,
                        },
                      ]}
                    >
                      {act.status === "completed" ? "✓" : ""}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.actionContent}>
                    <Text
                      style={[
                        styles.actionTitle,
                        { color: colors.textPrimary },
                        act.status === "completed" && [
                          styles.actionTitleCompleted,
                          { color: colors.textMuted },
                        ],
                      ]}
                    >
                      {act.title}
                    </Text>

                    <View style={styles.metaRow}>
                      <Text style={[styles.dueDate, { color: colors.primary }]}>
                        📅 Due: {act.due_date}
                      </Text>
                      {linkedReceipt && (
                        <Text
                          style={[styles.linkedReceipt, { color: colors.textSecondary }]}
                          numberOfLines={1}
                        >
                          • {linkedReceipt.merchant || linkedReceipt.title}
                        </Text>
                      )}
                    </View>

                    {act.notes && (
                      <Text style={[styles.notesText, { color: colors.textSecondary }]}>
                        {act.notes}
                      </Text>
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
                    setIsAdding(false);
                    setTitleError(null);
                    setDateError(null);
                  }}
                  style={styles.modalHeaderBtn}
                  accessibilityRole="button"
                >
                  <Text style={[styles.modalCancel, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>New Reminder</Text>
                <TouchableOpacity
                  onPress={handleAddAction}
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
                    {isSubmitting ? "Saving..." : "Save"}
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalForm}
                contentContainerStyle={{ padding: 16 }}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Title *</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colors.surface,
                      borderColor: titleError ? colors.status.danger.border : colors.controlBorder,
                      color: colors.textPrimary,
                    },
                  ]}
                  placeholder="e.g. Return defective mouse to Octagon"
                  placeholderTextColor={colors.textMuted}
                  value={title}
                  onChangeText={handleTitleChange}
                />
                {titleError && (
                  <Text style={[styles.inlineError, { color: colors.status.danger.text }]}>
                    {titleError}
                  </Text>
                )}

                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  Due Date (YYYY-MM-DD) *
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colors.surface,
                      borderColor: dateError ? colors.status.danger.border : colors.controlBorder,
                      color: colors.textPrimary,
                    },
                  ]}
                  placeholder="2026-09-15"
                  placeholderTextColor={colors.textMuted}
                  value={dueDate}
                  onChangeText={handleDateChange}
                />
                {dateError && (
                  <Text style={[styles.inlineError, { color: colors.status.danger.text }]}>
                    {dateError}
                  </Text>
                )}

                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  Reminder Type
                </Text>
                <View style={styles.typeCol}>
                  {ACTION_TYPES.map((t) => (
                    <TouchableOpacity
                      key={t.type}
                      style={[
                        styles.typeOption,
                        {
                          backgroundColor:
                            actionType === t.type ? colors.surfaceAlt : colors.surface,
                          borderColor: actionType === t.type ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => {
                        haptics.tap();
                        setActionType(t.type);
                      }}
                      accessibilityRole="button"
                    >
                      <Text
                        style={[
                          styles.typeText,
                          {
                            color: actionType === t.type ? colors.primary : colors.textPrimary,
                          },
                          actionType === t.type && styles.typeTextSelected,
                        ]}
                      >
                        {actionType === t.type ? "● " : "○ "}
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  Notes (Optional)
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    styles.notesInput,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.controlBorder,
                      color: colors.textPrimary,
                    },
                  ]}
                  placeholder="Details, requirements, or return policy terms..."
                  placeholderTextColor={colors.textMuted}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                />
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
    fontSize: 24,
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
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
    minHeight: 64,
  },
  checkCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  checkCircleText: {
    fontSize: 18,
    fontWeight: "800",
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  actionTitleCompleted: {
    textDecorationLine: "line-through",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  dueDate: {
    fontSize: 12,
    fontWeight: "700",
  },
  linkedReceipt: {
    fontSize: 12,
    marginLeft: 6,
    flex: 1,
  },
  notesText: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
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
    marginTop: 12,
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
  typeCol: {
    gap: 8,
    marginTop: 4,
  },
  typeOption: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    minHeight: 48,
    justifyContent: "center",
  },
  typeText: {
    fontSize: 14,
    fontWeight: "500",
  },
  typeTextSelected: {
    fontWeight: "700",
  },
  notesInput: {
    height: 72,
    paddingTop: 10,
    textAlignVertical: "top",
  },
});
