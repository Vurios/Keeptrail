import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Animated,
  ScrollView,
} from "react-native";
import { colors, spacing, borderRadius, typography } from "../theme/tokens";
import { offlineQueue, type QueueItem } from "../queue/offline-queue";
import { syncManager } from "../sync/sync-manager";

interface CameraScreenProps {
  onNavigateToQueue: () => void;
  activeActivityTitle?: string;
}

export function CameraScreen({
  onNavigateToQueue,
  activeActivityTitle = "Leadership Summit 2026",
}: CameraScreenProps) {
  const [captures, setCaptures] = useState<QueueItem[]>([]);
  const [flashMode, setFlashMode] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [flashAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    const unsubscribe = offlineQueue.subscribe((items) => {
      setCaptures(items);
    });
    return unsubscribe;
  }, []);

  const triggerShutterFlash = () => {
    flashAnim.setValue(1);
    Animated.timing(flashAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  };

  const handleCapture = () => {
    triggerShutterFlash();

    const timestamp = Date.now();
    const mockHash = `sha256-${timestamp}-${Math.random().toString(36).substring(2, 9)}`;
    const mockUri = `file:///data/user/0/ph.katibay/receipts/cap_${timestamp}.jpg`;

    offlineQueue.enqueueCapture("act-summit-2026", mockUri, mockHash);

    // If online, trigger background sync
    if (syncManager.getOnlineStatus()) {
      syncManager.triggerSync();
    }
  };

  const pendingCount = captures.filter((c) => c.status !== "synced").length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Bar: Activity context & Mode controls */}
      <View style={styles.topBar}>
        <View style={styles.activityBadge}>
          <Text style={styles.activityLabel}>ACTIVITY</Text>
          <Text style={styles.activityTitle} numberOfLines={1}>
            {activeActivityTitle}
          </Text>
        </View>

        <View style={styles.topActions}>
          <TouchableOpacity
            style={[styles.iconButton, flashMode && styles.iconButtonActive]}
            onPress={() => setFlashMode(!flashMode)}
            accessibilityLabel="Toggle Flash"
          >
            <Text style={[styles.iconText, flashMode && styles.iconTextActive]}>
              {flashMode ? "⚡ ON" : "⚡ OFF"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconButton, showGrid && styles.iconButtonActive]}
            onPress={() => setShowGrid(!showGrid)}
            accessibilityLabel="Toggle Document Guide Grid"
          >
            <Text style={[styles.iconText, showGrid && styles.iconTextActive]}>⊞ GRID</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Center Viewfinder: Document Guide Frame with Corner Targets */}
      <View style={styles.viewfinderContainer}>
        {/* Shutter flash overlay */}
        <Animated.View pointerEvents="none" style={[styles.shutterFlash, { opacity: flashAnim }]} />

        {/* Viewfinder background preview representation */}
        <View style={styles.viewfinderBackground}>
          {/* Document Edge Detection Guide Box */}
          <View style={styles.documentGuide}>
            {/* 4 Corner Crop Guides */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            {showGrid && <View style={styles.gridCrosshair} />}

            <View style={styles.guideBadge}>
              <Text style={styles.guideText}>ALIGN RECEIPT WITHIN FRAME</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Captured Thumbnails Mini Strip */}
      {captures.length > 0 && (
        <View style={styles.thumbnailStrip}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbnailScroll}
          >
            {captures.slice(0, 8).map((cap, idx) => (
              <View key={cap.id} style={styles.thumbWrapper}>
                <View style={styles.thumbBox}>
                  <Text style={styles.thumbIndex}>#{captures.length - idx}</Text>
                  <Text style={styles.thumbStatus}>{cap.status === "synced" ? "✓" : "⏱"}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Bottom Control Deck — Pure Thumb Zone */}
      <View style={styles.bottomDeck}>
        {/* Left Slot: Queue Counter Thumb Pill */}
        <TouchableOpacity
          style={styles.queuePill}
          onPress={onNavigateToQueue}
          accessibilityLabel="Open Sync Queue"
        >
          <View style={styles.queueDot} />
          <View>
            <Text style={styles.queueCountText}>{captures.length} Captured</Text>
            <Text style={styles.queueSubText}>
              {pendingCount > 0 ? `${pendingCount} pending sync` : "All synced"}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Center: Giant Tactile Shutter Button */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleCapture}
          style={styles.shutterOuter}
          accessibilityLabel="Capture Receipt"
        >
          <View style={styles.shutterInner} />
        </TouchableOpacity>

        {/* Right Slot: Multi-Shot Batch Indicator */}
        <View style={styles.batchPill}>
          <Text style={styles.batchLabel}>MULTI-SHOT</Text>
          <Text style={styles.batchValue}>RAPID</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: "rgba(0,0,0,0.75)",
    zIndex: 10,
  },
  activityBadge: {
    flex: 1,
    marginRight: spacing.md,
  },
  activityLabel: {
    color: colors.brand.accent,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  activityTitle: {
    color: "#ffffff",
    fontSize: typography.bodyBold.fontSize,
    fontWeight: "700",
  },
  topActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  iconButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  iconButtonActive: {
    backgroundColor: colors.brand.accent,
  },
  iconText: {
    color: "#ffffff",
    fontSize: typography.caption.fontSize - 1,
    fontWeight: "700",
  },
  iconTextActive: {
    color: colors.brand.accentFg,
  },
  viewfinderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  shutterFlash: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#ffffff",
    zIndex: 20,
  },

  viewfinderBackground: {
    width: "100%",
    height: "100%",
    backgroundColor: "#111a16",
    justifyContent: "center",
    alignItems: "center",
  },
  documentGuide: {
    width: "82%",
    height: "78%",
    borderWidth: 1,
    borderColor: "rgba(201, 151, 59, 0.4)",
    borderRadius: borderRadius.md,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  corner: {
    position: "absolute",
    width: 24,
    height: 24,
    borderColor: colors.brand.accent,
  },
  cornerTL: {
    top: -1,
    left: -1,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  cornerTR: {
    top: -1,
    right: -1,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  cornerBL: {
    bottom: -1,
    left: -1,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  cornerBR: {
    bottom: -1,
    right: -1,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  gridCrosshair: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
  },

  guideBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: borderRadius.full,
  },
  guideText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  thumbnailStrip: {
    height: 60,
    backgroundColor: "rgba(0,0,0,0.8)",
    paddingVertical: spacing.xs,
  },
  thumbnailScroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  thumbWrapper: {
    width: 44,
    height: 48,
    borderRadius: borderRadius.sm,
    backgroundColor: "#22312a",
    borderWidth: 1,
    borderColor: colors.brand.borderStrong,
    overflow: "hidden",
  },
  thumbBox: {
    flex: 1,
    justifyContent: "space-between",
    padding: 3,
  },
  thumbIndex: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  thumbStatus: {
    color: colors.status.success.fill,
    fontSize: 10,
    fontWeight: "800",
    alignSelf: "flex-end",
  },
  bottomDeck: {
    height: 120,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    backgroundColor: "rgba(0,0,0,0.9)",
  },
  queuePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    maxWidth: 130,
  },
  queueDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.status.success.fill,
  },
  queueCountText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  queueSubText: {
    color: "#9ca3af",
    fontSize: 9,
  },
  shutterOuter: {
    width: spacing.shutter,
    height: spacing.shutter,
    borderRadius: spacing.shutter / 2,
    borderWidth: 4,
    borderColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  shutterInner: {
    width: spacing.shutter - 16,
    height: spacing.shutter - 16,
    borderRadius: (spacing.shutter - 16) / 2,
    backgroundColor: colors.brand.accent,
  },
  batchPill: {
    alignItems: "flex-end",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  batchLabel: {
    color: "#9ca3af",
    fontSize: 9,
    fontWeight: "700",
  },
  batchValue: {
    color: colors.brand.accent,
    fontSize: 11,
    fontWeight: "800",
  },
});
