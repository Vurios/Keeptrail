import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  RefreshControl,
  Platform,
  StatusBar,
} from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { useToast } from "../components/ToastContext";
import { useLocalVault } from "../vault-context";
import { formatMoney, calculateReceiptTotals, ReceiptRecord } from "@katibay/shared";
import { haptics } from "../utils/haptics";

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
  const { colors, spacing, borderRadius, typography, isDark, toggleTheme } = useTheme();
  const { receipts, stats, refreshState } = useLocalVault();
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    refreshState();
    haptics.tap();
    setTimeout(() => {
      setIsRefreshing(false);
      showToast({
        type: "success",
        title: "Vault Refreshed",
        message: `${stats.receiptCount} receipts loaded from local SQLite database.`,
        duration: 2000,
      });
    }, 400);
  };

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
  const currencyKeys = Object.keys(totals.currencies);
  const primaryCurrency = currencyKeys[0] || "PHP";
  const primaryTotalFormatted = totals.currencies[primaryCurrency]?.formatted || "₱0.00";

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Brand Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.brandTitle, { color: colors.primary }]}>KEEPTRAIL</Text>
            <Text style={[styles.brandTagline, { color: colors.textSecondary }]}>
              Save it. Find it. Use it.
            </Text>
          </View>
          <View style={styles.headerRightActions}>
            {/* Dark / Light Mode Toggle */}
            <TouchableOpacity
              style={[
                styles.iconActionBtn,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => {
                haptics.tap();
                toggleTheme();
              }}
              accessibilityRole="button"
              accessibilityLabel={`Switch to ${isDark ? "light" : "dark"} mode`}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.iconActionText}>{isDark ? "☀️" : "🌙"}</Text>
            </TouchableOpacity>

            {onOpenOnboarding && (
              <TouchableOpacity
                style={[
                  styles.guideBadge,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => {
                  haptics.tap();
                  onOpenOnboarding();
                }}
                accessibilityRole="button"
                accessibilityLabel="Onboarding Guide"
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={styles.storageBadgeIcon}>📖</Text>
                <Text style={[styles.guideBadgeText, { color: colors.textPrimary }]}>Guide</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.storageBadge,
                {
                  backgroundColor: colors.surfaceAlt,
                  borderColor: colors.status.success.border,
                },
              ]}
              onPress={() => {
                haptics.tap();
                onOpenStorageBackup();
              }}
              accessibilityRole="button"
              accessibilityLabel="Storage and Backup Settings"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={styles.storageBadgeIcon}>🔒</Text>
              <Text style={[styles.storageBadgeText, { color: colors.primary }]}>Vault</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Local Security Status Banner */}
        <View
          style={[
            styles.securityBanner,
            {
              backgroundColor: colors.status.success.bg,
              borderColor: colors.status.success.border,
            },
          ]}
        >
          <View style={[styles.securityDot, { backgroundColor: colors.status.success.text }]} />
          <Text style={[styles.securityText, { color: colors.status.success.text }]}>
            Saved on this phone • 100% private local storage
          </Text>
        </View>

        {/* Search Input with Clear Button */}
        <View
          style={[
            styles.searchContainer,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search merchant, item, or note..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            accessibilityRole="search"
            accessibilityLabel="Search receipts"
            returnKeyType="search"
          />
          {searchQuery.trim().length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              style={styles.clearSearchBtn}
              accessibilityLabel="Clear search text"
              accessibilityRole="button"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={[styles.clearSearchText, { color: colors.textMuted }]}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Ask Keeptrail Quick Access Banner */}
        <TouchableOpacity
          style={[
            styles.askBanner,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
          onPress={() => {
            haptics.tap();
            onOpenAskKeeptrail();
          }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Ask Keeptrail Assistant"
        >
          <View style={[styles.askIconCircle, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={styles.askIcon}>✨</Text>
          </View>
          <View style={styles.askTextCol}>
            <Text style={[styles.askTitle, { color: colors.textPrimary }]}>Ask Keeptrail</Text>
            <Text style={[styles.askSubtitle, { color: colors.textSecondary }]}>
              Ask about spend, items, or return deadlines (on-device)
            </Text>
          </View>
          <Text style={[styles.askChevron, { color: colors.textMuted }]}>›</Text>
        </TouchableOpacity>

        {/* Summary Spending Card */}
        <View
          style={[
            styles.summaryCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.summaryRow}>
            <View>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                Total Tracked Spending
              </Text>
              <Text style={[styles.summaryValue, { color: colors.primary }]}>
                {primaryTotalFormatted}
              </Text>
              {currencyKeys.length > 1 && (
                <Text style={[styles.multiCurrencyNotice, { color: colors.textMuted }]}>
                  +{currencyKeys.length - 1} other currency kept separate
                </Text>
              )}
            </View>
            <View style={styles.summaryRightCol}>
              <Text style={[styles.summaryCountLabel, { color: colors.textSecondary }]}>
                Receipts
              </Text>
              <Text style={[styles.summaryCountValue, { color: colors.textPrimary }]}>
                {stats.receiptCount}
              </Text>
            </View>
          </View>

          {stats.unreviewedCount > 0 && (
            <TouchableOpacity
              style={[
                styles.unreviewedAlert,
                {
                  backgroundColor: colors.status.warning.bg,
                  borderColor: colors.status.warning.border,
                },
              ]}
              onPress={() => {
                haptics.tap();
                onNavigateToTab("receipts");
              }}
              accessibilityRole="button"
              accessibilityLabel={`${stats.unreviewedCount} receipts need review. Tap to review.`}
            >
              <Text style={styles.unreviewedAlertIcon}>⚠️</Text>
              <Text style={[styles.unreviewedAlertText, { color: colors.status.warning.text }]}>
                {stats.unreviewedCount} receipt(s) need review
              </Text>
              <Text style={[styles.unreviewedAlertAction, { color: colors.status.warning.text }]}>
                Review ›
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Recent Receipts Section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            {searchQuery.trim() ? "Search Results" : "Recent Receipts"}
          </Text>
          <TouchableOpacity
            onPress={() => {
              haptics.tap();
              onNavigateToTab("receipts");
            }}
            accessibilityRole="button"
            accessibilityLabel="See all receipts"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.seeAllText, { color: colors.primary }]}>
              See all ({receipts.length})
            </Text>
          </TouchableOpacity>
        </View>

        {filteredReceipts.length === 0 ? (
          <View
            style={[
              styles.emptyContainer,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={styles.emptyIcon}>📂</Text>
            <Text style={[styles.emptyText, { color: colors.textPrimary }]}>
              {searchQuery.trim() ? "No matching receipts" : "No receipts saved yet"}
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              {searchQuery.trim()
                ? `No receipts found matching "${searchQuery}". Try a different keyword.`
                : "Tap the Capture (+) button below to photograph or add your first receipt."}
            </Text>
            {searchQuery.trim() && (
              <TouchableOpacity
                style={[
                  styles.clearFilterBtn,
                  {
                    backgroundColor: colors.surfaceAlt,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => setSearchQuery("")}
                accessibilityRole="button"
              >
                <Text style={[styles.clearFilterBtnText, { color: colors.primary }]}>
                  Clear Search Filter
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredReceipts.slice(0, 6).map((receipt) => (
            <TouchableOpacity
              key={receipt.id}
              style={[
                styles.receiptCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => {
                haptics.tap();
                onOpenReceipt(receipt);
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Receipt from ${
                receipt.merchant || receipt.title
              }, amount ${formatMoney(receipt.total_minor_units, receipt.currency)}`}
            >
              <View style={styles.receiptTopRow}>
                <Text
                  style={[styles.receiptMerchant, { color: colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {receipt.merchant || receipt.title}
                </Text>
                <Text style={[styles.receiptAmount, { color: colors.primary }]}>
                  {formatMoney(receipt.total_minor_units, receipt.currency)}
                </Text>
              </View>

              <View style={styles.receiptBottomRow}>
                <Text style={[styles.receiptDate, { color: colors.textSecondary }]}>
                  {receipt.transaction_date || "No date"}
                </Text>

                <View style={styles.chipsRow}>
                  <View
                    style={[
                      styles.statusChip,
                      {
                        backgroundColor:
                          receipt.review_status === "reviewed"
                            ? colors.status.success.bg
                            : colors.status.warning.bg,
                        borderColor:
                          receipt.review_status === "reviewed"
                            ? colors.status.success.border
                            : colors.status.warning.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        {
                          color:
                            receipt.review_status === "reviewed"
                              ? colors.status.success.text
                              : colors.status.warning.text,
                        },
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
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 110,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  brandTagline: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  iconActionText: {
    fontSize: 16,
  },
  guideBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 36,
  },
  guideBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  storageBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 36,
  },
  storageBadgeIcon: {
    fontSize: 13,
    marginRight: 4,
  },
  storageBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  securityBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  securityDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 8,
  },
  securityText: {
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 12,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    height: "100%",
  },
  clearSearchBtn: {
    padding: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  clearSearchText: {
    fontSize: 14,
    fontWeight: "700",
  },
  askBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 14,
  },
  askIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  askIcon: {
    fontSize: 20,
  },
  askTextCol: {
    flex: 1,
  },
  askTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  askSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  askChevron: {
    fontSize: 22,
    fontWeight: "600",
    marginLeft: 6,
  },
  summaryCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 18,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  summaryValue: {
    fontSize: 26,
    fontWeight: "800",
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  multiCurrencyNotice: {
    fontSize: 11,
    marginTop: 2,
  },
  summaryRightCol: {
    alignItems: "flex-end",
  },
  summaryCountLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  summaryCountValue: {
    fontSize: 24,
    fontWeight: "800",
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  unreviewedAlert: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
  },
  unreviewedAlertIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  unreviewedAlertText: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  unreviewedAlertAction: {
    fontSize: 13,
    fontWeight: "700",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "700",
  },
  emptySubtext: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },
  clearFilterBtn: {
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  clearFilterBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  receiptCard: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  receiptTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  receiptMerchant: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
    marginRight: 10,
  },
  receiptAmount: {
    fontSize: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  receiptBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  receiptDate: {
    fontSize: 13,
  },
  chipsRow: {
    flexDirection: "row",
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: "700",
  },
});
