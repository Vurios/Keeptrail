import { describe, it, expect } from "vitest";
import { Buffer } from "buffer";
import { LocalReceiptVault } from "./local-vault";
import { createEncryptedBackup, restoreEncryptedBackup, computeSha256 } from "./backup-encryption";
import type { ReceiptRecord, AttachmentRecord } from "./types";

describe("L2 & L5: Local Vault & Encrypted Backup/Restore Engine", () => {
  it("manages receipts, attachments, collections, and trash lifecycle", () => {
    const vault = new LocalReceiptVault();

    // 1. Add receipt
    const receipt: Omit<ReceiptRecord, "created_at" | "updated_at"> = {
      id: "rec_alpha",
      title: "Grocery trip",
      merchant: "Puregold",
      transaction_date: "2026-09-04",
      currency: "PHP",
      total_minor_units: 85050,
      subtotal_minor_units: null,
      tax_minor_units: null,
      document_type: "receipt",
      review_status: "unreviewed",
      notes: "Weekly snacks",
      purpose: "Personal",
      tags: ["food"],
      custom_fields: {},
      collection_ids: ["col_purchases"],
      is_trashed: false,
      deleted_at: null,
    };

    vault.saveReceipt(receipt);
    expect(vault.getReceipt("rec_alpha")?.merchant).toBe("Puregold");

    // 2. Add attachment with binary file bytes
    const dummyImageBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x01, 0x02, 0x03]);
    const hash = computeSha256(dummyImageBytes);

    const attachment: AttachmentRecord = {
      id: "att_1",
      receipt_id: "rec_alpha",
      file_name: "receipt_pg.jpg",
      relative_path: "originals/2026/09/rec_alpha.jpg",
      mime_type: "image/jpeg",
      file_size_bytes: dummyImageBytes.length,
      sha256_hash: hash,
      page_order: 1,
      ocr_text: "PUREGOLD PRICE CLUB",
      created_at: new Date().toISOString(),
    };

    vault.saveAttachment(attachment, dummyImageBytes);
    expect(vault.getAttachmentsForReceipt("rec_alpha").length).toBe(1);
    expect(vault.getFileBytes("originals/2026/09/rec_alpha.jpg")).toEqual(dummyImageBytes);

    // 3. Verify storage stats
    const stats = vault.getStorageUsageStats();
    expect(stats.receiptCount).toBe(1);
    expect(stats.unreviewedCount).toBe(1);
    expect(stats.attachmentCount).toBe(1);
    expect(stats.totalAttachmentBytes).toBe(dummyImageBytes.length);
    expect(stats.recordsModifiedSinceLastBackup).toBeGreaterThan(0);

    // 4. Test Trash workflow
    vault.moveToTrash("rec_alpha");
    expect(vault.listReceipts({ trashScope: "active" }).length).toBe(0);
    expect(vault.listReceipts({ trashScope: "trashed" }).length).toBe(1);

    vault.restoreFromTrash("rec_alpha");
    expect(vault.listReceipts({ trashScope: "active" }).length).toBe(1);
  });

  it("creates encrypted .keeptrail backup and restores with integrity verification", () => {
    const vault = new LocalReceiptVault();

    const sampleReceipt: Omit<ReceiptRecord, "created_at" | "updated_at"> = {
      id: "rec_beta",
      title: "Hard drive",
      merchant: "PC Express",
      transaction_date: "2026-09-05",
      currency: "PHP",
      total_minor_units: 320000,
      subtotal_minor_units: null,
      tax_minor_units: null,
      document_type: "receipt",
      review_status: "reviewed",
      notes: "2TB External SSD",
      purpose: "Tech backup",
      tags: ["hardware"],
      custom_fields: {},
      collection_ids: ["col_purchases"],
      is_trashed: false,
      deleted_at: null,
    };

    vault.saveReceipt(sampleReceipt);

    const fileContent = new TextEncoder().encode("MOCK_RECEIPT_IMAGE_CONTENT_BYTES_12345");
    const fileHash = computeSha256(fileContent);

    vault.saveAttachment(
      {
        id: "att_beta",
        receipt_id: "rec_beta",
        file_name: "pc_express.jpg",
        relative_path: "originals/rec_beta.jpg",
        mime_type: "image/jpeg",
        file_size_bytes: fileContent.length,
        sha256_hash: fileHash,
        page_order: 1,
        ocr_text: "PC Express Total 3200.00",
        created_at: new Date().toISOString(),
      },
      fileContent,
    );

    const payload = vault.getBackupPayload();
    const backupPassword = "UserSecretPass123!";

    // Create encrypted archive
    const encryptedArchive = createEncryptedBackup(payload, backupPassword);
    expect(encryptedArchive.length).toBeGreaterThan(100);

    // Verify header
    const magic = Buffer.from(encryptedArchive.subarray(0, 9)).toString("ascii");
    expect(magic).toBe("KEEPTRAIL");

    // Restore with correct password
    const restored = restoreEncryptedBackup(encryptedArchive, backupPassword);
    expect(restored.manifest.receipt_count).toBe(1);
    expect(restored.manifest.attachment_count).toBe(1);
    expect(restored.receipts[0]?.merchant).toBe("PC Express");
    expect(restored.files["originals/rec_beta.jpg"]).toEqual(fileContent);

    // Restore into fresh Vault
    const freshVault = new LocalReceiptVault();
    freshVault.restoreFromPayload(restored, "overwrite");

    expect(freshVault.getReceipt("rec_beta")?.merchant).toBe("PC Express");
    expect(freshVault.getFileBytes("originals/rec_beta.jpg")).toEqual(fileContent);
    expect(freshVault.getStorageUsageStats().recordsModifiedSinceLastBackup).toBe(0);
  });

  it("fails restoration cleanly when wrong password is supplied", () => {
    const vault = new LocalReceiptVault();
    vault.saveReceipt({
      id: "rec_1",
      title: "Test",
      merchant: "Test",
      transaction_date: null,
      currency: null,
      total_minor_units: null,
      subtotal_minor_units: null,
      tax_minor_units: null,
      document_type: "receipt",
      review_status: "unreviewed",
      notes: null,
      purpose: null,
      tags: [],
      custom_fields: {},
      collection_ids: [],
      is_trashed: false,
      deleted_at: null,
    });

    const encrypted = createEncryptedBackup(vault.getBackupPayload(), "correct-pass");

    expect(() => {
      restoreEncryptedBackup(encrypted, "wrong-password");
    }).toThrow("Decryption failed: Incorrect password or corrupted backup file.");
  });

  it("fails restoration when archive payload has been tampered with or corrupted", () => {
    const vault = new LocalReceiptVault();
    vault.saveReceipt({
      id: "rec_1",
      title: "Test",
      merchant: "Test",
      transaction_date: null,
      currency: null,
      total_minor_units: null,
      subtotal_minor_units: null,
      tax_minor_units: null,
      document_type: "receipt",
      review_status: "unreviewed",
      notes: null,
      purpose: null,
      tags: [],
      custom_fields: {},
      collection_ids: [],
      is_trashed: false,
      deleted_at: null,
    });

    const encrypted = createEncryptedBackup(vault.getBackupPayload(), "password123");

    // Corrupt one byte in ciphertext
    const corrupted = new Uint8Array(encrypted);
    corrupted[corrupted.length - 10]! ^= 0xff;

    expect(() => {
      restoreEncryptedBackup(corrupted, "password123");
    }).toThrow();
  });
});
