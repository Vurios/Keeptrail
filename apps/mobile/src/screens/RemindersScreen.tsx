/**
 * Reminders.
 *
 * Three things were wrong here and all three were about honesty.
 *
 * The screen promised "never miss a deadline" while scheduling no OS
 * notification, so it required the user to remember to check the thing that was
 * supposed to remember for them. The subtitle now describes what it is.
 *
 * Nothing compared a due date to today, so an item three months overdue looked
 * identical to one due next year. Items are now sorted by urgency and say how
 * late or how soon they are.
 *
 * Every new reminder was force-linked to `receipts[0]`, so a reminder about a
 * computer mouse displayed a stranger's lunch receipt underneath it. Linking is
 * now optional and explicit.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  View,
  type ListRenderItemInfo,
} from "react-native";
import {
  formatMoney,
  type ActionRecord,
  type ActionType,
  type ReceiptRecord,
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
  EmptyState,
  Field,
  IconButton,
  Notice,
  OptionRow,
  StatusBadge,
  useContentInsets,
} from "../components/primitives";
import { Icon } from "../components/Icon";
import { ACTION_TYPE_OPTIONS } from "../constants/options";
import {
  dueUrgency,
  formatDate,
  relativeDueLabel,
  todayIso,
  validateDateInput,
} from "../utils/dates";
import {
  cancelReminder,
  getNotificationPermission,
  requestNotificationPermission,
  scheduleReminder,
  type PermissionOutcome,
} from "../services/reminder-notifications";
import { haptics } from "../utils/haptics";

type Scope = "pending" | "completed";

const URGENCY_TONE = {
  overdue: "danger",
  today: "warning",
  soon: "warning",
  later: "neutral",
  unknown: "neutral",
} as const;

interface RemindersScreenProps {
  onOpenReceipt: (receipt: ReceiptRecord) => void;
}

export function RemindersScreen({ onOpenReceipt }: RemindersScreenProps) {
  const { colors, spacing } = useTheme();
  const { vault, receipts, actions, saveAction, deleteAction, toggleActionStatus } =
    useLocalVault();
  const { showSnackbar } = useSnackbar();
  const contentInsets = useContentInsets();

  const [scope, setScope] = useState<Scope>("pending");
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [actionType, setActionType] = useState<ActionType>("return_deadline");
  const [notes, setNotes] = useState("");
  const [linkedReceiptId, setLinkedReceiptId] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [permission, setPermission] = useState<PermissionOutcome | null>(null);

  // Read, never requested here: the prompt belongs to the moment the user saves
  // their first reminder, not to opening the screen.
  useEffect(() => {
    let cancelled = false;
    getNotificationPermission()
      .then((outcome) => {
        if (!cancelled) setPermission(outcome);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const filtered = actions.filter((a) =>
      scope === "pending" ? a.status !== "completed" : a.status === "completed",
    );
    // Soonest first for pending, most recently completed first otherwise.
    return filtered.sort((a, b) =>
      scope === "pending"
        ? a.due_date.localeCompare(b.due_date)
        : b.due_date.localeCompare(a.due_date),
    );
  }, [actions, scope]);

  const overdueCount = useMemo(
    () =>
      actions.filter((a) => a.status !== "completed" && dueUrgency(a.due_date) === "overdue")
        .length,
    [actions],
  );

  const resetComposer = useCallback(() => {
    setTitle("");
    setDueDate("");
    setActionType("return_deadline");
    setNotes("");
    setLinkedReceiptId(null);
    setDateError(null);
    setTitleError(null);
  }, []);

  const closeComposer = useCallback(() => {
    setComposerOpen(false);
    resetComposer();
  }, [resetComposer]);

  const handleCreate = useCallback(() => {
    if (!title.trim()) {
      setTitleError("Give the reminder a name so you know what it is for.");
      haptics.error();
      return;
    }
    const dateProblem = validateDateInput(dueDate) ?? (dueDate.trim() ? null : "Pick a due date.");
    if (dateProblem) {
      setDateError(dateProblem);
      haptics.error();
      return;
    }

    const now = new Date().toISOString();
    const linked = linkedReceiptId ? vault.getReceipt(linkedReceiptId) : null;

    const created: ActionRecord = {
      id: `act_${Date.now()}`,
      // Empty when the user did not link one. A relationship the user never
      // asserted is never displayed.
      receipt_id: linkedReceiptId ?? "",
      action_type: actionType,
      title: title.trim(),
      due_date: dueDate.trim(),
      status: "pending",
      amount_minor_units: linked?.total_minor_units ?? null,
      currency: linked?.currency ?? null,
      notes: notes.trim() || null,
      created_at: now,
      updated_at: now,
    };
    saveAction(created);

    haptics.success();
    closeComposer();

    // Permission is asked for now, because now is when it buys the user
    // something. A refusal still leaves a working list.
    void (async () => {
      const outcome = await requestNotificationPermission();
      setPermission(outcome);

      if (outcome !== "granted") {
        showSnackbar({
          message:
            outcome === "blocked"
              ? `Reminder saved for ${formatDate(
                  dueDate.trim(),
                )}. Notifications are turned off for Keeptrail in Android settings, so it will only appear in this list.`
              : `Reminder saved for ${formatDate(
                  dueDate.trim(),
                )}. Without notification permission it will only appear in this list.`,
          tone: "warning",
          durationMs: 6000,
        });
        return;
      }

      const scheduled = await scheduleReminder(created);
      showSnackbar({
        message: scheduled
          ? `Reminder set. Keeptrail will notify you on the morning of ${formatDate(
              dueDate.trim(),
            )}.`
          : `Reminder saved for ${formatDate(
              dueDate.trim(),
            )}. That date has already passed, so no notification was scheduled.`,
        tone: scheduled ? "success" : "warning",
        durationMs: 5000,
      });
    })();
  }, [
    title,
    dueDate,
    actionType,
    notes,
    linkedReceiptId,
    vault,
    saveAction,
    showSnackbar,
    closeComposer,
  ]);

  const handleDelete = useCallback(
    (action: ActionRecord) => {
      Alert.alert("Delete this reminder?", `"${action.title}" will be removed.`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteAction(action.id);
            void cancelReminder(action);
            haptics.warning();
            showSnackbar({
              message: "Reminder deleted.",
              tone: "warning",
              action: {
                label: "Undo",
                onPress: () => {
                  saveAction(action);
                  void scheduleReminder(action);
                },
              },
            });
          },
        },
      ]);
    },
    [deleteAction, saveAction, showSnackbar],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ActionRecord>) => {
      const urgency = dueUrgency(item.due_date);
      const completed = item.status === "completed";
      const linked = item.receipt_id ? vault.getReceipt(item.receipt_id) : null;
      const typeLabel =
        ACTION_TYPE_OPTIONS.find((option) => option.value === item.action_type)?.label ??
        "Reminder";

      return (
        <Card>
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <IconButton
              icon={completed ? "done" : "check"}
              tone={completed ? "primary" : "secondary"}
              label={completed ? `Mark "${item.title}" as pending` : `Mark "${item.title}" done`}
              onPress={() => {
                toggleActionStatus(item.id);
                haptics.tap();
                // Completing a reminder must also silence it; leaving the
                // trigger scheduled is how an app nags about done work.
                void (item.status === "completed"
                  ? scheduleReminder({ ...item, status: "pending" })
                  : cancelReminder(item));
              }}
            />

            <View style={{ flex: 1, gap: spacing.xs }}>
              <AppText role="bodyStrong" numberOfLines={2}>
                {item.title}
              </AppText>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  flexWrap: "wrap",
                }}
              >
                {completed ? (
                  <StatusBadge label="Done" tone="success" icon="done" />
                ) : (
                  <StatusBadge
                    label={relativeDueLabel(item.due_date)}
                    tone={URGENCY_TONE[urgency]}
                    icon={urgency === "overdue" ? "overdue" : "due"}
                  />
                )}
                <AppText role="small" tone="muted">
                  {typeLabel} · {formatDate(item.due_date)}
                </AppText>
              </View>

              {item.notes ? (
                <AppText role="small" tone="secondary" numberOfLines={2}>
                  {item.notes}
                </AppText>
              ) : null}

              {linked ? (
                <Button
                  label={`${linked.merchant ?? linked.title} · ${formatMoney(
                    linked.total_minor_units,
                    linked.currency,
                  )}`}
                  variant="text"
                  icon="receipts"
                  onPress={() => onOpenReceipt(linked)}
                  style={{ paddingHorizontal: 0 }}
                />
              ) : null}
            </View>

            <IconButton
              icon="trash"
              tone="danger"
              label={`Delete reminder "${item.title}"`}
              onPress={() => handleDelete(item)}
            />
          </View>
        </Card>
      );
    },
    [spacing, vault, toggleActionStatus, onOpenReceipt, handleDelete],
  );

  const keyExtractor = useCallback((item: ActionRecord) => item.id, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppBar
        title="Reminders"
        subtitle={
          permission === "granted"
            ? "Keeptrail notifies you on the morning a deadline falls due"
            : "Your deadline list. Turn on notifications to be told when one falls due."
        }
        actions={
          <IconButton
            icon="add"
            tone="primary"
            label="Add a reminder"
            onPress={() => {
              haptics.tap();
              setDueDate(todayIso());
              setComposerOpen(true);
            }}
          />
        }
      />

      <View
        style={{
          flexDirection: "row",
          gap: spacing.sm,
          paddingHorizontal: spacing.gutter,
          paddingTop: spacing.md,
        }}
      >
        <Chip
          label="Pending"
          selected={scope === "pending"}
          onPress={() => setScope("pending")}
          count={actions.filter((a) => a.status !== "completed").length}
        />
        <Chip
          label="Done"
          selected={scope === "completed"}
          onPress={() => setScope("completed")}
          count={actions.filter((a) => a.status === "completed").length}
        />
      </View>

      <FlatList
        data={visible}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        contentContainerStyle={contentInsets}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews
        ListHeaderComponent={
          scope === "pending" && overdueCount > 0 ? (
            <View style={{ marginBottom: spacing.md }}>
              <Notice
                tone="danger"
                icon="overdue"
                body={`${overdueCount} deadline${
                  overdueCount === 1 ? " has" : "s have"
                } already passed.`}
              />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon={scope === "pending" ? "due" : "done"}
            title={scope === "pending" ? "No deadlines tracked" : "Nothing completed yet"}
            body={
              scope === "pending"
                ? "Add a return window, a refund to chase or a reimbursement to file, and it will appear here sorted by how soon it is due."
                : "Reminders you tick off move here."
            }
            action={
              scope === "pending"
                ? {
                    label: "Add a reminder",
                    icon: "add",
                    onPress: () => {
                      setDueDate(todayIso());
                      setComposerOpen(true);
                    },
                  }
                : undefined
            }
          />
        }
      />

      <Modal visible={composerOpen} animationType="slide" onRequestClose={closeComposer}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <AppBar
            title="New reminder"
            onBack={closeComposer}
            actions={<Button label="Save" onPress={handleCreate} />}
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
              <Notice
                tone="info"
                icon="info"
                body="Keeptrail keeps this list on your phone and shows it when you open the app. This build does not send push notifications."
              />

              <Field
                label="What do you need to do?"
                value={title}
                onChangeText={(text) => {
                  setTitle(text);
                  if (text.trim()) setTitleError(null);
                }}
                placeholder="e.g. Return the defective mouse"
                error={titleError}
                required
              />

              <Field
                label="Due date"
                value={dueDate}
                onChangeText={(text) => {
                  setDueDate(text);
                  setDateError(validateDateInput(text));
                }}
                placeholder="YYYY-MM-DD"
                keyboardType="numbers-and-punctuation"
                error={dateError}
                required
              />

              <OptionRow
                label="Type"
                options={ACTION_TYPE_OPTIONS}
                value={actionType}
                onChange={setActionType}
              />

              <View style={{ gap: spacing.sm }}>
                <AppText role="smallStrong" tone="secondary">
                  Link a receipt (optional)
                </AppText>
                {receipts.length === 0 ? (
                  <AppText role="small" tone="muted">
                    You have no saved receipts to link yet.
                  </AppText>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}
                  >
                    {receipts.slice(0, 20).map((receipt) => (
                      <Chip
                        key={receipt.id}
                        label={receipt.merchant ?? receipt.title}
                        selected={linkedReceiptId === receipt.id}
                        onPress={() =>
                          setLinkedReceiptId(linkedReceiptId === receipt.id ? null : receipt.id)
                        }
                      />
                    ))}
                  </ScrollView>
                )}
                <AppText role="small" tone="muted">
                  Leave this alone if the reminder is not about a specific receipt.
                </AppText>
              </View>

              <Field
                label="Notes"
                value={notes}
                onChangeText={setNotes}
                placeholder="Return policy terms, reference numbers, requirements"
                multiline
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}
