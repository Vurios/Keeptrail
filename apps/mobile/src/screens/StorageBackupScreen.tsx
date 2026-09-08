/**
 * Vault — storage, backup and restore.
 *
 * The previous version of this screen was the most dishonest surface in the
 * app. Export produced bytes in React state, wrote no file, and told the user
 * "Encrypted Backup Created… Keep a copy away from this phone". Restore could
 * only decrypt the archive still in memory from that same session, and its only
 * other affordance re-encrypted the live vault under a hardcoded password and
 * then congratulated the user on a restore that restored nothing.
 *
 * Export now writes a real `.keeptrail` file and shows where it is. Restore
 * reads a real file from that list. Every claim on this screen describes
 * something the code does.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, View } from "react-native";

import { useTheme } from "../theme/ThemeContext";
import { useLocalVault, type BackupArchiveInfo } from "../vault-context";
import { useSnackbar } from "../components/SnackbarContext";
import {
  AppBar,
  AppText,
  Button,
  Card,
  Divider,
  EmptyState,
  Field,
  IconButton,
  Notice,
  Section,
  useContentInsets,
} from "../components/primitives";
import { Icon } from "../components/Icon";
import { formatDate } from "../utils/dates";
import { haptics } from "../utils/haptics";

const MIN_PASSWORD_LENGTH = 8;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

interface StorageBackupScreenProps {
  onBack: () => void;
  onOpenAsk: () => void;
}

export function StorageBackupScreen({ onBack, onOpenAsk }: StorageBackupScreenProps) {
  const { colors, spacing, radius } = useTheme();
  const {
    vault,
    stats,
    vaultLocation,
    warning,
    emptyTrash,
    exportEncryptedBackup,
    listBackupArchives,
    restoreFromArchive,
    deleteBackupArchive,
  } = useLocalVault();
  const { showSnackbar } = useSnackbar();
  const contentInsets = useContentInsets();

  const [archives, setArchives] = useState<BackupArchiveInfo[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [restoreTarget, setRestoreTarget] = useState<BackupArchiveInfo | null>(null);
  const [restorePassword, setRestorePassword] = useState("");
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const refreshArchives = useCallback(() => {
    setArchives(listBackupArchives());
  }, [listBackupArchives]);

  useEffect(() => {
    refreshArchives();
  }, [refreshArchives]);

  // Attachment records whose file is gone, and files no record points at.
  // Reported rather than hidden, because a vault that quietly lost an original
  // is exactly what the user needs to be told about.
  const reconciliation = useMemo(() => vault.reconcileAttachments(), [vault, stats]);

  const closeExport = useCallback(() => {
    setExportOpen(false);
    setPassword("");
    setConfirmPassword("");
    setPasswordError(null);
  }, []);

  const handleExport = useCallback(() => {
    if (exporting) return;

    if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      haptics.error();
      return;
    }
    // A single blind entry for a key that can never be recovered is a trap.
    if (password !== confirmPassword) {
      setPasswordError("The two passwords do not match.");
      haptics.error();
      return;
    }

    setExporting(true);
    setTimeout(() => {
      try {
        const result = exportEncryptedBackup(password);
        haptics.success();
        refreshArchives();
        closeExport();
        showSnackbar({
          message: `Backup written to this phone (${formatBytes(
            result.sizeBytes,
          )}). Copy it somewhere else to survive losing the device.`,
          tone: "success",
          durationMs: 6000,
        });
      } catch (error) {
        haptics.error();
        setPasswordError(
          error instanceof Error ? error.message : "The backup could not be created.",
        );
      } finally {
        setExporting(false);
      }
    }, 30);
  }, [
    exporting,
    password,
    confirmPassword,
    exportEncryptedBackup,
    refreshArchives,
    closeExport,
    showSnackbar,
  ]);

  const handleRestore = useCallback(() => {
    if (!restoreTarget || restoring) return;
    if (!restorePassword) {
      setRestoreError("Enter the password this archive was created with.");
      haptics.error();
      return;
    }

    setRestoring(true);
    setTimeout(() => {
      try {
        const outcome = restoreFromArchive(restoreTarget.uri, restorePassword);
        haptics.success();
        setRestoreTarget(null);
        setRestorePassword("");
        setRestoreError(null);
        showSnackbar({
          message: `Restored ${outcome.receiptCount} receipt(s) and ${outcome.attachmentCount} original(s). Every checksum matched.`,
          tone: "success",
          durationMs: 6000,
        });
      } catch (error) {
        haptics.error();
        setRestoreError(
          error instanceof Error
            ? error.message
            : "The archive could not be read with that password.",
        );
      } finally {
        setRestoring(false);
      }
    }, 30);
  }, [restoreTarget, restoring, restorePassword, restoreFromArchive, showSnackbar]);

  const confirmRestore = useCallback((archive: BackupArchiveInfo) => {
    Alert.alert(
      "Replace everything on this phone?",
      "Restoring writes the archive over your current vault. Receipts saved since that backup was made will be gone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => {
            setRestoreTarget(archive);
            setRestorePassword("");
            setRestoreError(null);
          },
        },
      ],
    );
  }, []);

  const handleEmptyTrash = useCallback(() => {
    Alert.alert(
      "Empty the trash?",
      `${stats.trashedCount} receipt${
        stats.trashedCount === 1 ? "" : "s"
      } and their originals will be erased from this phone. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Empty trash",
          style: "destructive",
          onPress: () => {
            const removed = emptyTrash();
            haptics.warning();
            showSnackbar({
              message: `Permanently removed ${removed} receipt${removed === 1 ? "" : "s"}.`,
              tone: "danger",
            });
          },
        },
      ],
    );
  }, [stats.trashedCount, emptyTrash, showSnackbar]);

  const unsavedChanges = stats.recordsModifiedSinceLastBackup;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppBar
        title="Vault"
        subtitle="Everything here stays on this phone"
        onBack={onBack}
        actions={<IconButton icon="assistant" label="Ask Keeptrail" onPress={onOpenAsk} />}
      />

      <ScrollView contentContainerStyle={contentInsets}>
        {warning ? (
          <Notice tone="danger" icon="warning" title="Heads up about storage" body={warning} />
        ) : (
          <Notice
            tone="neutral"
            icon="lock"
            title="Where your receipts live"
            body={
              vaultLocation
                ? `App-private storage on this device. Other apps cannot read it, and uninstalling Keeptrail deletes it along with everything inside.`
                : "App-private storage on this device."
            }
          />
        )}

        <Section title="What is stored">
          <Card>
            <View style={{ gap: spacing.md }}>
              <StorageRow label="Receipts" value={`${stats.receiptCount}`} />
              <StorageRow
                label="Awaiting review"
                value={`${stats.unreviewedCount}`}
                tone={stats.unreviewedCount > 0 ? "warning" : undefined}
              />
              <StorageRow
                label="Original documents"
                value={`${stats.attachmentCount} · ${formatBytes(stats.totalAttachmentBytes)}`}
              />
              <StorageRow label="Record index" value={formatBytes(stats.indexBytes)} />
              <StorageRow
                label="In trash"
                value={`${stats.trashedCount}`}
                tone={stats.trashedCount > 0 ? "warning" : undefined}
              />
            </View>
          </Card>

          {reconciliation.missingFiles.length > 0 ? (
            <View style={{ marginTop: spacing.md }}>
              <Notice
                tone="danger"
                icon="warning"
                title={`${reconciliation.missingFiles.length} original${
                  reconciliation.missingFiles.length === 1 ? " is" : "s are"
                } missing`}
                body="The record still exists but its file is gone from storage. Restoring a backup that contains it will bring it back."
              />
            </View>
          ) : null}
        </Section>

        <Section title="Backup">
          <Card>
            <View style={{ gap: spacing.md }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <Icon name="backup" size={22} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <AppText role="bodyStrong">
                    {stats.lastBackupTimestamp
                      ? `Last backup ${formatDate(stats.lastBackupTimestamp.slice(0, 10))}`
                      : "No backup made yet"}
                  </AppText>
                  <AppText role="small" tone="secondary">
                    {unsavedChanges === 0
                      ? "Nothing has changed since then."
                      : `${unsavedChanges} change${
                          unsavedChanges === 1 ? "" : "s"
                        } since the last backup.`}
                  </AppText>
                </View>
              </View>

              <AppText role="small" tone="secondary">
                A backup is one encrypted `.keeptrail` file holding every record and every original,
                sealed with AES-256-GCM under a key derived from your password. Keeptrail cannot
                open it without that password and cannot reset it for you.
              </AppText>

              <Button
                label="Create a backup"
                icon="backup"
                fullWidth
                disabled={Boolean(warning)}
                onPress={() => {
                  haptics.tap();
                  setExportOpen(true);
                }}
              />
            </View>
          </Card>
        </Section>

        <Section title="Backups on this phone">
          {archives.length === 0 ? (
            <EmptyState
              icon="restoreArchive"
              title="No backup files yet"
              body="Once you create one it is listed here, and you can restore from it or copy it off the device using your file manager."
            />
          ) : (
            <View style={{ gap: spacing.sm }}>
              {archives.map((archive) => (
                <Card key={archive.uri}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                    <Icon name="storage" size={20} color={colors.textSecondary} />
                    <View style={{ flex: 1 }}>
                      <AppText role="smallStrong" numberOfLines={1}>
                        {archive.name}
                      </AppText>
                      <AppText role="small" tone="muted">
                        {formatBytes(archive.sizeBytes)}
                      </AppText>
                    </View>
                    <Button
                      label="Restore"
                      variant="tonal"
                      icon="restoreArchive"
                      onPress={() => confirmRestore(archive)}
                    />
                    <IconButton
                      icon="trash"
                      tone="danger"
                      label={`Delete backup ${archive.name}`}
                      onPress={() =>
                        Alert.alert(
                          "Delete this backup file?",
                          "Your receipts stay on the phone. Only this archive is removed.",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Delete",
                              style: "destructive",
                              onPress: () => {
                                deleteBackupArchive(archive.uri);
                                refreshArchives();
                                showSnackbar({ message: "Backup file deleted.", tone: "warning" });
                              },
                            },
                          ],
                        )
                      }
                    />
                  </View>
                </Card>
              ))}
            </View>
          )}

          <View style={{ marginTop: spacing.md }}>
            <Notice
              tone="warning"
              icon="warning"
              title="A backup on this phone is not a backup"
              body="If the phone is lost, stolen or wiped, these files go with it. Copy an archive to a computer, a memory card or a cloud drive you control."
            />
          </View>
        </Section>

        <Section title="Housekeeping">
          <Card>
            <View style={{ gap: spacing.md }}>
              <AppText role="small" tone="secondary">
                Emptying the trash erases those receipts and their originals for good. It is the
                only action in Keeptrail that cannot be undone.
              </AppText>
              <Button
                label={
                  stats.trashedCount === 0
                    ? "Trash is empty"
                    : `Empty trash (${stats.trashedCount})`
                }
                variant="danger"
                icon="trash"
                fullWidth
                disabled={stats.trashedCount === 0}
                onPress={handleEmptyTrash}
              />
            </View>
          </Card>
        </Section>
      </ScrollView>

      {/* --- Create backup --- */}
      <Modal visible={exportOpen} animationType="slide" onRequestClose={closeExport}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <AppBar title="Create a backup" onBack={closeExport} />
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <ScrollView
              contentContainerStyle={{ padding: spacing.gutter, gap: spacing.lg }}
              keyboardShouldPersistTaps="handled"
            >
              <Notice
                tone="danger"
                icon="key"
                title="This password cannot be recovered"
                body="It is the only key to the archive. Keeptrail does not store it, cannot reset it, and there is no way back into the file without it. Write it down somewhere safe before you continue."
              />

              <Field
                label="Backup password"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (text.length >= MIN_PASSWORD_LENGTH) setPasswordError(null);
                }}
                secureTextEntry
                autoCapitalize="none"
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                required
              />

              <Field
                label="Type it again"
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (text === password) setPasswordError(null);
                }}
                secureTextEntry
                autoCapitalize="none"
                error={passwordError}
                required
              />

              <AppText role="small" tone="secondary">
                Sealing the archive takes a few seconds — the key is deliberately slow to derive, so
                guessing the password is slow too.
              </AppText>

              <Button
                label="Create backup"
                icon="backup"
                fullWidth
                busy={exporting}
                onPress={handleExport}
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* --- Restore --- */}
      <Modal
        visible={restoreTarget !== null}
        animationType="slide"
        onRequestClose={() => setRestoreTarget(null)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <AppBar title="Restore a backup" onBack={() => setRestoreTarget(null)} />
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <ScrollView
              contentContainerStyle={{ padding: spacing.gutter, gap: spacing.lg }}
              keyboardShouldPersistTaps="handled"
            >
              {restoreTarget ? (
                <View
                  style={{
                    backgroundColor: colors.surfaceSunken,
                    borderRadius: radius.card,
                    padding: spacing.lg,
                    gap: spacing.xs,
                  }}
                >
                  <AppText role="label" tone="muted">
                    ARCHIVE
                  </AppText>
                  <AppText role="smallStrong">{restoreTarget.name}</AppText>
                  <AppText role="small" tone="muted">
                    {formatBytes(restoreTarget.sizeBytes)}
                  </AppText>
                </View>
              ) : null}

              <Notice
                tone="warning"
                icon="warning"
                body="Everything currently on this phone is replaced by what the archive contains. The archive is decrypted and every checksum verified before a single record is touched, so a wrong password or a damaged file changes nothing."
              />

              <Field
                label="Archive password"
                value={restorePassword}
                onChangeText={(text) => {
                  setRestorePassword(text);
                  if (text) setRestoreError(null);
                }}
                secureTextEntry
                autoCapitalize="none"
                error={restoreError}
                required
              />

              <Button
                label="Restore this backup"
                icon="restoreArchive"
                fullWidth
                busy={restoring}
                onPress={handleRestore}
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

function StorageRow({ label, value, tone }: { label: string; value: string; tone?: "warning" }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <AppText role="small" tone="secondary">
        {label}
      </AppText>
      <AppText
        role="smallStrong"
        style={tone === "warning" ? { color: colors.status.warning.text } : undefined}
      >
        {value}
      </AppText>
    </View>
  );
}
