/**
 * Local vault state for every screen.
 *
 * The vault is backed by app-private files, so what a tester saves is still
 * there after Android reclaims the process. Previously this module built an
 * in-memory vault at import time and seeded it with three invented receipts,
 * which meant a first-run user opened the app to somebody else's data and lost
 * their own on the next cold start.
 *
 * Sample data still exists, but only behind an explicit action in the guide —
 * loading it is the user's choice and clearing it is one tap.
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
  computeSha256,
  createEncryptedBackup,
  restoreEncryptedBackup,
  type ActionRecord,
  type AssistantResponse,
  type AttachmentRecord,
  type CollectionRecord,
  type ReceiptRecord,
  type StorageUsageStats,
  type VaultStore,
} from "@katibay/shared";
import { FileVaultStore } from "./storage/file-vault-store";

export interface BackupArchiveInfo {
  name: string;
  uri: string;
  sizeBytes: number;
}

export interface RestoreOutcome {
  receiptCount: number;
  attachmentCount: number;
}

interface VaultContextValue {
  vault: LocalReceiptVault;
  receipts: ReceiptRecord[];
  collections: CollectionRecord[];
  actions: ActionRecord[];
  stats: StorageUsageStats;
  /** Where the vault lives on this device, or null when storage is unavailable. */
  vaultLocation: string | null;
  /** Set when durable storage could not be opened; the UI must say so. */
  storageError: string | null;

  refreshState: () => void;
  saveReceipt: (receipt: Omit<ReceiptRecord, "created_at" | "updated_at">) => ReceiptRecord;
  saveAttachment: (attachment: AttachmentRecord, bytes: Uint8Array) => void;
  getAttachments: (receiptId: string) => AttachmentRecord[];
  getAttachmentBytes: (relativePath: string) => Uint8Array | null;
  setReceiptCollections: (receiptId: string, collectionIds: string[]) => void;
  moveToTrash: (id: string) => boolean;
  restoreFromTrash: (id: string) => boolean;
  permanentlyDelete: (id: string) => boolean;
  emptyTrash: () => number;
  saveAction: (action: ActionRecord) => void;
  deleteAction: (id: string) => void;
  toggleActionStatus: (id: string) => void;
  saveCollection: (collection: CollectionRecord) => void;

  /** Writes a real `.keeptrail` file and returns where it landed. */
  exportEncryptedBackup: (password: string) => { uri: string; sizeBytes: number };
  listBackupArchives: () => BackupArchiveInfo[];
  restoreFromArchive: (uri: string, password: string) => RestoreOutcome;
  deleteBackupArchive: (uri: string) => void;

  loadSampleReceipts: () => number;
  queryAssistant: (prompt: string) => Promise<AssistantResponse>;
}

const VaultContext = createContext<VaultContextValue | null>(null);

/**
 * Opens durable storage, falling back to a memory-only vault when the
 * filesystem is unavailable. The fallback is reported, never hidden: a vault
 * that silently stops persisting is the failure this whole module exists to
 * prevent.
 */
function openVault(): {
  vault: LocalReceiptVault;
  store: VaultStore;
  fileStore: FileVaultStore | null;
  error: string | null;
} {
  try {
    const fileStore = new FileVaultStore();
    return { vault: new LocalReceiptVault(fileStore), store: fileStore, fileStore, error: null };
  } catch (error) {
    const store = new InMemoryVaultStore();
    return {
      vault: new LocalReceiptVault(store),
      store,
      fileStore: null,
      error:
        error instanceof Error
          ? `Durable storage is unavailable (${error.message}). Records in this session will not survive closing the app.`
          : "Durable storage is unavailable. Records in this session will not survive closing the app.",
    };
  }
}

/** Clearly fictional records, loaded only when the user asks for them. */
function buildSampleReceipts(vault: LocalReceiptVault): number {
  const now = new Date().toISOString();
  const samples: Array<{
    receipt: Omit<ReceiptRecord, "created_at" | "updated_at">;
    ocrText: string;
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
      ocrText:
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
      ocrText: "SAMPLE PHARMACY\nVITAMINS\nTOTAL AMOUNT 1250.00",
    },
  ];

  let created = 0;
  for (const sample of samples) {
    if (vault.getReceipt(sample.receipt.id)) continue;
    vault.saveReceipt(sample.receipt);
    const bytes = new TextEncoder().encode(sample.ocrText);
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
        ocr_text: sample.ocrText,
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

export function VaultProvider({ children }: { children: ReactNode }) {
  const handle = useRef(openVault()).current;
  const vault = handle.vault;

  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [actions, setActions] = useState<ActionRecord[]>([]);
  const [stats, setStats] = useState<StorageUsageStats>(() => vault.getStorageUsageStats());

  const refreshState = useCallback(() => {
    setReceipts(vault.listReceipts({ trashScope: "active" }));
    setCollections(vault.listCollections());
    setActions(vault.listActions());
    setStats(vault.getStorageUsageStats());
  }, [vault]);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  const value = useMemo<VaultContextValue>(() => {
    const withRefresh = <T,>(operation: () => T): T => {
      const result = operation();
      refreshState();
      return result;
    };

    return {
      vault,
      receipts,
      collections,
      actions,
      stats,
      vaultLocation: handle.fileStore?.location ?? null,
      storageError: handle.error,

      refreshState,

      saveReceipt: (receipt) => withRefresh(() => vault.saveReceipt(receipt)),
      saveAttachment: (attachment, bytes) =>
        withRefresh(() => vault.saveAttachment(attachment, bytes)),
      getAttachments: (receiptId) => vault.getAttachmentsForReceipt(receiptId),
      getAttachmentBytes: (relativePath) => vault.getFileBytes(relativePath),
      setReceiptCollections: (receiptId, collectionIds) =>
        withRefresh(() => vault.setReceiptCollections(receiptId, collectionIds)),
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

      exportEncryptedBackup: (password) => {
        if (!handle.fileStore) {
          throw new Error(
            "Durable storage is unavailable on this device, so a backup file cannot be written.",
          );
        }
        const bytes = createEncryptedBackup(vault.getBackupPayload(), password);
        const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const uri = handle.fileStore.writeBackupArchive(`keeptrail-${stamp}.keeptrail`, bytes);
        vault.markBackupCompleted();
        refreshState();
        return { uri, sizeBytes: bytes.length };
      },

      listBackupArchives: () => handle.fileStore?.listBackupArchives() ?? [],

      restoreFromArchive: (uri, password) => {
        if (!handle.fileStore) {
          throw new Error("Durable storage is unavailable on this device.");
        }
        const bytes = handle.fileStore.readBackupArchive(uri);
        // Decryption and every checksum are verified before a single existing
        // record is touched, so a bad archive cannot leave a half-restored
        // vault behind.
        const archive = restoreEncryptedBackup(bytes, password);
        vault.restoreFromPayload(archive, "overwrite");
        refreshState();
        return {
          receiptCount: archive.manifest.receipt_count,
          attachmentCount: archive.manifest.attachment_count,
        };
      },

      deleteBackupArchive: (uri) => handle.fileStore?.deleteBackupArchive(uri),

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
  }, [vault, receipts, collections, actions, stats, refreshState, handle]);

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}

export function useLocalVault(): VaultContextValue {
  const context = useContext(VaultContext);
  if (!context) {
    throw new Error("useLocalVault must be used within a VaultProvider");
  }
  return context;
}
