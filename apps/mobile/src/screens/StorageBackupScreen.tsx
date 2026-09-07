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
  Alert,
} from "react-native";
import { colors, spacing, borderRadius, typography } from "../theme/tokens";
import { useLocalVault } from "../vault-context";

interface StorageBackupScreenProps {
  onBack: () => void;
}

export const StorageBackupScreen: React.FC<StorageBackupScreenProps> = ({
  onBack,
}) => {
  const {
    stats,
    exportEncryptedBackup,
    restoreFromEncryptedBackup,
    emptyTrash,
  } = useLocalVault();

  // Export modal state
  const [isExporting, setIsExporting] = useState(false);
  const [exportPassword, setExportPassword] = useState("");
  const [lastExportedBytes, setLastExportedBytes] = useState<Uint8Array | null>(null);

  // Restore modal state
  const [isRestoring, setIsRestoring] = useState(false);
  const [restorePassword, setRestorePassword] = useState("");

  const handleRunExport = () => {
    if (!exportPassword || exportPassword.length < 4) {
      Alert.alert("Password Required", "Please enter a backup password of at least 4 characters.");
      return;
    }

    try {
      const bytes = exportEncryptedBackup(exportPassword);
      setLastExportedBytes(bytes);
      setIsExporting(false);
      setExportPassword("");
      Alert.alert(
        "Backup File Saved",
        `Created encrypted .keeptrail backup (${(bytes.length / 1024).toFixed(1)} KB).\n\nKeep a copy away from this phone (e.g. computer or USB drive) to protect against device loss.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert("Export Error", msg);
    }
  };

  const handleRunRestore = () => {
    if (!lastExportedBytes) {
      Alert.alert(
        "No Local Archive Selected",
        "Please generate a backup first or select an existing .keeptrail file."
      );
      return;
    }

    if (!restorePassword) {
      Alert.alert("Password Required", "Enter the archive password to decrypt.");
      return;
    }

    try {
      const result = restoreFromEncryptedBackup(lastExportedBytes, restorePassword);
      setIsRestoring(false);
      setRestorePassword("");
      Alert.alert(
        "Restore Complete",
        `Successfully restored and verified ${result.receiptCount} receipt(s) and ${result.attachmentCount} attachment(s). All SHA-256 integrity checks passed.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert("Restoration Failed", msg);
    }
  };

  const handleEmptyTrash = () => {
    if (stats.trashedCount === 0) {
      Alert.alert("Trash Empty", "There are no receipts in Trash.");
      return;
    }

    Alert.alert(
      "Empty Trash",
      `Are you sure you want to permanently delete ${stats.trashedCount} trashed receipt(s)? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Empty Trash",
          style: "destructive",
          onPress: () => {
            const count = emptyTrash();
            Alert.alert("Trash Cleared", `Permanently removed ${count} receipt(s).`);
          },
        },
      ]
    );
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backBtnText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Storage & Backup</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Honest Local Warning Notice */}
          <View style={styles.noticeCard}>
            <Text style={styles.noticeIcon}>🛡️</Text>
            <View style={styles.noticeTextCol}>
              <Text style={styles.noticeTitle}>Saved on this phone</Text>
              <Text style={styles.noticeDesc}>
                Your receipts are stored locally in a private vault on this device.
                Export an encrypted backup to protect against phone loss, damage,
                or app uninstall.
              </Text>
            </View>
          </View>

          {/* Measured Storage Usage */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Measured Storage Breakdown</Text>
            <View style={styles.statsCard}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Active Receipts</Text>
                <Text style={styles.statValue}>{stats.receiptCount}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Original Evidence Files</Text>
                <Text style={styles.statValue}>
                  {stats.attachmentCount} ({formatBytes(stats.totalAttachmentBytes)})
                </Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Local Database (Estimated)</Text>
                <Text style={styles.statValue}>
                  {formatBytes(stats.databaseEstimatedBytes)}
                </Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>In Trash (Pending Purge)</Text>
                <Text style={styles.statValue}>{stats.trashedCount}</Text>
              </View>
              <View style={[styles.statRow, styles.statRowLast]}>
                <Text style={styles.statLabel}>Changes Since Last Backup</Text>
                <Text
                  style={[
                    styles.statValue,
                    stats.recordsModifiedSinceLastBackup > 0
                      ? styles.statWarn
                      : styles.statOk,
                  ]}
                >
                  {stats.recordsModifiedSinceLastBackup > 0
                    ? `${stats.recordsModifiedSinceLastBackup} unsaved change(s)`
                    : "Up to date"}
                </Text>
              </View>
            </View>
          </View>

          {/* Backup & Restore Controls */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Encrypted Data Portability</Text>
            <View style={styles.actionsCard}>
              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={() => setIsExporting(true)}
              >
                <Text style={styles.actionBtnIcon}>📦</Text>
                <View style={styles.actionBtnCol}>
                  <Text style={styles.primaryActionTitle}>Back Up Receipts</Text>
                  <Text style={styles.actionSubtitle}>
                    Export password-protected .keeptrail archive
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={styles.divider} />

              <TouchableOpacity
                style={styles.secondaryActionBtn}
                onPress={() => setIsRestoring(true)}
              >
                <Text style={styles.actionBtnIcon}>📥</Text>
                <View style={styles.actionBtnCol}>
                  <Text style={styles.secondaryActionTitle}>Restore Backup</Text>
                  <Text style={styles.actionSubtitle}>
                    Import and verify an existing .keeptrail file
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Trash Management */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>Trash & Cleanup</Text>
            <View style={styles.trashCard}>
              <View style={styles.trashInfoRow}>
                <Text style={styles.trashText}>
                  {stats.trashedCount} item(s) currently in Trash
                </Text>
                <TouchableOpacity
                  style={styles.emptyTrashBtn}
                  onPress={handleEmptyTrash}
                >
                  <Text style={styles.emptyTrashBtnText}>Empty Trash</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* About Pilot Information */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>About This Free Pilot</Text>
            <View style={styles.aboutCard}>
              <Text style={styles.aboutVersion}>Keeptrail v1.0.0-pilot (Free Local)</Text>
              <Text style={styles.aboutText}>
                • No accounts or registration required{"\n"}
                • Zero cloud inference or remote backend dependencies{"\n"}
                • Pretrained on-device models & deterministic math tools{"\n"}
                • No subscriptions, paywalls, or in-app purchases{"\n"}
                • Your data belongs to you on your device
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Export Password Modal */}
        <Modal
          visible={isExporting}
          animationType="fade"
          transparent
          onRequestClose={() => setIsExporting(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.dialogCard}>
              <Text style={styles.dialogTitle}>Set Backup Password</Text>
              <Text style={styles.dialogDesc}>
                Choose a strong password to encrypt your receipts. This password
                will be required to restore your vault. We cannot reset it.
              </Text>

              <TextInput
                style={styles.dialogInput}
                placeholder="Enter backup password..."
                secureTextEntry
                value={exportPassword}
                onChangeText={setExportPassword}
              />

              <View style={styles.dialogBtnRow}>
                <TouchableOpacity
                  style={styles.dialogCancel}
                  onPress={() => setIsExporting(false)}
                >
                  <Text style={styles.dialogCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.dialogConfirm}
                  onPress={handleRunExport}
                >
                  <Text style={styles.dialogConfirmText}>Export</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Restore Password Modal */}
        <Modal
          visible={isRestoring}
          animationType="fade"
          transparent
          onRequestClose={() => setIsRestoring(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.dialogCard}>
              <Text style={styles.dialogTitle}>Restore Backup Archive</Text>
              <Text style={styles.dialogDesc}>
                Enter the password used when creating this .keeptrail backup to
                decrypt and verify all files.
              </Text>

              <TextInput
                style={styles.dialogInput}
                placeholder="Enter archive password..."
                secureTextEntry
                value={restorePassword}
                onChangeText={setRestorePassword}
              />

              <View style={styles.dialogBtnRow}>
                <TouchableOpacity
                  style={styles.dialogCancel}
                  onPress={() => setIsRestoring(false)}
                >
                  <Text style={styles.dialogCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.dialogConfirm}
                  onPress={handleRunRestore}
                >
                  <Text style={styles.dialogConfirmText}>Restore</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
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
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.brand.border,
  },
  backBtn: {
    paddingVertical: 4,
  },
  backBtnText: {
    ...typography.bodyBold,
    color: colors.brand.primary,
  },
  headerTitle: {
    ...typography.sectionTitle,
    color: colors.brand.textPrimary,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl * 2,
  },
  noticeCard: {
    flexDirection: "row",
    backgroundColor: colors.brand.surfaceAlt,
    borderRadius: borderRadius.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.status.success.border,
    marginBottom: spacing.lg,
  },
  noticeIcon: {
    fontSize: 24,
    marginRight: spacing.md,
    marginTop: 2,
  },
  noticeTextCol: {
    flex: 1,
  },
  noticeTitle: {
    ...typography.bodyBold,
    color: colors.brand.primary,
  },
  noticeDesc: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.brand.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  statsCard: {
    backgroundColor: colors.brand.surface,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    borderColor: colors.brand.border,
    paddingHorizontal: spacing.md,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.brand.border,
  },
  statRowLast: {
    borderBottomWidth: 0,
  },
  statLabel: {
    ...typography.supporting,
    color: colors.brand.textSecondary,
  },
  statValue: {
    ...typography.supporting,
    fontWeight: "600",
    color: colors.brand.textPrimary,
  },
  statWarn: {
    color: colors.status.warning.text,
  },
  statOk: {
    color: colors.brand.primary,
  },
  actionsCard: {
    backgroundColor: colors.brand.surface,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    borderColor: colors.brand.border,
    overflow: "hidden",
  },
  primaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
  },
  secondaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
  },
  actionBtnIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  actionBtnCol: {
    flex: 1,
  },
  primaryActionTitle: {
    ...typography.bodyBold,
    color: colors.brand.primary,
  },
  secondaryActionTitle: {
    ...typography.bodyBold,
    color: colors.brand.textPrimary,
  },
  actionSubtitle: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.brand.border,
  },
  trashCard: {
    backgroundColor: colors.brand.surface,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    borderColor: colors.brand.border,
    padding: spacing.md,
  },
  trashInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  trashText: {
    ...typography.supporting,
    color: colors.brand.textSecondary,
  },
  emptyTrashBtn: {
    backgroundColor: "#FEECE9",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: borderRadius.md,
  },
  emptyTrashBtnText: {
    ...typography.caption,
    fontWeight: "700",
    color: "#B42318",
  },
  aboutCard: {
    backgroundColor: colors.brand.surface,
    borderRadius: borderRadius.card,
    borderWidth: 1,
    borderColor: colors.brand.border,
    padding: spacing.md,
  },
  aboutVersion: {
    ...typography.bodyBold,
    color: colors.brand.primary,
    marginBottom: 6,
  },
  aboutText: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  dialogCard: {
    backgroundColor: colors.brand.surface,
    borderRadius: borderRadius.card,
    padding: spacing.lg,
    width: "100%",
    maxWidth: 360,
  },
  dialogTitle: {
    ...typography.sectionTitle,
    color: colors.brand.textPrimary,
    marginBottom: 6,
  },
  dialogDesc: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  dialogInput: {
    backgroundColor: colors.brand.background,
    borderWidth: 1,
    borderColor: colors.brand.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 48,
    ...typography.body,
    marginBottom: spacing.lg,
  },
  dialogBtnRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  dialogCancel: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: spacing.sm,
  },
  dialogCancelText: {
    ...typography.body,
    color: colors.brand.textSecondary,
  },
  dialogConfirm: {
    backgroundColor: colors.brand.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: borderRadius.md,
  },
  dialogConfirmText: {
    ...typography.bodyBold,
    color: colors.brand.primaryFg,
  },
});
