/**
 * Collections.
 *
 * One of the four primary destinations. It shows how receipts are grouped and
 * what each group is worth, and it can create and edit groups — the previous
 * version was read-only and instructed users to file receipts from an editor
 * that had no such control.
 *
 * Counting rule (blueprint §4, "Summaries and reports"): a receipt may belong to
 * several collections without becoming several purchases. Per-collection totals
 * therefore overlap by design, and the screen says so rather than presenting a
 * sum of them as a grand total. The unfiled count is computed over canonical
 * receipt IDs so nothing is double-counted.
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
  type ListRenderItemInfo,
} from "react-native";
import { calculateReceiptTotals, type CollectionRecord, type ReceiptRecord } from "@katibay/shared";

import { useTheme } from "../theme/ThemeContext";
import { useLocalVault } from "../vault-context";
import { useSnackbar } from "../components/SnackbarContext";
import {
  AppBar,
  AppText,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Money,
  Notice,
  useContentInsets,
} from "../components/primitives";
import { Icon } from "../components/Icon";
import { COLLECTION_COLOR_OPTIONS } from "../constants/options";
import { haptics } from "../utils/haptics";

interface CollectionsScreenProps {
  onOpenCollection: (collectionId: string) => void;
  onOpenUnfiled: () => void;
}

interface CollectionSummary {
  collection: CollectionRecord;
  receiptCount: number;
  /** One formatted total per currency. Currencies are never blended. */
  totals: { currency: string; formatted: string; count: number }[];
  unreviewedCount: number;
}

export function CollectionsScreen({ onOpenCollection, onOpenUnfiled }: CollectionsScreenProps) {
  const { colors, spacing, radius } = useTheme();
  const { receipts, collections, saveCollection } = useLocalVault();
  const { showSnackbar } = useSnackbar();
  const contentInsets = useContentInsets();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLLECTION_COLOR_OPTIONS[0].value);
  const [nameError, setNameError] = useState<string | null>(null);

  const summaries = useMemo<CollectionSummary[]>(() => {
    return collections.map((collection) => {
      const members = receipts.filter((r) => r.collection_ids.includes(collection.id));
      const summary = calculateReceiptTotals(members);
      return {
        collection,
        receiptCount: members.length,
        totals: Object.values(summary.currencies).map((entry) => ({
          currency: entry.currency,
          formatted: entry.formatted,
          count: entry.record_count,
        })),
        unreviewedCount: members.filter((r) => r.review_status !== "reviewed").length,
      };
    });
  }, [collections, receipts]);

  // Canonical IDs, so a receipt filed in three collections is still one receipt.
  const filedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const receipt of receipts) {
      if (receipt.collection_ids.length > 0) ids.add(receipt.id);
    }
    return ids;
  }, [receipts]);

  const unfiledCount = receipts.length - filedIds.size;

  const anyMultiFiled = useMemo(
    () => receipts.some((r) => r.collection_ids.length > 1),
    [receipts],
  );

  const openCreate = useCallback(() => {
    haptics.tap();
    setEditingId(null);
    setName("");
    setDescription("");
    setColor(COLLECTION_COLOR_OPTIONS[0].value);
    setNameError(null);
    setEditorOpen(true);
  }, []);

  const openEdit = useCallback((collection: CollectionRecord) => {
    haptics.tap();
    setEditingId(collection.id);
    setName(collection.name);
    setDescription(collection.description ?? "");
    setColor(collection.color);
    setNameError(null);
    setEditorOpen(true);
  }, []);

  const handleSave = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Give the collection a name.");
      haptics.error();
      return;
    }
    const clash = collections.some(
      (c) => c.id !== editingId && c.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (clash) {
      setNameError("You already have a collection with that name.");
      haptics.error();
      return;
    }

    const now = new Date().toISOString();
    const existing = editingId ? collections.find((c) => c.id === editingId) : null;

    saveCollection({
      id: editingId ?? `col_${Date.now()}`,
      name: trimmed,
      color,
      icon: existing?.icon ?? "folder",
      description: description.trim() || null,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    });

    haptics.success();
    showSnackbar({
      message: existing ? `"${trimmed}" updated.` : `"${trimmed}" created.`,
      tone: "success",
    });
    setEditorOpen(false);
  }, [name, description, color, editingId, collections, saveCollection, showSnackbar]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<CollectionSummary>) => (
      <Card
        onPress={() => onOpenCollection(item.collection.id)}
        accessibilityLabel={`${item.collection.name}, ${item.receiptCount} receipts`}
        accessibilityHint="Opens these receipts in the Receipts tab"
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
          {/* A colour bar rather than an icon in a circle: it identifies the
              collection without pretending to be a button. */}
          <View
            style={{
              width: 4,
              alignSelf: "stretch",
              minHeight: 40,
              borderRadius: 2,
              backgroundColor: item.collection.color,
            }}
          />

          <View style={{ flex: 1, gap: spacing.xs }}>
            <AppText role="bodyStrong" numberOfLines={1}>
              {item.collection.name}
            </AppText>
            {item.collection.description ? (
              <AppText role="small" tone="secondary" numberOfLines={2}>
                {item.collection.description}
              </AppText>
            ) : null}

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                flexWrap: "wrap",
                marginTop: spacing.xxs,
              }}
            >
              <AppText role="small" tone="muted">
                {item.receiptCount} receipt{item.receiptCount === 1 ? "" : "s"}
              </AppText>
              {item.unreviewedCount > 0 ? (
                <AppText role="small" style={{ color: colors.status.warning.text }}>
                  {item.unreviewedCount} to review
                </AppText>
              ) : null}
            </View>
          </View>

          <View style={{ alignItems: "flex-end", gap: spacing.xs }}>
            {item.totals.length === 0 ? (
              <AppText role="small" tone="muted">
                No amounts
              </AppText>
            ) : (
              item.totals.map((total) => (
                <Money key={total.currency} formatted={total.formatted} tone="accent" />
              ))
            )}
            <IconButton
              icon="edit"
              label={`Edit ${item.collection.name}`}
              onPress={() => openEdit(item.collection)}
            />
          </View>
        </View>
      </Card>
    ),
    [spacing, colors, onOpenCollection, openEdit],
  );

  const keyExtractor = useCallback((item: CollectionSummary) => item.collection.id, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppBar
        title="Collections"
        subtitle="Group receipts by what they are for"
        actions={
          <IconButton icon="add" tone="primary" label="New collection" onPress={openCreate} />
        }
      />

      <FlatList
        data={summaries}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        contentContainerStyle={contentInsets}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
            {unfiledCount > 0 ? (
              <Card
                onPress={onOpenUnfiled}
                accessibilityLabel={`${unfiledCount} receipts are not in any collection`}
                accessibilityHint="Opens the unfiled receipts so you can file them"
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                  <Icon name="collection" size={22} color={colors.textSecondary} />
                  <View style={{ flex: 1 }}>
                    <AppText role="bodyStrong">
                      {unfiledCount} unfiled receipt{unfiledCount === 1 ? "" : "s"}
                    </AppText>
                    <AppText role="small" tone="secondary">
                      Not in any collection yet
                    </AppText>
                  </View>
                  <Icon name="chevron" size={20} color={colors.textMuted} />
                </View>
              </Card>
            ) : null}

            {anyMultiFiled ? (
              <Notice
                tone="neutral"
                icon="info"
                body="A receipt can sit in more than one collection, so these totals overlap. Each receipt is still counted once in your Home total."
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="collection"
            title="No collections yet"
            body="Collections group receipts by purpose — a trip, a project, a claim. Open any receipt to file it into one."
            action={{ label: "New collection", onPress: openCreate, icon: "add" }}
          />
        }
      />

      <Modal visible={editorOpen} animationType="slide" onRequestClose={() => setEditorOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <AppBar
            title={editingId ? "Edit collection" : "New collection"}
            onBack={() => setEditorOpen(false)}
            actions={<Button label="Save" onPress={handleSave} />}
          />
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <ScrollView
              contentContainerStyle={{ padding: spacing.gutter, gap: spacing.lg }}
              keyboardShouldPersistTaps="handled"
            >
              <Field
                label="Name"
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (text.trim()) setNameError(null);
                }}
                placeholder="e.g. Home renovation, Tax year 2026"
                error={nameError}
                required
              />

              <Field
                label="What belongs here?"
                value={description}
                onChangeText={setDescription}
                placeholder="A short reminder of what this collection is for"
                multiline
              />

              <View style={{ gap: spacing.sm }}>
                <AppText role="smallStrong" tone="secondary">
                  Colour
                </AppText>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                  {COLLECTION_COLOR_OPTIONS.map((option) => {
                    const selected = option.value === color;
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => setColor(option.value)}
                        accessibilityRole="radio"
                        // Named, not announced as a hex code.
                        accessibilityLabel={option.label}
                        accessibilityState={{ selected }}
                        style={{
                          minWidth: spacing.touch,
                          minHeight: spacing.touch,
                          borderRadius: radius.control,
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: selected ? 2 : 1,
                          borderColor: selected ? colors.textPrimary : colors.divider,
                          backgroundColor: colors.surface,
                        }}
                      >
                        <View
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 11,
                            backgroundColor: option.value,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {/* Selection is shown by a mark as well as by colour,
                              so it does not depend on colour perception. */}
                          {selected ? <Icon name="check" size={14} color="#FFFFFF" /> : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {editingId ? (
                <Notice
                  tone="neutral"
                  icon="info"
                  body="Renaming a collection keeps every receipt filed in it."
                />
              ) : null}
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}
