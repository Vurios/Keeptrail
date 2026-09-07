import { describe, it, expect } from "vitest";
import { colors, spacing, borderRadius, typography } from "../theme/tokens";
import { haptics } from "../utils/haptics";
import {
  LocalReceiptVault,
  calculateReceiptTotals,
  formatMoney,
  parseMoneyToMinorUnits,
  createEncryptedBackup,
  restoreEncryptedBackup,
} from "@katibay/shared";

describe("Mobile App Theme & Accessibility Tokens", () => {
  it("enforces minimum touch target of 48 logical units for all controls", () => {
    expect(spacing.thumb).toBeGreaterThanOrEqual(48);
    expect(spacing.buttonHeight).toBeGreaterThanOrEqual(48);
  });

  it("contains complete light and dark palette definitions", () => {
    expect(colors.brand.primary).toBe("#146B55");
    expect(colors.dark.primary).toBe("#8DDBB0");
    expect(colors.brand.background).toBe("#F7F8F4");
    expect(colors.dark.background).toBe("#111A16");
    expect(colors.brand.surface).toBe("#FFFFFF");
    expect(colors.dark.surface).toBe("#1B2922");
  });

  it("defines legible typography scale for body and headings", () => {
    expect(typography.body.fontSize).toBeGreaterThanOrEqual(16);
    expect(typography.heading2.fontSize).toBe(18);
    expect(typography.sectionTitle.fontSize).toBe(20);
    expect(typography.mainTitle.fontSize).toBe(28);
  });
});

describe("Mobile Local Vault Operations", () => {
  it("saves receipt records into local vault and calculates exact totals", () => {
    const vault = new LocalReceiptVault();
    vault.saveReceipt({
      id: "test_rec_1",
      title: "Cafe Mocha",
      merchant: "Highland Coffee",
      transaction_date: "2026-09-07",
      currency: "PHP",
      total_minor_units: 17500, // ₱175.00
      subtotal_minor_units: null,
      tax_minor_units: null,
      document_type: "receipt",
      review_status: "reviewed",
      notes: "Met with client",
      purpose: "Business Meeting",
      tags: ["client", "coffee"],
      collection_ids: ["col_work"],
      is_trashed: false,
      deleted_at: null,
    });

    const receipts = vault.listReceipts({ trashScope: "active" });
    expect(receipts).toHaveLength(1);
    expect(receipts[0].merchant).toBe("Highland Coffee");

    const totals = calculateReceiptTotals(receipts);
    expect(totals.currencies["PHP"].total_minor_units).toBe(17500);
    expect(totals.currencies["PHP"].formatted).toBe("₱175.00");
  });

  it("handles soft-delete trash and restore flow without data loss", () => {
    const vault = new LocalReceiptVault();
    const r = vault.saveReceipt({
      id: "trash_test",
      title: "Grocery Run",
      merchant: "Robinsons Supermarket",
      transaction_date: "2026-09-07",
      currency: "PHP",
      total_minor_units: 245000,
      subtotal_minor_units: null,
      tax_minor_units: null,
      document_type: "receipt",
      review_status: "reviewed",
      notes: null,
      purpose: null,
      tags: [],
      collection_ids: [],
      is_trashed: false,
      deleted_at: null,
    });

    // Move to trash
    expect(vault.moveToTrash(r.id)).toBe(true);
    expect(vault.listReceipts({ trashScope: "active" })).toHaveLength(0);
    expect(vault.listReceipts({ trashScope: "trashed" })).toHaveLength(1);

    // Restore
    expect(vault.restoreFromTrash(r.id)).toBe(true);
    expect(vault.listReceipts({ trashScope: "active" })).toHaveLength(1);
  });

  it("exports and restores AES-256-GCM encrypted backup containers", () => {
    const vault = new LocalReceiptVault();
    vault.saveReceipt({
      id: "backup_rec_01",
      title: "Hardware Tools",
      merchant: "True Value",
      transaction_date: "2026-09-07",
      currency: "PHP",
      total_minor_units: 320000,
      subtotal_minor_units: null,
      tax_minor_units: null,
      document_type: "receipt",
      review_status: "reviewed",
      notes: null,
      purpose: null,
      tags: [],
      collection_ids: [],
      is_trashed: false,
      deleted_at: null,
    });

    const payload = vault.getBackupPayload();
    const encrypted = createEncryptedBackup(payload, "securePassword123");
    expect(encrypted.length).toBeGreaterThan(100);

    const restored = restoreEncryptedBackup(encrypted, "securePassword123");
    expect(restored.manifest.receipt_count).toBe(1);
    expect(restored.receipts[0].merchant).toBe("True Value");
  });
});

describe("Haptics Utility Safety", () => {
  it("invokes haptics methods safely without throwing", () => {
    expect(() => haptics.tap()).not.toThrow();
    expect(() => haptics.success()).not.toThrow();
    expect(() => haptics.warning()).not.toThrow();
    expect(() => haptics.error()).not.toThrow();
  });
});

describe("Receipt Editing Integrity & Robust Input Parsing", () => {
  it("updates receipt title and details without corrupting existing vault record", () => {
    const vault = new LocalReceiptVault();
    const original = vault.saveReceipt({
      id: "edit_test_1",
      title: "Jollibee",
      merchant: "Jollibee Foods Corp",
      transaction_date: "2026-09-04",
      currency: "PHP",
      total_minor_units: 48500,
      subtotal_minor_units: 43304,
      tax_minor_units: 5196,
      document_type: "receipt",
      review_status: "reviewed",
      notes: "Lunch",
      purpose: "Team",
      tags: ["food"],
      collection_ids: ["col_purchases"],
      is_trashed: false,
      deleted_at: null,
    });

    const parsedAmount = parseMoneyToMinorUnits("520.50", "PHP");
    const updated = vault.saveReceipt({
      ...original,
      title: "Jollibee BGC",
      merchant: "Jollibee BGC",
      total_minor_units: parsedAmount,
      notes: "Updated lunch notes",
    });

    expect(updated.title).toBe("Jollibee BGC");
    expect(updated.merchant).toBe("Jollibee BGC");
    expect(updated.total_minor_units).toBe(52050);
    expect(updated.subtotal_minor_units).toBe(43304);
    expect(updated.created_at).toBe(original.created_at);
  });

  it("handles empty or blank amount strings cleanly without throwing NaN", () => {
    const emptyParsed = parseMoneyToMinorUnits("", "PHP");
    expect(emptyParsed).toBeNull();

    const whitespaceParsed = parseMoneyToMinorUnits("   ", "PHP");
    expect(whitespaceParsed).toBeNull();

    const formattedClean = formatMoney(null, "PHP");
    expect(formattedClean).toBe("Unknown");
  });
});
