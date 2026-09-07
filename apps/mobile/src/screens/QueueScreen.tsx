import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { colors, spacing, borderRadius, typography } from "../theme/tokens";
import { StatusChip } from "../components/StatusChip";
import { offlineQueue, type QueueItem } from "../queue/offline-queue";
import { syncManager } from "../sync/sync-manager";

interface QueueScreenProps {
  onBackToCamera: () => void;
}

export function QueueScreen({ onBackToCamera }: QueueScreenProps) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [isOnline, setIsOnline] = useState(syncManager.getOnlineStatus());
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const unsubscribe = offlineQueue.subscribe((queueItems) => {
      setItems(queueItems);
    });
    return unsubscribe;
  }, []);

  const toggleNetwork = () => {
    const nextState = !isOnline;
    setIsOnline(nextState);
    syncManager.setOnline(nextState);
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    await syncManager.triggerSync();
    setIsSyncing(false);
  };

  const handleRetryFailed = () => {
    offlineQueue.retryFailed();
    if (isOnline) {
      handleManualSync();
    }
  };

  const pendingItems = items.filter((i) => i.status !== "synced");
  const failedItems = items.filter((i) => i.status === "failed");

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBackToCamera}
          accessibilityLabel="Back to Camera"
        >
          <Text style={styles.backButtonText}>← Camera</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>Capture & Sync Queue</Text>
          <Text style={styles.headerSubtitle}>
            {pendingItems.length} pending • {items.length - pendingItems.length} synced
          </Text>
        </View>

        {/* Network Toggle Button (Airplane / Online simulation) */}
        <TouchableOpacity
          style={[styles.networkBadge, isOnline ? styles.networkOnline : styles.networkOffline]}
          onPress={toggleNetwork}
          accessibilityLabel="Toggle Network Mode"
        >
          <Text style={styles.networkText}>{isOnline ? "🌐 ONLINE" : "✈ OFFLINE"}</Text>
        </TouchableOpacity>
      </View>

      {/* Offline Alert Banner */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            AIRPLANE MODE ACTIVE: Captures stored safely in local SQLite queue. Will sync
            automatically when online.
          </Text>
        </View>
      )}

      {/* Queue Items List */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>Queue is Empty</Text>
            <Text style={styles.emptySubtitle}>
              Capture receipts in multi-shot camera mode to store them for background upload.
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <View>
                <Text style={styles.itemIndex}>#{items.length - index}</Text>
                <Text style={styles.itemHash} numberOfLines={1}>
                  {item.sha256.substring(0, 18)}...
                </Text>
              </View>
              <StatusChip status={item.status} size="sm" />
            </View>

            <View style={styles.itemMeta}>
              <Text style={styles.metaText}>
                Captured: {new Date(item.captured_at).toLocaleTimeString()}
              </Text>
              {item.server_receipt_id && (
                <Text style={styles.metaServerId}>Server ID: {item.server_receipt_id}</Text>
              )}
              {item.error_message && (
                <Text style={styles.errorText}>
                  Error: {item.error_message} (Retries: {item.retry_count})
                </Text>
              )}
            </View>
          </View>
        )}
      />

      {/* Bottom Sticky Action Bar */}
      <View style={styles.bottomBar}>
        {failedItems.length > 0 && (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRetryFailed}
            accessibilityLabel="Retry Failed Uploads"
          >
            <Text style={styles.retryButtonText}>Retry {failedItems.length} Failed</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.syncButton,
            (!isOnline || pendingItems.length === 0 || isSyncing) && styles.syncButtonDisabled,
          ]}
          disabled={!isOnline || pendingItems.length === 0 || isSyncing}
          onPress={handleManualSync}
          accessibilityLabel="Sync All Pending Receipts"
        >
          {isSyncing ? (
            <ActivityIndicator color={colors.brand.primaryFg} />
          ) : (
            <Text style={styles.syncButtonText}>
              {pendingItems.length === 0
                ? "All Receipts Synced"
                : `Sync Now (${pendingItems.length})`}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.brand.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.brand.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.brand.border,
  },
  backButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  backButtonText: {
    color: colors.brand.primary,
    fontSize: typography.bodyBold.fontSize,
    fontWeight: "700",
  },
  headerTitleBox: {
    alignItems: "center",
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
  networkBadge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  networkOnline: {
    backgroundColor: colors.status.success.bg,
    borderColor: colors.status.success.border,
  },
  networkOffline: {
    backgroundColor: colors.status.warning.bg,
    borderColor: colors.status.warning.border,
  },
  networkText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.brand.textPrimary,
  },
  offlineBanner: {
    backgroundColor: colors.status.warning.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.status.warning.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  offlineBannerText: {
    color: colors.status.warning.text,
    fontSize: typography.caption.fontSize,
    fontWeight: "600",
    textAlign: "center",
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  emptyContainer: {
    padding: spacing.xxxl,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xxl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.heading2.fontSize,
    fontWeight: "700",
    color: colors.brand.textPrimary,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: typography.caption.fontSize,
    color: colors.brand.textMuted,
    textAlign: "center",
    maxWidth: 280,
  },
  itemCard: {
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
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  itemIndex: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.brand.accent,
  },
  itemHash: {
    fontSize: typography.mono.fontSize,
    fontFamily: "monospace",
    color: colors.brand.textPrimary,
    fontWeight: "600",
  },
  itemMeta: {
    marginTop: spacing.xs,
    gap: 2,
  },
  metaText: {
    fontSize: 11,
    color: colors.brand.textMuted,
  },
  metaServerId: {
    fontSize: 11,
    fontFamily: "monospace",
    color: colors.status.success.text,
    fontWeight: "600",
  },
  errorText: {
    fontSize: 11,
    color: colors.status.danger.text,
    fontWeight: "600",
  },
  bottomBar: {
    padding: spacing.lg,
    backgroundColor: colors.brand.card,
    borderTopWidth: 1,
    borderTopColor: colors.brand.border,
    gap: spacing.sm,
  },
  retryButton: {
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    backgroundColor: colors.status.danger.bg,
    borderWidth: 1,
    borderColor: colors.status.danger.border,
    alignItems: "center",
  },
  retryButtonText: {
    color: colors.status.danger.text,
    fontWeight: "700",
    fontSize: typography.caption.fontSize,
  },
  syncButton: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.brand.primary,
    alignItems: "center",
    justifyContent: "center",
    height: spacing.thumb,
  },
  syncButtonDisabled: {
    opacity: 0.5,
  },
  syncButtonText: {
    color: colors.brand.primaryFg,
    fontSize: typography.bodyBold.fontSize,
    fontWeight: "800",
  },
});
