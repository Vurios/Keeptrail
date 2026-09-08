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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { CustomFieldType } from "@katibay/shared";
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
  OptionRow,
  Section,
  useContentInsets,
} from "../components/primitives";
import { Icon } from "../components/Icon";
import {
  isSharingAvailable,
  pickBackupArchive,
  readPickedArchive,
  shareFile,
  writeCsvExport,
  writePdfExport,
  type ExportedFile,
} from "../services/exports";
import { formatBenchmarkReport, runDeviceBenchmark } from "../services/device-benchmark";
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
    restoreFromBytes,
    deleteBackupArchive,
    receipts,
    collections,
    encryptedAtRest,
    customFields,
    saveCustomFieldDefinition,
    deleteCustomFieldDefinition,
  } = useLocalVault();
  const { showSnackbar } = useSnackbar();
  const contentInsets = useContentInsets();
  const insets = useSafeAreaInsets();

  const [archives, setArchives] = useState<BackupArchiveInfo[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [restoreTarget, setRestoreTarget] = useState<BackupArchiveInfo | null>(null);
  const [restorePassword, setRestorePassword] = useState("");
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  /** An archive chosen through the system picker, not stored by the app. */
  const [pickedArchive, setPickedArchive] = useState<{
    name: string;
    bytes: Uint8Array;
    sizeBytes: number;
  } | null>(null);
  const [exportingReport, setExportingReport] = useState<"csv" | "pdf" | null>(null);
  const [fieldEditorOpen, setFieldEditorOpen] = useState(false);
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldType, setFieldType] = useState<CustomFieldType>("text");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [benchmarking, setBenchmarking] = useState(false);

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
    setConfirmError(null);
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
      setConfirmError("The two passwords do not match.");
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

  /**
   * Restores from a file the user picks anywhere on the device.
   *
   * This is what makes a backup portable: an archive copied to a computer, a
   * memory card or a cloud drive can be brought back on a clean install, which
   * a list of app-private files alone could never support.
   */
  const handlePickArchive = useCallback(async () => {
    haptics.tap();
    const result = await pickBackupArchive();
    if (result.status === "cancelled") return;
    if (result.status === "failed") {
      haptics.error();
      showSnackbar({ message: result.reason, tone: "danger", durationMs: 6000 });
      return;
    }

    try {
      const bytes = readPickedArchive(result.uri);
      setPickedArchive({ name: result.name, bytes, sizeBytes: bytes.length });
      setRestorePassword("");
      setRestoreError(null);
    } catch (error) {
      haptics.error();
      showSnackbar({
        message:
          error instanceof Error
            ? `That file could not be read: ${error.message}`
            : "That file could not be read.",
        tone: "danger",
        durationMs: 6000,
      });
    }
  }, [showSnackbar]);

  const handleRestorePicked = useCallback(() => {
    if (!pickedArchive || restoring) return;
    if (!restorePassword) {
      setRestoreError("Enter the password this archive was created with.");
      haptics.error();
      return;
    }

    setRestoring(true);
    setTimeout(() => {
      try {
        const outcome = restoreFromBytes(pickedArchive.bytes, restorePassword);
        haptics.success();
        setPickedArchive(null);
        setRestorePassword("");
        setRestoreError(null);
        refreshArchives();
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
  }, [pickedArchive, restoring, restorePassword, restoreFromBytes, refreshArchives, showSnackbar]);

  /** Hands a stored archive to the share sheet so it can leave this phone. */
  const handleShareArchive = useCallback(
    async (archive: BackupArchiveInfo) => {
      haptics.tap();
      if (!(await isSharingAvailable())) {
        showSnackbar({
          message: "This device has no app that can receive the file.",
          tone: "warning",
        });
        return;
      }
      try {
        await shareFile(
          { uri: archive.uri, fileName: archive.name, sizeBytes: archive.sizeBytes },
          "application/octet-stream",
          "Send your encrypted backup",
        );
      } catch (error) {
        haptics.error();
        showSnackbar({
          message: error instanceof Error ? error.message : "The file could not be shared.",
          tone: "danger",
        });
      }
    },
    [showSnackbar],
  );

  /**
   * CSV and PDF are summaries, not backups, and the copy around them says so.
   * Only the encrypted archive carries the originals.
   */
  const handleExportReport = useCallback(
    async (kind: "csv" | "pdf") => {
      if (exportingReport) return;
      haptics.tap();
      setExportingReport(kind);
      try {
        const file: ExportedFile =
          kind === "csv"
            ? writeCsvExport(receipts, collections)
            : await writePdfExport(receipts, collections, {
                title: "Keeptrail receipts",
                includesUnreviewed: true,
              });

        if (await isSharingAvailable()) {
          await shareFile(
            file,
            kind === "csv" ? "text/csv" : "application/pdf",
            "Send your report",
          );
        } else {
          showSnackbar({
            message: `Saved ${file.fileName} on this phone.`,
            tone: "success",
          });
        }
      } catch (error) {
        haptics.error();
        showSnackbar({
          message:
            error instanceof Error ? `The report failed: ${error.message}` : "The report failed.",
          tone: "danger",
          durationMs: 6000,
        });
      } finally {
        setExportingReport(null);
      }
    },
    [exportingReport, receipts, collections, showSnackbar],
  );

  /**
   * Runs the on-device measurement and prints it to the log.
   *
   * Kept out of the tester-facing flow deliberately: it is an instrument for
   * capturing real numbers with `adb logcat`, not a feature.
   */
  const handleRunBenchmark = useCallback(async () => {
    if (benchmarking) return;
    haptics.tap();
    setBenchmarking(true);
    try {
      const report = await runDeviceBenchmark(vault);
      // eslint-disable-next-line no-console
      console.log(formatBenchmarkReport(report));
      const slowest = report.samples.reduce((worst, sample) =>
        sample.medianMs > worst.medianMs ? sample : worst,
      );
      showSnackbar({
        message: `Benchmark done. Slowest: ${slowest.name} at ${slowest.medianMs}ms. Full results are in the device log.`,
        tone: "neutral",
        durationMs: 8000,
      });
    } catch (error) {
      haptics.error();
      showSnackbar({
        message: error instanceof Error ? error.message : "The benchmark failed.",
        tone: "danger",
      });
    } finally {
      setBenchmarking(false);
    }
  }, [benchmarking, vault, showSnackbar]);

  const handleSaveField = useCallback(() => {
    const label = fieldLabel.trim();
    if (!label) {
      setFieldError("Give the field a name.");
      haptics.error();
      return;
    }
    if (customFields.some((f) => f.label.toLowerCase() === label.toLowerCase())) {
      setFieldError("You already have a field with that name.");
      haptics.error();
      return;
    }

    saveCustomFieldDefinition({
      id: `cf_${Date.now()}`,
      label,
      field_type: fieldType,
      created_at: new Date().toISOString(),
    });
    haptics.success();
    setFieldEditorOpen(false);
    setFieldLabel("");
    setFieldType("text");
    setFieldError(null);
    showSnackbar({ message: `"${label}" added to every receipt form.`, tone: "success" });
  }, [fieldLabel, fieldType, customFields, saveCustomFieldDefinition, showSnackbar]);

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
            tone={encryptedAtRest ? "success" : "warning"}
            icon={encryptedAtRest ? "lock" : "warning"}
            title={
              encryptedAtRest
                ? "Encrypted on this device"
                : "Saved, but not encrypted on this device"
            }
            body={
              encryptedAtRest
                ? "Your records and every original are encrypted with a key held by this phone's keystore, in storage no other app can read. Uninstalling Keeptrail deletes all of it."
                : "Your receipts are in app-private storage, but this device could not provide a secure key, so they are not encrypted at rest."
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
                  {/* Name on its own line: three actions plus a filename in one
                      row overflowed a 360dp screen before any font scaling. */}
                  <View style={{ gap: spacing.md }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                      <Icon name="storage" size={20} color={colors.textSecondary} />
                      <View style={{ flex: 1 }}>
                        <AppText role="smallStrong" numberOfLines={1}>
                          {archive.name}
                        </AppText>
                        <AppText role="small" tone="muted">
                          {formatBytes(archive.sizeBytes)}
                        </AppText>
                      </View>
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.sm,
                        flexWrap: "wrap",
                      }}
                    >
                      <Button
                        label="Send"
                        variant="tonal"
                        icon="backup"
                        onPress={() => handleShareArchive(archive)}
                        accessibilityHint="Copies this archive off the phone using the share sheet"
                      />
                      <Button
                        label="Restore"
                        variant="outlined"
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
                                  showSnackbar({
                                    message: "Backup file deleted.",
                                    tone: "warning",
                                  });
                                },
                              },
                            ],
                          )
                        }
                      />
                    </View>
                  </View>
                </Card>
              ))}
            </View>
          )}

          <View style={{ marginTop: spacing.md, gap: spacing.md }}>
            <Notice
              tone="warning"
              icon="warning"
              title="A backup on this phone is not a backup"
              body="If the phone is lost, stolen or wiped, these files go with it. Use Send to copy an archive to a computer, a memory card or a cloud drive you control."
            />

            <Card>
              <View style={{ gap: spacing.md }}>
                <AppText role="bodyStrong">Restore from a file</AppText>
                <AppText role="small" tone="secondary">
                  Bring back an archive from anywhere on this device — Downloads, a memory card, or
                  a cloud drive you have synced yourself. This is how a backup survives a new phone.
                </AppText>
                <Button
                  label="Choose a backup file"
                  variant="outlined"
                  icon="restoreArchive"
                  fullWidth
                  onPress={handlePickArchive}
                />
              </View>
            </Card>
          </View>
        </Section>

        <Section title="Reports">
          <Card>
            <View style={{ gap: spacing.md }}>
              <AppText role="small" tone="secondary">
                A spreadsheet or a printable summary of your {receipts.length} saved receipt
                {receipts.length === 1 ? "" : "s"}. Reports do not contain the original documents,
                so they are not a backup — only the encrypted archive above is.
              </AppText>
              <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
                <Button
                  label="Export CSV"
                  variant="tonal"
                  icon="storage"
                  busy={exportingReport === "csv"}
                  disabled={receipts.length === 0}
                  onPress={() => handleExportReport("csv")}
                />
                <Button
                  label="Export PDF"
                  variant="tonal"
                  icon="document"
                  busy={exportingReport === "pdf"}
                  disabled={receipts.length === 0}
                  onPress={() => handleExportReport("pdf")}
                />
              </View>
              <AppText role="small" tone="muted">
                Where the file goes is your choice. Keeptrail hands it to Android's share sheet and
                uploads nothing itself.
              </AppText>
            </View>
          </Card>
        </Section>

        <Section title="Custom fields">
          <Card>
            <View style={{ gap: spacing.md }}>
              <AppText role="small" tone="secondary">
                Add a field of your own — a warranty end date, a claim reference — and it appears on
                every receipt form. Fields you add are stored on this phone like everything else.
              </AppText>

              {customFields.length > 0 ? (
                <View style={{ gap: spacing.sm }}>
                  {customFields.map((definition) => (
                    <View
                      key={definition.id}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.sm,
                        minHeight: spacing.touch,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <AppText role="smallStrong">{definition.label}</AppText>
                        <AppText role="small" tone="muted">
                          {definition.field_type === "date"
                            ? "Date"
                            : definition.field_type === "number"
                              ? "Number"
                              : "Text"}
                        </AppText>
                      </View>
                      <IconButton
                        icon="trash"
                        tone="danger"
                        label={`Delete the field ${definition.label}`}
                        onPress={() =>
                          Alert.alert(
                            `Delete "${definition.label}"?`,
                            "The field and every value you have entered for it are removed. Your receipts themselves are not affected.",
                            [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Delete",
                                style: "destructive",
                                onPress: () => {
                                  deleteCustomFieldDefinition(definition.id);
                                  haptics.warning();
                                  showSnackbar({
                                    message: `"${definition.label}" removed.`,
                                    tone: "warning",
                                  });
                                },
                              },
                            ],
                          )
                        }
                      />
                    </View>
                  ))}
                </View>
              ) : null}

              <Button
                label="Add a field"
                variant="tonal"
                icon="add"
                onPress={() => {
                  haptics.tap();
                  setFieldEditorOpen(true);
                }}
              />
            </View>
          </Card>
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
        <Section title="Diagnostics">
          <Card>
            <View style={{ gap: spacing.md }}>
              <AppText role="small" tone="secondary">
                Measures encryption, backup and search speed on this phone and writes the numbers to
                the device log. Nothing is sent anywhere and your records are not changed.
              </AppText>
              <Button
                label="Run device benchmark"
                variant="outlined"
                icon="storage"
                fullWidth
                busy={benchmarking}
                onPress={handleRunBenchmark}
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
              contentContainerStyle={{
                padding: spacing.gutter,
                paddingBottom: spacing.gutter + insets.bottom + spacing.xl,
                gap: spacing.lg,
              }}
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
                  if (text === confirmPassword) setConfirmError(null);
                }}
                secureTextEntry
                autoCapitalize="none"
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                error={passwordError}
                required
              />

              <Field
                label="Type it again"
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (text === password) setConfirmError(null);
                }}
                secureTextEntry
                autoCapitalize="none"
                error={confirmError}
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

      <Modal
        visible={fieldEditorOpen}
        animationType="slide"
        onRequestClose={() => setFieldEditorOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <AppBar
            title="New custom field"
            onBack={() => setFieldEditorOpen(false)}
            actions={<Button label="Save" onPress={handleSaveField} />}
          />
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <ScrollView
              contentContainerStyle={{
                padding: spacing.gutter,
                paddingBottom: spacing.gutter + insets.bottom + spacing.xl,
                gap: spacing.lg,
              }}
              keyboardShouldPersistTaps="handled"
            >
              <Field
                label="Field name"
                value={fieldLabel}
                onChangeText={(text) => {
                  setFieldLabel(text);
                  if (text.trim()) setFieldError(null);
                }}
                placeholder="e.g. Warranty ends, Claim reference"
                error={fieldError}
                required
              />

              <OptionRow
                label="Type"
                options={[
                  { value: "text" as CustomFieldType, label: "Text" },
                  { value: "number" as CustomFieldType, label: "Number" },
                  { value: "date" as CustomFieldType, label: "Date" },
                ]}
                value={fieldType}
                onChange={setFieldType}
                hint="The type decides which keyboard opens for this field."
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* --- Restore from a picked file --- */}
      <Modal
        visible={pickedArchive !== null}
        animationType="slide"
        onRequestClose={() => setPickedArchive(null)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <AppBar title="Restore from a file" onBack={() => setPickedArchive(null)} />
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <ScrollView
              contentContainerStyle={{
                padding: spacing.gutter,
                paddingBottom: spacing.gutter + insets.bottom + spacing.xl,
                gap: spacing.lg,
              }}
              keyboardShouldPersistTaps="handled"
            >
              {pickedArchive ? (
                <View
                  style={{
                    backgroundColor: colors.surfaceSunken,
                    borderRadius: radius.card,
                    padding: spacing.lg,
                    gap: spacing.xs,
                  }}
                >
                  <AppText role="label" tone="muted">
                    CHOSEN FILE
                  </AppText>
                  <AppText role="smallStrong">{pickedArchive.name}</AppText>
                  <AppText role="small" tone="muted">
                    {formatBytes(pickedArchive.sizeBytes)}
                  </AppText>
                </View>
              ) : null}

              <Notice
                tone="warning"
                icon="warning"
                body="Everything currently on this phone is replaced by what the archive contains. The file is checked, decrypted and every checksum verified before a single record is touched, so a wrong password or a file that is not a Keeptrail backup changes nothing."
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
                label="Restore from this file"
                icon="restoreArchive"
                fullWidth
                busy={restoring}
                onPress={handleRestorePicked}
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
              contentContainerStyle={{
                padding: spacing.gutter,
                paddingBottom: spacing.gutter + insets.bottom + spacing.xl,
                gap: spacing.lg,
              }}
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
