import React from "react";
import { View, Text, StyleSheet, FlatList, SafeAreaView, TouchableOpacity } from "react-native";
import { colors, spacing, borderRadius, typography } from "../theme/tokens";
import { StatusChip } from "../components/StatusChip";

interface PassportMobileItem {
  id: string;
  itemName: string;
  brand: string;
  serialNumber: string;
  expiresAt: string;
  daysRemaining: number;
  status: "active" | "expiring" | "expired";
}

const DEMO_MOBILE_PASSPORTS: PassportMobileItem[] = [
  {
    id: "pass-sony-fx3",
    itemName: "Sony FX3 Cinema Camera",
    brand: "Sony",
    serialNumber: "SN-88210992-FX3",
    expiresAt: "2027-03-01",
    daysRemaining: 180,
    status: "active",
  },
  {
    id: "pass-dell-monitor",
    itemName: 'Dell UltraSharp 27" 4K Monitor',
    brand: "Dell",
    serialNumber: "CN-08K90-74261",
    expiresAt: "2026-09-30",
    daysRemaining: 28,
    status: "expiring",
  },
  {
    id: "pass-mic-system",
    itemName: "Audio-Technica Wireless Mic",
    brand: "Audio-Technica",
    serialNumber: "AT-99410-MIC",
    expiresAt: "2026-09-07",
    daysRemaining: 5,
    status: "expiring",
  },
  {
    id: "pass-jbl-speaker",
    itemName: "JBL EON715 Powered Speaker",
    brand: "JBL Professional",
    serialNumber: "JBL-88019-EON",
    expiresAt: "2026-08-15",
    daysRemaining: -18,
    status: "expired",
  },
];

export function PassportMobileScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Asset Passports</Text>
        <Text style={styles.headerSubtitle}>Immutable warranty proof & claim history</Text>
      </View>

      <FlatList
        data={DEMO_MOBILE_PASSPORTS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.titleBox}>
                <Text style={styles.brandText}>{item.brand}</Text>
                <Text style={styles.itemName}>{item.itemName}</Text>
              </View>
              <StatusChip status={item.status} size="sm" />
            </View>

            <View style={styles.cardMeta}>
              <Text style={styles.metaText}>S/N: {item.serialNumber}</Text>
              <Text style={styles.metaText}>Expires: {item.expiresAt}</Text>
            </View>

            <View
              style={[
                styles.countdownPill,
                item.status === "active"
                  ? styles.countdownActive
                  : item.status === "expiring"
                    ? styles.countdownExpiring
                    : styles.countdownExpired,
              ]}
            >
              <Text
                style={[
                  styles.countdownText,
                  item.status === "active"
                    ? styles.countdownTextActive
                    : item.status === "expiring"
                      ? styles.countdownTextExpiring
                      : styles.countdownTextExpired,
                ]}
              >
                {item.daysRemaining > 0
                  ? `${item.daysRemaining} days of warranty remaining`
                  : `Expired ${Math.abs(item.daysRemaining)} days ago`}
              </Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.brand.surface,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.brand.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.brand.border,
  },
  headerTitle: {
    color: colors.brand.textPrimary,
    fontSize: typography.heading2.fontSize,
    fontWeight: "800",
  },
  headerSubtitle: {
    color: colors.brand.textMuted,
    fontSize: typography.caption.fontSize,
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.brand.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.brand.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  titleBox: {
    flex: 1,
    marginRight: spacing.sm,
  },
  brandText: {
    color: colors.brand.accent,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  itemName: {
    color: colors.brand.textPrimary,
    fontSize: typography.bodyBold.fontSize,
    fontWeight: "700",
    marginTop: 2,
  },
  cardMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metaText: {
    fontSize: 11,
    fontFamily: "monospace",
    color: colors.brand.textMuted,
  },
  countdownPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  countdownActive: {
    backgroundColor: colors.status.success.bg,
    borderColor: colors.status.success.border,
  },
  countdownExpiring: {
    backgroundColor: colors.status.warning.bg,
    borderColor: colors.status.warning.border,
  },
  countdownExpired: {
    backgroundColor: colors.status.neutral.bg,
    borderColor: colors.status.neutral.border,
  },
  countdownText: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  countdownTextActive: {
    color: colors.status.success.text,
  },
  countdownTextExpiring: {
    color: colors.status.warning.text,
  },
  countdownTextExpired: {
    color: colors.status.neutral.text,
  },
});
