import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from "react-native";
import { colors, spacing, borderRadius, typography } from "../theme/tokens";
import { useLocalVault } from "../vault-context";
import { formatMoney, calculateReceiptTotals, ReceiptRecord } from "@katibay/shared";

interface HomeScreenProps {
  onOpenReceipt: (receipt: ReceiptRecord) => void;
  onOpenAskKeeptrail: () => void;
  onOpenStorageBackup: () => void;
  onOpenOnboarding?: () => void;
  onNavigateToTab: (tab: "receipts" | "collections" | "reminders") => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onOpenReceipt,
  onOpenAskKeeptrail,
  onOpenStorageBackup,
  onOpenOnboarding,
  onNavigateToTab,
}) => {
  const { receipts, stats } = useLocalVault();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredReceipts = searchQuery.trim()
    ? receipts.filter((r) => {
        const q = searchQuery.toLowerCase();
        return (
          (r.merchant || "").toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          (r.purpose || "").toLowerCase().includes(q) ||
          r.tags.some((t: string) => t.toLowerCase().includes(q))
        );
      })
    : receipts;

  const totals = calculateReceiptTotals(receipts);
  const primaryCurrency = Object.keys(totals.currencies)[0] || "PHP";
  const primaryTotalFormatted = totals.currencies[primaryCurrency]?.formatted || "₱0.00";

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandTitle}>KEEPTRAIL</Text>
            <Text style={styles.brandTagline}>Save it. Find it. Use it.</Text>
          </View>
          <View style={styles.headerRightActions}>
            {onOpenOnboarding && (
              <TouchableOpacity
                style={styles.guideBadge}
                onPress={onOpenOnboarding}
                accessibilityLabel="Onboarding Guide"
              >
                <Text style={styles.storageBadgeIcon}>📖</Text>
                <Text style={styles.storageBadgeText}>Guide</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.storageBadge}
              onPress={onOpenStorageBackup}
              accessibilityLabel="Storage and Backup Settings"
            >
              <Text style={styles.storageBadgeIcon}>🔒</Text>
              <Text style={styles.storageBadgeText}>Vault</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Local Security Status Banner */}
        <View style={styles.securityBanner}>
          <View style={styles.securityDot} />
          <Text style={styles.securityText}>Saved on this phone • 100% private local storage</Text>
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search merchant, item, or note..."
            placeholderTextColor={colors.brand.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Ask Keeptrail Quick Access Banner */}
        <TouchableOpacity style={styles.askBanner} onPress={onOpenAskKeeptrail} activeOpacity={0.8}>
          <View style={styles.askIconCircle}>
            <Text style={styles.askIcon}>✨</Text>
          </View>
          <View style={styles.askTextCol}>
            <Text style={styles.askTitle}>Ask Keeptrail</Text>
            <Text style={styles.askSubtitle}>
              Ask about spend, items, or return deadlines (on-device)
            </Text>
          </View>
          <Text style={styles.askChevron}>›</Text>
        </TouchableOpacity>

        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.summaryLabel}>Total Tracked Spending</Text>
              <Text style={styles.summaryValue}>{primaryTotalFormatted}</Text>
            </View>
            <View style={styles.summaryRightCol}>
              <Text style={styles.summaryCountLabel}>Receipts</Text>
              <Text style={styles.summaryCountValue}>{stats.receiptCount}</Text>
            </View>
          </View>

          {stats.unreviewedCount > 0 && (
            <TouchableOpacity
              style={styles.unreviewedAlert}
              onPress={() => onNavigateToTab("receipts")}
            >
              <Text style={styles.unreviewedAlertIcon}>⚠️</Text>
              <Text style={styles.unreviewedAlertText}>
                {stats.unreviewedCount} receipt(s) need review
              </Text>
              <Text style={styles.unreviewedAlertAction}>Review ›</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Recent Receipts Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {searchQuery.trim() ? "Search Results" : "Recent Receipts"}
          </Text>
          <TouchableOpacity onPress={() => onNavigateToTab("receipts")}>
            <Text style={styles.seeAllText}>See all ({receipts.length})</Text>
          </TouchableOpacity>
        </View>

        {filteredReceipts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={styles.emptyText}>No receipts found.</Text>
            <Text style={styles.emptySubtext}>
              Tap the Capture button below to save your first receipt.
            </Text>
          </View>
        ) : (
          filteredReceipts.slice(0, 6).map((receipt) => (
            <TouchableOpacity
              key={receipt.id}
              style={styles.receiptCard}
              onPress={() => onOpenReceipt(receipt)}
              activeOpacity={0.7}
            >
              <View style={styles.receiptTopRow}>
                <Text style={styles.receiptMerchant} numberOfLines={1}>
                  {receipt.merchant || receipt.title}
                </Text>
                <Text style={styles.receiptAmount}>
                  {formatMoney(receipt.total_minor_units, receipt.currency)}
                </Text>
              </View>

              <View style={styles.receiptBottomRow}>
                <Text style={styles.receiptDate}>{receipt.transaction_date || "No date"}</Text>

                <View style={styles.chipsRow}>
                  <View
                    style={[
                      styles.statusChip,
                      receipt.review_status === "reviewed"
                        ? styles.chipReviewed
                        : styles.chipUnreviewed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        receipt.review_status === "reviewed"
                          ? styles.chipReviewedText
                          : styles.chipUnreviewedText,
                      ]}
                    >
                      {receipt.review_status === "reviewed" ? "Reviewed" : "Needs Review"}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
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
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl * 2,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  brandTitle: {
    ...typography.sectionTitle,
    color: colors.brand.primary,
    letterSpacing: 1.5,
  },
  brandTagline: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginTop: 2,
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  guideBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brand.surface,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.brand.border,
  },
  storageBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brand.surfaceAlt,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.status.success.border,
  },
  storageBadgeIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  storageBadgeText: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.brand.primary,
  },
  securityBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.status.success.bg,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  securityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand.primary,
    marginRight: spacing.sm,
  },
  securityText: {
    ...typography.caption,
    color: colors.status.success.text,
    fontWeight: "600",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: colors.brand.border,
    borderRadius: borderRadius.control,
    paddingHorizontal: spacing.md,
    height: 48,
    marginBottom: spacing.md,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.brand.textPrimary,
  },
  askBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brand.surface,
    borderWidth: 1,
    borderColor: colors.brand.primary,
    borderRadius: borderRadius.card,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  askIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  askIcon: {
    fontSize: 18,
  },
  askTextCol: {
    flex: 1,
  },
  askTitle: {
    ...typography.bodyBold,
    color: colors.brand.textPrimary,
  },
  askSubtitle: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginTop: 2,
  },
  askChevron: {
    fontSize: 20,
    color: colors.brand.textMuted,
    marginLeft: spacing.sm,
  },
  summaryCard: {
    backgroundColor: colors.brand.surface,
    borderRadius: borderRadius.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.brand.border,
    marginBottom: spacing.xl,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryValue: {
    ...typography.mainTitle,
    color: colors.brand.primary,
    marginTop: 4,
  },
  summaryRightCol: {
    alignItems: "flex-end",
  },
  summaryCountLabel: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  summaryCountValue: {
    ...typography.sectionTitle,
    color: colors.brand.textPrimary,
    marginTop: 2,
  },
  unreviewedAlert: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.status.warning.bg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
  },
  unreviewedAlertIcon: {
    fontSize: 14,
    marginRight: spacing.xs,
  },
  unreviewedAlertText: {
    ...typography.caption,
    color: colors.status.warning.text,
    fontWeight: "600",
    flex: 1,
  },
  unreviewedAlertAction: {
    ...typography.caption,
    color: colors.status.warning.text,
    fontWeight: "700",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.heading2,
    color: colors.brand.textPrimary,
  },
  seeAllText: {
    ...typography.supporting,
    color: colors.brand.primary,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: spacing.xxl,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.bodyBold,
    color: colors.brand.textPrimary,
  },
  emptySubtext: {
    ...typography.supporting,
    color: colors.brand.textSecondary,
    textAlign: "center",
    marginTop: 4,
  },
  receiptCard: {
    backgroundColor: colors.brand.surface,
    borderRadius: borderRadius.control,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.brand.border,
    marginBottom: spacing.sm,
  },
  receiptTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  receiptMerchant: {
    ...typography.bodyBold,
    color: colors.brand.textPrimary,
    flex: 1,
    marginRight: spacing.md,
  },
  receiptAmount: {
    ...typography.bodyBold,
    color: colors.brand.primary,
  },
  receiptBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  receiptDate: {
    ...typography.caption,
    color: colors.brand.textSecondary,
  },
  chipsRow: {
    flexDirection: "row",
  },
  statusChip: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: borderRadius.full,
  },
  statusChipText: {
    ...typography.caption,
  },
  chipReviewed: {
    backgroundColor: colors.status.success.bg,
  },
  chipReviewedText: {
    ...typography.caption,
    color: colors.status.success.text,
    fontWeight: "600",
  },
  chipUnreviewed: {
    backgroundColor: colors.status.warning.bg,
  },
  chipUnreviewedText: {
    ...typography.caption,
    color: colors.status.warning.text,
    fontWeight: "600",
  },
});
