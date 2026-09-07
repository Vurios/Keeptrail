/**
 * Keeptrail Local Vault State Context
 * 
 * Provides reactive local vault state to all mobile screens.
 * Initializes with realistic seed receipts so the local pilot is immediately testable.
 */

import React, { createContext, useContext, useState, useEffect } from "react";
import {
  LocalReceiptVault,
  ReceiptRecord,
  AttachmentRecord,
  CollectionRecord,
  ActionRecord,
  StorageUsageStats,
  AskKeeptrailEngine,
  AssistantResponse,
  createEncryptedBackup,
  restoreEncryptedBackup,
  computeSha256,
} from "@katibay/shared";

interface VaultContextType {
  vault: LocalReceiptVault;
  receipts: ReceiptRecord[];
  collections: CollectionRecord[];
  actions: ActionRecord[];
  stats: StorageUsageStats;
  refreshState: () => void;
  saveReceipt: (receipt: Omit<ReceiptRecord, "created_at" | "updated_at">) => ReceiptRecord;
  moveToTrash: (id: string) => boolean;
  restoreFromTrash: (id: string) => boolean;
  permanentlyDelete: (id: string) => boolean;
  emptyTrash: () => number;
  saveAction: (action: ActionRecord) => void;
  toggleActionStatus: (id: string) => void;
  saveCollection: (col: CollectionRecord) => void;
  exportEncryptedBackup: (password: string) => Uint8Array;
  restoreFromEncryptedBackup: (bytes: Uint8Array, password: string) => { receiptCount: number; attachmentCount: number };
  queryAssistant: (prompt: string) => Promise<AssistantResponse>;
}

const VaultContext = createContext<VaultContextType | null>(null);

// Shared singleton instance for the app session
const globalVault = new LocalReceiptVault();

// Seed initial realistic data for offline pilot testing
function seedInitialData(vault: LocalReceiptVault) {
  if (vault.listReceipts({ includeTrashed: true }).length > 0) return;

  // Receipt 1: Jollibee Food
  const rec1 = vault.saveReceipt({
    id: "rec_jollibee_01",
    title: "Team Lunch - Jollibee",
    merchant: "Jollibee Foods Corp",
    transaction_date: "2026-09-04",
    currency: "PHP",
    total_minor_units: 48500, // ₱485.00
    subtotal_minor_units: 43304,
    tax_minor_units: 5196,
    document_type: "receipt",
    review_status: "reviewed",
    notes: "Chickenjoy and Peach Mango Pie",
    purpose: "Team lunch meeting",
    tags: ["food", "team"],
    collection_ids: ["col_purchases"],
    is_trashed: false,
    deleted_at: null,
  });

  const dummyBytes1 = new TextEncoder().encode("JOLLIBEE_RECEIPT_IMAGE_CONTENT_SAMPLE");
  vault.saveAttachment(
    {
      id: "att_jollibee_01",
      receipt_id: rec1.id,
      file_name: "jollibee_0904.jpg",
      relative_path: "originals/2026/09/rec_jollibee_01.jpg",
      mime_type: "image/jpeg",
      file_size_bytes: dummyBytes1.length,
      sha256_hash: computeSha256(dummyBytes1),
      page_order: 1,
      ocr_text: "JOLLIBEE FOODS CORP MAKATI BRANCH TOTAL DUE 485.00",
      created_at: new Date().toISOString(),
    },
    dummyBytes1
  );

  // Receipt 2: Mercury Drug (Meds)
  const rec2 = vault.saveReceipt({
    id: "rec_mercury_02",
    title: "Prescription Vitamins",
    merchant: "Mercury Drug",
    transaction_date: "2026-09-05",
    currency: "PHP",
    total_minor_units: 125000, // ₱1,250.00
    subtotal_minor_units: 111607,
    tax_minor_units: 13393,
    document_type: "receipt",
    review_status: "reviewed",
    notes: "Official receipt kept for company HMO claim",
    purpose: "Medical",
    tags: ["medical", "reimbursement"],
    collection_ids: ["col_work"],
    is_trashed: false,
    deleted_at: null,
  });

  const dummyBytes2 = new TextEncoder().encode("MERCURY_DRUG_RECEIPT_IMAGE_CONTENT_SAMPLE");
  vault.saveAttachment(
    {
      id: "att_mercury_02",
      receipt_id: rec2.id,
      file_name: "mercury_0905.jpg",
      relative_path: "originals/2026/09/rec_mercury_02.jpg",
      mime_type: "image/jpeg",
      file_size_bytes: dummyBytes2.length,
      sha256_hash: computeSha256(dummyBytes2),
      page_order: 1,
      ocr_text: "MERCURY DRUG AYALA TOTAL AMOUNT 1250.00",
      created_at: new Date().toISOString(),
    },
    dummyBytes2
  );

  // Action for Receipt 2: HMO Reimbursement Deadline
  vault.saveAction({
    id: "act_hmo_01",
    receipt_id: rec2.id,
    action_type: "reimbursement",
    title: "Submit Mercury Drug receipt to HR for HMO claim",
    due_date: "2026-09-15",
    status: "pending",
    amount_minor_units: 125000,
    currency: "PHP",
    notes: "HR deadline is 15th of the month",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Receipt 3: Unreviewed GCash Payment Screenshot
  const rec3 = vault.saveReceipt({
    id: "rec_gcash_03",
    title: "GCash Transfer",
    merchant: "GCash (Maria S.)",
    transaction_date: "2026-09-06",
    currency: "PHP",
    total_minor_units: 85000, // ₱850.00
    subtotal_minor_units: null,
    tax_minor_units: null,
    document_type: "payment_screenshot",
    review_status: "unreviewed",
    notes: "Payment for water refilling station delivery",
    purpose: "Utilities",
    tags: ["utilities", "screenshot"],
    collection_ids: ["col_utilities"],
    is_trashed: false,
    deleted_at: null,
  });

  const dummyBytes3 = new TextEncoder().encode("GCASH_SCREENSHOT_IMAGE_CONTENT_SAMPLE");
  vault.saveAttachment(
    {
      id: "att_gcash_03",
      receipt_id: rec3.id,
      file_name: "gcash_0906.png",
      relative_path: "originals/2026/09/rec_gcash_03.png",
      mime_type: "image/png",
      file_size_bytes: dummyBytes3.length,
      sha256_hash: computeSha256(dummyBytes3),
      page_order: 1,
      ocr_text: "GCash Transfer Successful Sent to Maria S. Amount PHP 850.00",
      created_at: new Date().toISOString(),
    },
    dummyBytes3
  );

  // Mark initial backup clean status
  vault.markBackupCompleted();
}

seedInitialData(globalVault);

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [actions, setActions] = useState<ActionRecord[]>([]);
  const [stats, setStats] = useState<StorageUsageStats>(globalVault.getStorageUsageStats());

  const refreshState = () => {
    setReceipts(globalVault.listReceipts({ includeTrashed: false }));
    setCollections(globalVault.listCollections());
    setActions(globalVault.listActions());
    setStats(globalVault.getStorageUsageStats());
  };

  useEffect(() => {
    refreshState();
  }, []);

  const saveReceipt = (receipt: Omit<ReceiptRecord, "created_at" | "updated_at">) => {
    const saved = globalVault.saveReceipt(receipt);
    refreshState();
    return saved;
  };

  const moveToTrash = (id: string) => {
    const ok = globalVault.moveToTrash(id);
    refreshState();
    return ok;
  };

  const restoreFromTrash = (id: string) => {
    const ok = globalVault.restoreFromTrash(id);
    refreshState();
    return ok;
  };

  const permanentlyDelete = (id: string) => {
    const ok = globalVault.permanentlyDeleteReceipt(id);
    refreshState();
    return ok;
  };

  const emptyTrash = () => {
    const count = globalVault.emptyTrash();
    refreshState();
    return count;
  };

  const saveAction = (action: ActionRecord) => {
    globalVault.saveAction(action);
    refreshState();
  };

  const toggleActionStatus = (id: string) => {
    const act = globalVault.listActions().find((a: ActionRecord) => a.id === id);
    if (!act) return;
    const newStatus = act.status === "completed" ? "pending" : "completed";
    globalVault.updateActionStatus(id, newStatus);
    refreshState();
  };

  const saveCollection = (col: CollectionRecord) => {
    globalVault.saveCollection(col);
    refreshState();
  };

  const exportEncryptedBackup = (password: string): Uint8Array => {
    const payload = globalVault.getBackupPayload();
    const encrypted = createEncryptedBackup(payload, password);
    globalVault.markBackupCompleted();
    refreshState();
    return encrypted;
  };

  const restoreFromEncryptedBackup = (bytes: Uint8Array, password: string) => {
    const restored = restoreEncryptedBackup(bytes, password);
    globalVault.restoreFromPayload(restored, "overwrite");
    refreshState();
    return {
      receiptCount: restored.manifest.receipt_count,
      attachmentCount: restored.manifest.attachment_count,
    };
  };

  const queryAssistant = async (prompt: string): Promise<AssistantResponse> => {
    const engine = new AskKeeptrailEngine({
      receipts: globalVault.listReceipts({ includeTrashed: false }),
      collections: globalVault.listCollections(),
      actions: globalVault.listActions(),
      isModelAvailable: false, // Honestly labeled Basic Helper on mobile devices without native llama.cpp/Qwen loaded
    });
    return await engine.query(prompt);
  };

  return (
    <VaultContext.Provider
      value={{
        vault: globalVault,
        receipts,
        collections,
        actions,
        stats,
        refreshState,
        saveReceipt,
        moveToTrash,
        restoreFromTrash,
        permanentlyDelete,
        emptyTrash,
        saveAction,
        toggleActionStatus,
        saveCollection,
        exportEncryptedBackup,
        restoreFromEncryptedBackup,
        queryAssistant,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
}

export function useLocalVault() {
  const ctx = useContext(VaultContext);
  if (!ctx) {
    throw new Error("useLocalVault must be used within a VaultProvider");
  }
  return ctx;
}
