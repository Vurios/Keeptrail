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
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { useToast } from "../components/ToastContext";
import { useLocalVault } from "../vault-context";
import { haptics } from "../utils/haptics";

interface StorageBackupScreenProps {
  onBack: () => void;
}

export const StorageBackupScreen: React.FC<StorageBackupScreenProps> = ({ onBack }) => {
  const { colors, spacing, borderRadius, typography, isDark } = useTheme();
  const { stats, exportEncryptedBackup, restoreFromEncryptedBackup, emptyTrash } = useLocalVault();
  const { showToast } = useToast();

  // Export modal state
  const [isExporting, setIsExporting] = useState(false);
  const [exportPassword, setExportPassword] = useState("");
  const [exportError, setExportError] = useState<string | null>(null);
  const [lastExportedBytes, setLastExportedBytes] = useState<Uint8Array | null>(null);
  const [isExportProcessing, setIsExportProcessing] = useState(false);

  // Restore modal state
  const [isRestoring, setIsRestoring] = useState(false);
  const [restorePassword, setRestorePassword] = useState("");
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [isRestoreProcessing, setIsRestoreProcessing] = useState(false);

  const handleExportPasswordChange = (text: string) => {
    setExportPassword(text);
    if (text.length >= 4) {
      setExportError(null);
    }
  };

  const handleRestorePasswordChange = (text: string) => {
    setRestorePassword(text);
    if (text.trim()) {
      setRestoreError(null);
    }
  };

  const handleRunExport = () => {
    if (isExportProcessing) return;

    if (!exportPassword || exportPassword.length < 4) {
      haptics.error();
      setExportError("Password must be at least 4 characters long");
      return;
    }

    setIsExportProcessing(true);
    // Allow UI to render loading state
    setTimeout(() => {
      try {
        const bytes = exportEncryptedBackup(exportPassword);
        setLastExportedBytes(bytes);
        setIsExporting(false);
        setExportPassword("");
        setExportError(null);
        haptics.success();
        showToast({
          type: "success",
          title: "Encrypted Backup Created",
          message: `Saved .keeptrail container (${(bytes.length / 1024).toFixed(
            1,
          )} KB) with AES-256-GCM. Keep a copy away from this phone.`,
          duration: 4000,
        });
      } catch (err: unknown) {
        haptics.error();
        const msg = err instanceof Error ? err.message : String(err);
        showToast({
          type: "error",
          title: "Export Failed",
          message: msg,
        });
      } finally {
        setIsExportProcessing(false);
      }
    }, 50);
  };

  const handleRunRestore = () => {
    if (isRestoreProcessing) return;

    if (!lastExportedBytes) {
      haptics.error();
      showToast({
        type: "warning",
        title: "No Archive Selected",
        message: "Generate a backup archive first or select an existing .keeptrail file.",
      });
      return;
    }

    if (!restorePassword) {
      haptics.error();
      setRestoreError("Enter the archive password to decrypt");
      return;
    }

    setIsRestoreProcessing(true);
    setTimeout(() => {
      try {
        const result = restoreFromEncryptedBackup(lastExportedBytes, restorePassword);
        setIsRestoring(false);
        setRestorePassword("");
        setRestoreError(null);
        haptics.success();
        showToast({
          type: "success",
          title: "Restore Complete",
          message: `Verified and restored ${result.receiptCount} receipt(s) and ${result.attachmentCount} attachment(s). All SHA-256 checks passed.`,
          duration: 4000,
        });
      } catch (err: unknown) {
        haptics.error();
        const msg = err instanceof Error ? err.message : String(err);
        setRestoreError("Incorrect password or corrupted archive");
        showToast({
          type: "error",
          title: "Restoration Failed",
          message: msg,
        });
      } finally {
        setIsRestoreProcessing(false);
      }
    }, 50);
  };

  const handleEmptyTrash = () => {
    if (stats.trashedCount === 0) {
      showToast({
        type: "info",
        title: "Trash is Empty",
        message: "There are no receipts in Trash to delete.",
      });
      return;
    }

    // Keep native confirmation dialog for destructive action
    Alert.alert(
      "Empty Trash Permanently",
      `Are you sure you want to permanently delete ${stats.trashedCount} trashed receipt(s)? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Empty Trash",
          style: "destructive",
          onPress: () => {
            const count = emptyTrash();
            haptics.warning();
            showToast({
              type: "success",
              title: "Trash Cleared",
              message: `Permanently removed ${count} receipt(s) from storage.`,
            });
          },
        },
      ],
    );
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.container}>
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => {
              haptics.tap();
              onBack();
            }}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back to Home"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.backBtnText, { color: colors.primary }]}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Storage & Vault</Text>
          <View style={{ width: 54 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Local Security Assurance Notice */}
          <View
            style={[
              styles.noticeCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={[styles.noticeIconCircle, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={styles.noticeIcon}>🛡️</Text>
            </View>
            <View style={styles.noticeTextCol}>
              <Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>
                Saved on this phone
              </Text>
              <Text style={[styles.noticeDesc, { color: colors.textSecondary }]}>
                Your receipts are stored locally in a private vault on this device. Export an
                encrypted backup to protect against phone loss, damage, or app uninstall.
              </Text>
            </View>
          </View>

          {/* Measured Storage Usage */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textPrimary }]}>
              Measured Storage Breakdown
            </Text>
            <View
              style={[
                styles.statsCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={[styles.statRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Active Receipts
                </Text>
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                  {stats.receiptCount}
                </Text>
              </View>
              <View style={[styles.statRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Original Evidence Files
                </Text>
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                  {stats.attachmentCount} ({formatBytes(stats.totalAttachmentBytes)})
                </Text>
              </View>
              <View style={[styles.statRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Local Database (Estimated)
                </Text>
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                  {formatBytes(stats.databaseEstimatedBytes)}
                </Text>
              </View>
              <View style={[styles.statRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  In Trash (Pending Purge)
                </Text>
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                  {stats.trashedCount}
                </Text>
              </View>
              <View style={[styles.statRow, styles.statRowLast]}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Changes Since Last Backup
                </Text>
                <Text
                  style={[
                    styles.statValue,
                    stats.recordsModifiedSinceLastBackup > 0
                      ? { color: colors.status.warning.text, fontWeight: "700" }
                      : { color: colors.status.success.text, fontWeight: "700" },
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
            <Text style={[styles.sectionHeader, { color: colors.textPrimary }]}>
              Encrypted Data Portability
            </Text>
            <View
              style={[
                styles.actionsCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={() => {
                  haptics.tap();
                  setIsExporting(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Back up receipts to encrypted file"
              >
                <Text style={styles.actionBtnIcon}>📦</Text>
                <View style={styles.actionBtnCol}>
                  <Text style={[styles.primaryActionTitle, { color: colors.primary }]}>
                    Export Encrypted Backup
                  </Text>
                  <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>
                    Create password-protected .keeptrail archive (AES-256-GCM)
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <TouchableOpacity
                style={styles.secondaryActionBtn}
                onPress={() => {
                  haptics.tap();
                  setIsRestoring(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Restore backup from encrypted file"
              >
                <Text style={styles.actionBtnIcon}>📥</Text>
                <View style={styles.actionBtnCol}>
                  <Text style={[styles.secondaryActionTitle, { color: colors.textPrimary }]}>
                    Restore From Backup
                  </Text>
                  <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>
                    Import and cryptographically verify a .keeptrail file
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Trash Management */}
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: colors.textPrimary }]}>
              Trash & Storage Cleanup
            </Text>
            <View
              style={[
                styles.trashCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.trashInfoRow}>
                <Text style={[styles.trashText, { color: colors.textPrimary }]}>
                  {stats.trashedCount} item(s) in Trash
                </Text>
                <TouchableOpacity
                  style={[
                    styles.emptyTrashBtn,
                    {
                      backgroundColor: colors.status.danger.bg,
                      borderColor: colors.status.danger.border,
                      opacity: stats.trashedCount === 0 ? 0.5 : 1,
                    },
                  ]}
                  onPress={handleEmptyTrash}
                  accessibilityRole="button"
                  accessibilityLabel="Empty trash permanently"
                >
                  <Text style={[styles.emptyTrashText, { color: colors.status.danger.text }]}>
                    Empty Trash
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.trashWarning, { color: colors.textSecondary }]}>
                Receipts in Trash remain recoverable until you empty the trash or permanently delete
                them.
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Export Backup Modal */}
        <Modal
          visible={isExporting}
          animationType="slide"
          presentationStyle="formSheet"
          onRequestClose={() => setIsExporting(false)}
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
                    setIsExporting(false);
                    setExportError(null);
                  }}
                  style={styles.modalHeaderBtn}
                  accessibilityRole="button"
                >
                  <Text style={[styles.modalCancel, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  Export Backup
                </Text>
                <TouchableOpacity
                  onPress={handleRunExport}
                  style={[
                    styles.modalDoneBtn,
                    {
                      backgroundColor: colors.primary,
                      opacity: isExportProcessing ? 0.6 : 1,
                    },
                  ]}
                  disabled={isExportProcessing}
                  accessibilityRole="button"
                >
                  {isExportProcessing ? (
                    <ActivityIndicator size="small" color={colors.primaryFg} />
                  ) : (
                    <Text style={[styles.modalDone, { color: colors.primaryFg }]}>Export</Text>
                  )}
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalForm}
                contentContainerStyle={{ padding: 16 }}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  Set Archive Password (AES-256-GCM) *
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colors.surface,
                      borderColor: exportError ? colors.status.danger.border : colors.controlBorder,
                      color: colors.textPrimary,
                    },
                  ]}
                  placeholder="Minimum 4 characters"
                  placeholderTextColor={colors.textMuted}
                  value={exportPassword}
                  onChangeText={handleExportPasswordChange}
                  secureTextEntry
                />
                {exportError ? (
                  <Text style={[styles.inlineError, { color: colors.status.danger.text }]}>
                    {exportError}
                  </Text>
                ) : (
                  <Text style={[styles.inputHelp, { color: colors.textMuted }]}>
                    Your password derives the AES key using PBKDF2 (100,000 rounds). Store it
                    safely.
                  </Text>
                )}

                <View
                  style={[
                    styles.backupTipCard,
                    {
                      backgroundColor: colors.surfaceAlt,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.backupTipTitle, { color: colors.primary }]}>
                    🔒 No Account Recovery Notice
                  </Text>
                  <Text style={[styles.backupTipDesc, { color: colors.textSecondary }]}>
                    Because Keeptrail operates 100% locally on your phone without cloud accounts,
                    there is no password reset. If you lose this password, this backup file cannot
                    be restored.
                  </Text>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>

        {/* Restore Backup Modal */}
        <Modal
          visible={isRestoring}
          animationType="slide"
          presentationStyle="formSheet"
          onRequestClose={() => setIsRestoring(false)}
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
                    setIsRestoring(false);
                    setRestoreError(null);
                  }}
                  style={styles.modalHeaderBtn}
                  accessibilityRole="button"
                >
                  <Text style={[styles.modalCancel, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  Restore Vault
                </Text>
                <TouchableOpacity
                  onPress={handleRunRestore}
                  style={[
                    styles.modalDoneBtn,
                    {
                      backgroundColor: colors.primary,
                      opacity: isRestoreProcessing ? 0.6 : 1,
                    },
                  ]}
                  disabled={isRestoreProcessing}
                  accessibilityRole="button"
                >
                  {isRestoreProcessing ? (
                    <ActivityIndicator size="small" color={colors.primaryFg} />
                  ) : (
                    <Text style={[styles.modalDone, { color: colors.primaryFg }]}>Restore</Text>
                  )}
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalForm}
                contentContainerStyle={{ padding: 16 }}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  Archive Decryption Password *
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colors.surface,
                      borderColor: restoreError
                        ? colors.status.danger.border
                        : colors.controlBorder,
                      color: colors.textPrimary,
                    },
                  ]}
                  placeholder="Enter archive password"
                  placeholderTextColor={colors.textMuted}
                  value={restorePassword}
                  onChangeText={handleRestorePasswordChange}
                  secureTextEntry
                />
                {restoreError && (
                  <Text style={[styles.inlineError, { color: colors.status.danger.text }]}>
                    {restoreError}
                  </Text>
                )}

                <View
                  style={[
                    styles.backupTipCard,
                    {
                      backgroundColor: colors.surfaceAlt,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.backupTipTitle, { color: colors.primary }]}>
                    ℹ️ Verification Guarantee
                  </Text>
                  <Text style={[styles.backupTipDesc, { color: colors.textSecondary }]}>
                    During restoration, Keeptrail recalculates the SHA-256 hash of every receipt
                    attachment to verify that zero data corruption occurred during transfer.
                  </Text>
                </View>
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
    height: 56,
    borderBottomWidth: 1,
  },
  backBtn: {
    minWidth: 54,
    minHeight: 44,
    justifyContent: "center",
  },
  backBtnText: {
    fontSize: 16,
    fontWeight: "700",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  noticeCard: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
    alignItems: "center",
  },
  noticeIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  noticeIcon: {
    fontSize: 22,
  },
  noticeTextCol: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  noticeDesc: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 8,
  },
  statsCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
  },
  statRowLast: {
    borderBottomWidth: 0,
  },
  statLabel: {
    fontSize: 13,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  actionsCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  primaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    minHeight: 64,
  },
  secondaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    minHeight: 64,
  },
  actionBtnIcon: {
    fontSize: 26,
    marginRight: 12,
  },
  actionBtnCol: {
    flex: 1,
  },
  primaryActionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryActionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  actionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
  },
  trashCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  trashInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  trashText: {
    fontSize: 14,
    fontWeight: "600",
  },
  emptyTrashBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTrashText: {
    fontSize: 12,
    fontWeight: "700",
  },
  trashWarning: {
    fontSize: 12,
    lineHeight: 16,
  },
  modalSafe: {
    flex: 1,
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
    minHeight: 36,
    minWidth: 64,
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
  inputHelp: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  backupTipCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 20,
  },
  backupTipTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4,
  },
  backupTipDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
});
