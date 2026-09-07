/**
 * Home.
 *
 * Ordered by what a returning user actually needs: anything overdue or awaiting
 * review first, then search, then the money summary, then recent records. The
 * previous version stacked five full-width blocks — a security banner, search,
 * an assistant card, a summary and a section header — before the first receipt,
 * so content began two-thirds down the screen.
 */

import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, TextInput, View, type ListRenderItemInfo } from "react-native";
import {
  calculateReceiptTotals,
  formatMoney,
  type CurrencyTotal,
  type ReceiptRecord,
} from "@katibay/shared";

import { useTheme } from "../theme/ThemeContext";
import { useLocalVault } from "../vault-context";
import {
  AppBar,
  AppText,
  Button,
  Card,
  EmptyState,
  IconButton,
  Money,
  Notice,
  Section,
  useContentInsets,
} from "../components/primitives";
import { Icon } from "../components/Icon";
import { ReceiptRow } from "../components/ReceiptRow";
import { relativeDueLabel } from "../utils/dates";

const RECENT_LIMIT = 8;

interface HomeScreenProps {
  onOpenReceipt: (receipt: ReceiptRecord) => void;
  onOpenAsk: () => void;
  onOpenGuide: () => void;
  onOpenReviewQueue: () => void;
  onOpenCollection: (collectionId: string) => void;
  onOpenAllReceipts: () => void;
  onStartCapture: () => void;
}

export function HomeScreen({
  onOpenReceipt,
  onOpenAsk,
  onOpenGuide,
  onOpenReviewQueue,
  onOpenCollection,
  onOpenAllReceipts,
  onStartCapture,
}: HomeScreenProps) {
  const { colors, spacing, radius, typography, mode, setMode, isDark } = useTheme();
  const { vault, receipts, collections, actions, stats, storageError, loadSampleReceipts } =
    useLocalVault();
  const contentInsets = useContentInsets();
  const [query, setQuery] = useState("");

  // Search runs through the vault so it covers the same fields as the Receipts
  // tab, including text scanned off the receipt itself. Two search boxes over
  // one corpus with different field sets is how "Chickenjoy" used to match on
  // one screen and not the other.
  const results = useMemo(
    () => (query.trim() ? vault.listReceipts({ searchQuery: query, trashScope: "active" }) : null),
    [query, vault, receipts],
  );

  const totals = useMemo(() => calculateReceiptTotals(receipts), [receipts]);
  const currencyTotals = useMemo<CurrencyTotal[]>(
    () =>
      Object.values(totals.currencies).sort((a, b) => b.total_minor_units - a.total_minor_units),
    [totals],
  );

  const overdue = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return actions.filter((a) => a.status === "pending" && a.due_date < today);
  }, [actions]);

  const dueSoon = useMemo(() => {
    const today = new Date();
    const horizon = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);
    const todayIso = today.toISOString().slice(0, 10);
    return actions.filter(
      (a) => a.status === "pending" && a.due_date >= todayIso && a.due_date <= horizon,
    );
  }, [actions]);

  const recent = useMemo(() => receipts.slice(0, RECENT_LIMIT), [receipts]);
  const listData = results ?? recent;

  const collectionsWithCounts = useMemo(
    () =>
      collections
        .map((collection) => ({
          collection,
          count: receipts.filter((r) => r.collection_ids.includes(collection.id)).length,
        }))
        .filter((entry) => entry.count > 0)
        .sort((a, b) => b.count - a.count),
    [collections, receipts],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ReceiptRecord>) => (
      <ReceiptRow receipt={item} onPress={onOpenReceipt} />
    ),
    [onOpenReceipt],
  );

  const keyExtractor = useCallback((item: ReceiptRecord) => item.id, []);

  const header = (
    <View style={{ gap: spacing.lg }}>
      {storageError ? (
        <Notice
          tone="danger"
          icon="warning"
          title="Records are not being saved"
          body={storageError}
        />
      ) : null}

      {/* Search is the first control because retrieval is the product's verb. */}
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
          placeholder="Search merchant, item or note"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Search your receipts"
          returnKeyType="search"
          style={[typography.body, { flex: 1, color: colors.textPrimary, paddingVertical: 0 }]}
        />
        {query.length > 0 ? (
          <IconButton icon="clear" label="Clear search" onPress={() => setQuery("")} />
        ) : null}
      </View>

      {results ? (
        <AppText role="small" tone="secondary">
          {results.length === 0
            ? `Nothing matches "${query.trim()}"`
            : `${results.length} match${results.length === 1 ? "" : "es"} for "${query.trim()}"`}
        </AppText>
      ) : (
        <>
          {/* Anything time-sensitive outranks everything else on the screen. */}
          {overdue.length > 0 ? (
            <Notice
              tone="danger"
              icon="overdue"
              title={`${overdue.length} deadline${overdue.length === 1 ? "" : "s"} passed`}
              body={overdue
                .slice(0, 2)
                .map((a) => `${a.title} — ${relativeDueLabel(a.due_date)}`)
                .join("\n")}
            />
          ) : null}

          {stats.unreviewedCount > 0 ? (
            <Card
              onPress={onOpenReviewQueue}
              accessibilityLabel={`${stats.unreviewedCount} receipts need review`}
              accessibilityHint="Opens the receipts that still need checking"
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <Icon name="needsReview" size={22} color={colors.status.warning.text} />
                <View style={{ flex: 1 }}>
                  <AppText role="bodyStrong">
                    {stats.unreviewedCount} receipt{stats.unreviewedCount === 1 ? "" : "s"} need
                    review
                  </AppText>
                  <AppText role="small" tone="secondary">
                    Scanned amounts have not been confirmed yet
                  </AppText>
                </View>
                <Icon name="chevron" size={20} color={colors.textMuted} />
              </View>
            </Card>
          ) : null}

          {/* Money is the only place brass appears, so a total is recognisable
              before it is read. Every currency is listed — the previous version
              showed one and reported the rest as "+1 other currency", with the
              amount unreachable anywhere in the app. */}
          {currencyTotals.length > 0 ? (
            <Card>
              <AppText role="label" tone="muted">
                SAVED ON THIS PHONE
              </AppText>
              <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
                {currencyTotals.map((total, index) => (
                  <View
                    key={total.currency}
                    style={{
                      flexDirection: "row",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                    }}
                  >
                    <Money
                      formatted={total.formatted}
                      size={index === 0 ? "headline" : "row"}
                      tone="accent"
                    />
                    <AppText role="small" tone="secondary">
                      {total.record_count} record{total.record_count === 1 ? "" : "s"}
                      {currencyTotals.length > 1 ? ` · ${total.currency}` : ""}
                    </AppText>
                  </View>
                ))}
              </View>
              {totals.total_records_unknown_amount > 0 ? (
                <AppText role="small" tone="muted" style={{ marginTop: spacing.sm }}>
                  {totals.total_records_unknown_amount} record
                  {totals.total_records_unknown_amount === 1 ? " has" : "s have"} no amount recorded
                  and {totals.total_records_unknown_amount === 1 ? "is" : "are"} not counted above.
                </AppText>
              ) : null}
              {currencyTotals.length > 1 ? (
                <AppText role="small" tone="muted" style={{ marginTop: spacing.xs }}>
                  Currencies are kept separate and never added together.
                </AppText>
              ) : null}
            </Card>
          ) : null}

          {dueSoon.length > 0 ? (
            <Notice
              tone="warning"
              icon="due"
              body={`${dueSoon.length} deadline${
                dueSoon.length === 1 ? "" : "s"
              } within a week: ${dueSoon
                .slice(0, 2)
                .map((a) => a.title)
                .join(", ")}`}
            />
          ) : null}

          {collectionsWithCounts.length > 0 ? (
            <Section title="Collections">
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {collectionsWithCounts.map(({ collection, count }) => (
                  <Pressable
                    key={collection.id}
                    onPress={() => onOpenCollection(collection.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${collection.name}, ${count} receipts`}
                    android_ripple={{ color: colors.scrim }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                      minHeight: spacing.touch,
                      paddingHorizontal: spacing.lg,
                      borderRadius: radius.full,
                      borderWidth: 1,
                      borderColor: colors.divider,
                      backgroundColor: colors.surface,
                    }}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: collection.color,
                      }}
                    />
                    <AppText role="smallStrong">{collection.name}</AppText>
                    <AppText role="small" tone="muted">
                      {count}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            </Section>
          ) : null}

          {recent.length > 0 ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: spacing.lg,
                minHeight: spacing.touch,
              }}
            >
              <AppText role="label" tone="muted">
                RECENT
              </AppText>
              {receipts.length > RECENT_LIMIT ? (
                <Button
                  label={`See all ${receipts.length}`}
                  variant="text"
                  onPress={onOpenAllReceipts}
                />
              ) : null}
            </View>
          ) : null}
        </>
      )}
    </View>
  );

  const empty = results ? (
    <EmptyState
      icon="search"
      title="No matching receipt"
      body="Search covers the merchant, your note and purpose, tags, and any text scanned off the receipt itself."
    />
  ) : (
    <EmptyState
      icon="receipts"
      title="Nothing saved yet"
      body="Add your first receipt and it is written to this phone straight away. Nothing is uploaded anywhere."
      action={{ label: "Add a receipt", onPress: onStartCapture, icon: "add" }}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppBar
        title="Keeptrail"
        subtitle="Save it. Find it. Use it."
        actions={
          <>
            <IconButton icon="assistant" label="Ask Keeptrail" onPress={onOpenAsk} tone="primary" />
            <IconButton icon="guide" label="Open the guide" onPress={onOpenGuide} />
            <IconButton
              icon={isDark ? "light" : "dark"}
              label={isDark ? "Switch to light theme" : "Switch to dark theme"}
              onPress={() => setMode(mode === "dark" ? "light" : "dark")}
            />
          </>
        }
      />

      <FlatList
        data={listData}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={{ marginTop: results ? spacing.lg : spacing.section }}>{empty}</View>
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        contentContainerStyle={contentInsets}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        ListFooterComponent={
          receipts.length === 0 && !results ? (
            <View style={{ marginTop: spacing.md, alignItems: "flex-start" }}>
              <Button
                label="Load two sample receipts"
                variant="text"
                icon="document"
                onPress={loadSampleReceipts}
                accessibilityHint="Adds clearly labelled sample records you can delete at any time"
              />
            </View>
          ) : null
        }
      />
    </View>
  );
}
