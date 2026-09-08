/**
 * Local vault state for every screen.
 *
 * Opening the vault is asynchronous because the device key comes from the
 * platform keystore, so the provider exposes an explicit lifecycle: `opening`,
 * then `ready` or `failed`. Screens never see a half-open vault, and a vault
 * that cannot be decrypted surfaces as an error rather than as an empty list —
 * presenting "no receipts" for records that are merely locked would invite the
 * user to save over them.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AskKeeptrailEngine,
  InMemoryVaultStore,
  LocalReceiptVault,
  buildAttachmentPath,
  computeSha256,
  createEncryptedBackup,
  restoreEncryptedBackup,
  type ActionRecord,
  type AssistantResponse,
  type AttachmentRecord,
  type CaptureDraft,
  type CollectionRecord,
  type CustomFieldDefinition,
  type DuplicateSuggestion,
  type ReceiptRecord,
  type StorageUsageStats,
  type VaultStore,
} from "@katibay/shared";
import { FileVaultStore } from "./storage/file-vault-store";
import { EncryptedVaultStore } from "./storage/encrypted-vault-store";
import { loadVaultKey } from "./storage/vault-key";
import { syncScheduledReminders } from "./services/reminder-notifications";

export interface BackupArchiveInfo {
  name: string;
  uri: string;
  sizeBytes: number;
}

export interface RestoreOutcome {
  receiptCount: number;
  attachmentCount: number;
}

export interface CommitAttachmentInput {
  receiptId: string;
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
  sourceText?: string | null;
}

export type VaultStatus = "opening" | "ready" | "failed";

interface VaultContextValue {
  status: VaultStatus;
  /** Set when the vault could not be opened at all. */
  failure: string | null;
  /** Set when the vault opened, but not durably or not encrypted. */
  warning: string | null;
  /** True when records are encrypted at rest with the device key. */
  encryptedAtRest: boolean;
  vaultLocation: string | null;

  vault: LocalReceiptVault;
  receipts: ReceiptRecord[];
  collections: CollectionRecord[];
  actions: ActionRecord[];
  customFields: CustomFieldDefinition[];
  drafts: CaptureDraft[];
  stats: StorageUsageStats;
  duplicates: DuplicateSuggestion[];
  tags: { tag: string; count: number }[];

  refreshState: () => void;
  saveReceipt: (
    receipt: Omit<ReceiptRecord, "created_at" | "updated_at" | "custom_fields"> & {
      custom_fields?: Record<string, string>;
    },
  ) => ReceiptRecord;
  /** Writes an original to durable storage and links it to a receipt. */
  commitAttachment: (input: CommitAttachmentInput) => AttachmentRecord;
  /** Writes an original before a receipt exists, for a recoverable draft. */
  stageAttachment: (
    draftId: string,
    bytes: Uint8Array,
    fileName: string,
  ) => { relativePath: string; sha256: string; sizeBytes: number };
  getAttachments: (receiptId: string) => AttachmentRecord[];
  getAttachmentBytes: (relativePath: string) => Uint8Array | null;
  setReceiptCollections: (receiptId: string, collectionIds: string[]) => void;
  setReceiptTags: (receiptId: string, tags: string[]) => void;
  setReceiptCustomFields: (receiptId: string, values: Record<string, string>) => void;
  saveCustomFieldDefinition: (definition: CustomFieldDefinition) => void;
  deleteCustomFieldDefinition: (id: string) => void;
  moveToTrash: (id: string) => boolean;
  restoreFromTrash: (id: string) => boolean;
  permanentlyDelete: (id: string) => boolean;
  emptyTrash: () => number;
  saveAction: (action: ActionRecord) => void;
  deleteAction: (id: string) => void;
  toggleActionStatus: (id: string) => void;
  saveCollection: (collection: CollectionRecord) => void;

  saveDraft: (draft: CaptureDraft) => void;
  discardDraft: (id: string, keepAttachment: boolean) => void;

  exportEncryptedBackup: (password: string) => { uri: string; sizeBytes: number };
  listBackupArchives: () => BackupArchiveInfo[];
  restoreFromBytes: (bytes: Uint8Array, password: string) => RestoreOutcome;
  restoreFromArchive: (uri: string, password: string) => RestoreOutcome;
  deleteBackupArchive: (uri: string) => void;

  loadSampleReceipts: () => number;
  queryAssistant: (prompt: string) => Promise<AssistantResponse>;
}

const VaultContext = createContext<VaultContextValue | null>(null);

interface OpenedVault {
  vault: LocalReceiptVault;
  fileStore: FileVaultStore | null;
  encryptedAtRest: boolean;
  warning: string | null;
}

/**
 * Opens the vault: device key, then encrypted store over durable files.
 *
 * Degradations are reported rather than hidden. Losing durability or losing
 * encryption are both things the user is entitled to know about, and neither
 * is allowed to look like success.
 */
async function openVault(): Promise<OpenedVault> {
  let fileStore: FileVaultStore;
  try {
    fileStore = new FileVaultStore();
  } catch (error) {
    // No filesystem: run in memory so the app is usable, and say so loudly.
    const store = new InMemoryVaultStore();
    return {
      vault: new LocalReceiptVault(store),
      fileStore: null,
      encryptedAtRest: false,
      warning:
        error instanceof Error
          ? `Durable storage is unavailable (${error.message}). Nothing saved in this session will survive closing the app.`
          : "Durable storage is unavailable. Nothing saved in this session will survive closing the app.",
    };
  }

  const keyOutcome = await loadVaultKey();

  if (keyOutcome.status === "invalidated") {
    // The key is gone but sealed data may still be on disk. Refuse rather than
    // open a vault that would look empty and then be written over.
    throw new Error(
      `${keyOutcome.reason} Records already saved on this device cannot be decrypted. ` +
        "Restore from a backup archive to recover them.",
    );
  }

  if (keyOutcome.status === "unavailable") {
    return {
      vault: new LocalReceiptVault(fileStore),
      fileStore,
      encryptedAtRest: false,
      warning: `${keyOutcome.reason} Your receipts are saved to app-private storage but are not encrypted at rest on this device.`,
    };
  }

  const encrypted = new EncryptedVaultStore(fileStore, keyOutcome.key);
  return {
    vault: new LocalReceiptVault(encrypted),
    fileStore,
    encryptedAtRest: true,
    warning: null,
  };
}

/** Clearly fictional records, loaded only when the user asks for them. */
function buildSampleReceipts(vault: LocalReceiptVault): number {
  const now = new Date().toISOString();
  const samples: Array<{
    receipt: Omit<ReceiptRecord, "created_at" | "updated_at" | "custom_fields">;
    sourceText: string;
  }> = [
    {
      receipt: {
        id: "sample_rec_coffee",
        title: "Sample — Highland Coffee Roasters",
        merchant: "Highland Coffee Roasters",
        transaction_date: "2026-09-04",
        currency: "PHP",
        total_minor_units: 30240,
        subtotal_minor_units: 27000,
        tax_minor_units: 3240,
        document_type: "receipt",
        review_status: "reviewed",
        notes: "Sample record. Delete it once you have saved a real receipt.",
        purpose: "Client meeting",
        tags: ["sample"],
        collection_ids: ["col_purchases"],
        is_trashed: false,
        deleted_at: null,
      },
      sourceText:
        "HIGHLAND COFFEE ROASTERS\nSM MEGAMALL\n1 ICED AMERICANO 150.00\n1 CROISSANT 120.00\nTOTAL 302.40",
    },
    {
      receipt: {
        id: "sample_rec_pharmacy",
        title: "Sample — Pharmacy receipt",
        merchant: "Sample Pharmacy",
        transaction_date: "2026-09-05",
        currency: "PHP",
        total_minor_units: 125000,
        subtotal_minor_units: null,
        tax_minor_units: null,
        document_type: "receipt",
        review_status: "unreviewed",
        notes: "Sample record showing a receipt that still needs review.",
        purpose: "Medical reimbursement",
        tags: ["sample"],
        collection_ids: ["col_work"],
        is_trashed: false,
        deleted_at: null,
      },
      sourceText: "SAMPLE PHARMACY\nVITAMINS\nTOTAL AMOUNT 1250.00",
    },
  ];

  let created = 0;
  for (const sample of samples) {
    if (vault.getReceipt(sample.receipt.id)) continue;
    vault.saveReceipt(sample.receipt);
    const bytes = new TextEncoder().encode(sample.sourceText);
    vault.saveAttachment(
      {
        id: `att_${sample.receipt.id}`,
        receipt_id: sample.receipt.id,
        file_name: `${sample.receipt.id}.txt`,
        relative_path: `originals/samples/${sample.receipt.id}.txt`,
        mime_type: "text/plain",
        file_size_bytes: bytes.length,
        sha256_hash: computeSha256(bytes),
        page_order: 1,
        ocr_text: sample.sourceText,
        created_at: now,
      },
      bytes,
    );
    created++;
  }

  if (created > 0) {
    vault.saveAction({
      id: "sample_act_reimbursement",
      receipt_id: "sample_rec_pharmacy",
      action_type: "reimbursement",
      title: "Sample — submit pharmacy receipt for reimbursement",
      due_date: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
      status: "pending",
      amount_minor_units: 125000,
      currency: "PHP",
      notes: "Sample reminder. Delete it once you have added your own.",
      created_at: now,
      updated_at: now,
    });
  }

  return created;
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 ? fileName.slice(dot) : ".bin";
}

export function VaultProvider({
  children,
  renderLoading,
  renderFailure,
}: {
  children: ReactNode;
  renderLoading: () => ReactNode;
  renderFailure: (message: string) => ReactNode;
}) {
  const [opened, setOpened] = useState<OpenedVault | null>(null);
  const [status, setStatus] = useState<VaultStatus>("opening");
  const [failure, setFailure] = useState<string | null>(null);

  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [actions, setActions] = useState<ActionRecord[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [drafts, setDrafts] = useState<CaptureDraft[]>([]);
  const [stats, setStats] = useState<StorageUsageStats | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateSuggestion[]>([]);
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);

  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    let cancelled = false;
    openVault()
      .then((result) => {
        if (cancelled) return;
        setOpened(result);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setFailure(
          error instanceof Error ? error.message : "The vault could not be opened on this device.",
        );
        setStatus("failed");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshState = useCallback(() => {
    const vault = opened?.vault;
    if (!vault) return;
    setReceipts(vault.listReceipts({ trashScope: "active" }));
    setCollections(vault.listCollections());
    setActions(vault.listActions());
    setCustomFields(vault.listCustomFieldDefinitions());
    setDrafts(vault.listDrafts());
    setStats(vault.getStorageUsageStats());
    setDuplicates(vault.findAllDuplicates());
    setTags(vault.listTags());
  }, [opened]);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  // Bring the OS notification schedule in line with the vault once it opens,
  // so a reboot or a reminder edited on another launch cannot leave a stale or
  // missing trigger behind.
  useEffect(() => {
    if (!opened) return;
    syncScheduledReminders(opened.vault.listActions()).catch(() => {
      // Notification permission may simply not be granted; the Reminders screen
      // reports that state rather than this background sync.
    });
  }, [opened]);

  const value = useMemo<VaultContextValue | null>(() => {
    if (!opened || !stats) return null;
    const { vault, fileStore } = opened;

    const withRefresh = <T,>(operation: () => T): T => {
      const result = operation();
      refreshState();
      return result;
    };

    return {
      status,
      failure,
      warning: opened.warning,
      encryptedAtRest: opened.encryptedAtRest,
      vaultLocation: fileStore?.location ?? null,

      vault,
      receipts,
      collections,
      actions,
      customFields,
      drafts,
      stats,
      duplicates,
      tags,

      refreshState,

      saveReceipt: (receipt) => withRefresh(() => vault.saveReceipt(receipt)),

      stageAttachment: (draftId, bytes, fileName) => {
        const relativePath = buildAttachmentPath(draftId, extensionOf(fileName));
        // Written before any record exists, so a crash leaves a file the draft
        // can still point at rather than a record with nothing behind it.
        vault.stageFile(relativePath, bytes);
        return {
          relativePath,
          sha256: computeSha256(bytes),
          sizeBytes: bytes.length,
        };
      },

      commitAttachment: ({ receiptId, bytes, fileName, mimeType, sourceText }) =>
        withRefresh(() => {
          const relativePath = buildAttachmentPath(receiptId, extensionOf(fileName));
          const attachment: AttachmentRecord = {
            id: `att_${receiptId}`,
            receipt_id: receiptId,
            file_name: fileName,
            relative_path: relativePath,
            mime_type: mimeType,
            file_size_bytes: bytes.length,
            sha256_hash: computeSha256(bytes),
            page_order: 1,
            ocr_text: sourceText ?? null,
            created_at: new Date().toISOString(),
          };
          vault.saveAttachment(attachment, bytes);
          return attachment;
        }),

      getAttachments: (receiptId) => vault.getAttachmentsForReceipt(receiptId),
      getAttachmentBytes: (relativePath) => vault.getFileBytes(relativePath),
      setReceiptCollections: (receiptId, collectionIds) =>
        withRefresh(() => vault.setReceiptCollections(receiptId, collectionIds)),
      setReceiptTags: (receiptId, next) => withRefresh(() => vault.setReceiptTags(receiptId, next)),
      setReceiptCustomFields: (receiptId, values) =>
        withRefresh(() => vault.setReceiptCustomFields(receiptId, values)),
      saveCustomFieldDefinition: (definition) =>
        withRefresh(() => vault.saveCustomFieldDefinition(definition)),
      deleteCustomFieldDefinition: (id) => withRefresh(() => vault.deleteCustomFieldDefinition(id)),
      moveToTrash: (id) => withRefresh(() => vault.moveToTrash(id)),
      restoreFromTrash: (id) => withRefresh(() => vault.restoreFromTrash(id)),
      permanentlyDelete: (id) => withRefresh(() => vault.permanentlyDeleteReceipt(id)),
      emptyTrash: () => withRefresh(() => vault.emptyTrash()),
      saveAction: (action) => withRefresh(() => vault.saveAction(action)),
      deleteAction: (id) => withRefresh(() => vault.deleteAction(id)),
      toggleActionStatus: (id) =>
        withRefresh(() => {
          const action = vault.listActions().find((a) => a.id === id);
          if (!action) return;
          vault.updateActionStatus(id, action.status === "completed" ? "pending" : "completed");
        }),
      saveCollection: (collection) => withRefresh(() => vault.saveCollection(collection)),

      saveDraft: (draft) => withRefresh(() => vault.saveDraft(draft)),
      discardDraft: (id, keepAttachment) =>
        withRefresh(() => vault.discardDraft(id, keepAttachment)),

      exportEncryptedBackup: (password) => {
        if (!fileStore) {
          throw new Error(
            "Durable storage is unavailable on this device, so a backup file cannot be written.",
          );
        }
        const bytes = createEncryptedBackup(vault.getBackupPayload(), password);
        const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const uri = fileStore.writeBackupArchive(`keeptrail-${stamp}.keeptrail`, bytes);
        vault.markBackupCompleted();
        refreshState();
        return { uri, sizeBytes: bytes.length };
      },

      listBackupArchives: () => fileStore?.listBackupArchives() ?? [],

      restoreFromBytes: (bytes, password) => {
        // Decryption and every checksum are verified before a single existing
        // record is touched, so a wrong password or a damaged file changes
        // nothing.
        const archive = restoreEncryptedBackup(bytes, password);
        vault.restoreFromPayload(archive, "overwrite");
        refreshState();
        syncScheduledReminders(vault.listActions()).catch(() => undefined);
        return {
          receiptCount: archive.manifest.receipt_count,
          attachmentCount: archive.manifest.attachment_count,
        };
      },

      restoreFromArchive: (uri, password) => {
        if (!fileStore) throw new Error("Durable storage is unavailable on this device.");
        const archive = restoreEncryptedBackup(fileStore.readBackupArchive(uri), password);
        vault.restoreFromPayload(archive, "overwrite");
        refreshState();
        syncScheduledReminders(vault.listActions()).catch(() => undefined);
        return {
          receiptCount: archive.manifest.receipt_count,
          attachmentCount: archive.manifest.attachment_count,
        };
      },

      deleteBackupArchive: (uri) => fileStore?.deleteBackupArchive(uri),

      loadSampleReceipts: () => withRefresh(() => buildSampleReceipts(vault)),

      queryAssistant: async (prompt) => {
        const engine = new AskKeeptrailEngine({
          receipts: vault.listReceipts({ trashScope: "active" }),
          collections: vault.listCollections(),
          actions: vault.listActions(),
          // No neural model runtime ships in this build, so the engine runs its
          // deterministic path and labels itself Basic Helper.
          isModelAvailable: false,
        });
        return engine.query(prompt);
      },
    };
  }, [
    opened,
    status,
    failure,
    receipts,
    collections,
    actions,
    customFields,
    drafts,
    stats,
    duplicates,
    tags,
    refreshState,
  ]);

  if (status === "failed") return <>{renderFailure(failure ?? "The vault could not be opened.")}</>;
  if (!value) return <>{renderLoading()}</>;

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useLocalVault(): VaultContextValue {
  const context = useContext(VaultContext);
  if (!context) {
    throw new Error("useLocalVault must be used within a VaultProvider");
  }
  return context;
}
