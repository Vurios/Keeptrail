/**
 * Covers the L2/L3/S1 additions: at-rest encryption, duplicate suggestions,
 * tags, custom fields, capture drafts, the index migration, and the CSV/PDF
 * report rules.
 */

import { describe, expect, it } from "vitest";
import {
  InMemoryVaultStore,
  LocalReceiptVault,
  VAULT_INDEX_VERSION,
  buildAttachmentPath,
  buildReceiptsCsv,
  buildReceiptsReportHtml,
  bytesStartWithAscii,
  computeSha256,
  createEncryptedBackup,
  restoreEncryptedBackup,
  findAllDuplicateSuggestions,
  generateVaultKey,
  isSealed,
  openBytes,
  openText,
  sealBytes,
  sealText,
  type AttachmentRecord,
  type CaptureDraft,
  type ReceiptRecord,
} from "../index";

function receipt(overrides: Partial<ReceiptRecord> & { id: string }): ReceiptRecord {
  return {
    title: overrides.id,
    merchant: "Test Merchant",
    transaction_date: "2026-09-04",
    currency: "PHP",
    total_minor_units: 10000,
    subtotal_minor_units: null,
    tax_minor_units: null,
    document_type: "receipt",
    review_status: "reviewed",
    notes: null,
    purpose: null,
    tags: [],
    custom_fields: {},
    collection_ids: [],
    is_trashed: false,
    created_at: "2026-09-04T00:00:00.000Z",
    updated_at: "2026-09-04T00:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

function attachment(receiptId: string, hash: string): AttachmentRecord {
  return {
    id: `att_${receiptId}`,
    receipt_id: receiptId,
    file_name: `${receiptId}.jpg`,
    relative_path: buildAttachmentPath(receiptId, ".jpg", new Date("2026-09-04T00:00:00Z")),
    mime_type: "image/jpeg",
    file_size_bytes: 100,
    sha256_hash: hash,
    page_order: 1,
    ocr_text: null,
    created_at: "2026-09-04T00:00:00.000Z",
  };
}

// --- S1: at-rest encryption --------------------------------------------------

describe("at-rest encryption", () => {
  it("round-trips bytes and text under a device key", () => {
    const key = generateVaultKey();
    const payload = new TextEncoder().encode("₱1,579.00 Jollibee 2026-09-04");

    const sealed = sealBytes(key, payload);
    expect(isSealed(sealed)).toBe(true);
    expect(openBytes(key, sealed)).toEqual(payload);

    const sealedText = sealText(key, '{"receipts":[]}');
    expect(openText(key, sealedText)).toBe('{"receipts":[]}');
  });

  it("does not leave plaintext visible in the sealed blob", () => {
    const key = generateVaultKey();
    const sealed = sealBytes(key, new TextEncoder().encode("Mercury Drug"));
    expect(Buffer.from(sealed).toString("utf8")).not.toContain("Mercury Drug");
  });

  it("produces a different blob each time, so equal records are not linkable", () => {
    const key = generateVaultKey();
    const plaintext = new TextEncoder().encode("same content");
    expect(Buffer.from(sealBytes(key, plaintext)).toString("hex")).not.toBe(
      Buffer.from(sealBytes(key, plaintext)).toString("hex"),
    );
  });

  it("refuses a wrong key rather than returning garbage", () => {
    const sealed = sealBytes(generateVaultKey(), new TextEncoder().encode("secret"));
    expect(() => openBytes(generateVaultKey(), sealed)).toThrow(/could not be decrypted/i);
  });

  it("refuses tampered data", () => {
    const key = generateVaultKey();
    const sealed = sealBytes(key, new TextEncoder().encode("secret"));
    const index = sealed.length - 1;
    sealed[index] = (sealed[index] ?? 0) ^ 0xff;
    expect(() => openBytes(key, sealed)).toThrow();
  });

  it("rejects a key of the wrong length", () => {
    expect(() => sealBytes(new Uint8Array(16), new Uint8Array(1))).toThrow(/32 bytes/);
  });
});

// --- L2: index migration -----------------------------------------------------

describe("index migration", () => {
  it("opens a v1 index and fills in the fields v2 added", () => {
    const store = new InMemoryVaultStore();
    // A v1 index: no tags, no custom fields, no drafts, no definitions.
    store.writeIndex(
      new TextEncoder().encode(
        JSON.stringify({
          version: 1,
          receipts: [
            {
              id: "rec_legacy",
              title: "Legacy",
              merchant: "Old Merchant",
              transaction_date: "2026-01-01",
              currency: "PHP",
              total_minor_units: 12345,
              subtotal_minor_units: null,
              tax_minor_units: null,
              document_type: "receipt",
              review_status: "reviewed",
              notes: null,
              purpose: null,
              collection_ids: ["col_purchases"],
              is_trashed: false,
              created_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-01T00:00:00.000Z",
              deleted_at: null,
            },
          ],
          attachments: [],
          collections: [],
          actions: [],
          last_backup_timestamp: null,
          records_modified_since_backup: 0,
        }),
      ),
    );

    const vault = new LocalReceiptVault(store);
    const migrated = vault.getReceipt("rec_legacy");

    expect(migrated).not.toBeNull();
    expect(migrated?.merchant).toBe("Old Merchant");
    expect(migrated?.total_minor_units).toBe(12345);
    expect(migrated?.tags).toEqual([]);
    expect(migrated?.custom_fields).toEqual({});

    // The upgrade is written back once, not recomputed every launch.
    const persisted = JSON.parse(new TextDecoder().decode(store.readIndex()!));
    expect(persisted.version).toBe(VAULT_INDEX_VERSION);
  });

  it("refuses an index from a newer build instead of silently dropping fields", () => {
    const store = new InMemoryVaultStore();
    store.writeIndex(
      new TextEncoder().encode(JSON.stringify({ version: VAULT_INDEX_VERSION + 1, receipts: [] })),
    );
    expect(() => new LocalReceiptVault(store)).toThrow(/newer version/i);
  });
});

// --- L2: tags ----------------------------------------------------------------

describe("tags", () => {
  it("de-duplicates case-insensitively and keeps the first spelling", () => {
    const vault = new LocalReceiptVault(new InMemoryVaultStore());
    vault.saveReceipt(receipt({ id: "rec_tagged" }));
    vault.setReceiptTags("rec_tagged", ["Warranty", "  warranty ", "", "Travel"]);

    expect(vault.getReceipt("rec_tagged")?.tags).toEqual(["Warranty", "Travel"]);
  });

  it("counts tag usage across active receipts only", () => {
    const vault = new LocalReceiptVault(new InMemoryVaultStore());
    vault.saveReceipt(receipt({ id: "a", tags: ["work"] }));
    vault.saveReceipt(receipt({ id: "b", tags: ["work", "travel"] }));
    vault.saveReceipt(receipt({ id: "c", tags: ["work"] }));
    vault.moveToTrash("c");

    expect(vault.listTags()).toEqual([
      { tag: "work", count: 2 },
      { tag: "travel", count: 1 },
    ]);
  });

  it("finds a receipt by tag through search", () => {
    const vault = new LocalReceiptVault(new InMemoryVaultStore());
    vault.saveReceipt(receipt({ id: "rec_tag", tags: ["warranty"] }));
    expect(vault.listReceipts({ searchQuery: "warranty" }).map((r) => r.id)).toEqual(["rec_tag"]);
  });
});

// --- L2: custom fields -------------------------------------------------------

describe("custom fields", () => {
  it("stores values only for defined fields", () => {
    const vault = new LocalReceiptVault(new InMemoryVaultStore());
    vault.saveCustomFieldDefinition({
      id: "cf_warranty",
      label: "Warranty ends",
      field_type: "date",
      created_at: "2026-09-04T00:00:00.000Z",
    });
    vault.saveReceipt(receipt({ id: "rec_cf" }));

    vault.setReceiptCustomFields("rec_cf", {
      cf_warranty: "2028-09-04",
      cf_unknown: "should be dropped",
    });

    expect(vault.getReceipt("rec_cf")?.custom_fields).toEqual({ cf_warranty: "2028-09-04" });
  });

  it("drops empty values rather than storing blanks", () => {
    const vault = new LocalReceiptVault(new InMemoryVaultStore());
    vault.saveCustomFieldDefinition({
      id: "cf_ref",
      label: "Claim reference",
      field_type: "text",
      created_at: "2026-09-04T00:00:00.000Z",
    });
    vault.saveReceipt(receipt({ id: "rec_blank" }));
    vault.setReceiptCustomFields("rec_blank", { cf_ref: "   " });
    expect(vault.getReceipt("rec_blank")?.custom_fields).toEqual({});
  });

  it("removes stored values when a definition is deleted", () => {
    const vault = new LocalReceiptVault(new InMemoryVaultStore());
    vault.saveCustomFieldDefinition({
      id: "cf_temp",
      label: "Temporary",
      field_type: "text",
      created_at: "2026-09-04T00:00:00.000Z",
    });
    vault.saveReceipt(receipt({ id: "rec_x" }));
    vault.setReceiptCustomFields("rec_x", { cf_temp: "value" });

    vault.deleteCustomFieldDefinition("cf_temp");

    expect(vault.listCustomFieldDefinitions()).toEqual([]);
    expect(vault.getReceipt("rec_x")?.custom_fields).toEqual({});
  });

  it("preserves values through an edit that does not mention them", () => {
    const vault = new LocalReceiptVault(new InMemoryVaultStore());
    vault.saveCustomFieldDefinition({
      id: "cf_keep",
      label: "Keep me",
      field_type: "text",
      created_at: "2026-09-04T00:00:00.000Z",
    });
    vault.saveReceipt(receipt({ id: "rec_edit" }));
    vault.setReceiptCustomFields("rec_edit", { cf_keep: "still here" });

    // An editor with no custom-field UI saves the receipt again, omitting the
    // property entirely rather than passing an empty object.
    const withoutCustomFields: Record<string, unknown> = {
      ...receipt({ id: "rec_edit", merchant: "Renamed" }),
    };
    delete withoutCustomFields.custom_fields;
    vault.saveReceipt(withoutCustomFields as Parameters<typeof vault.saveReceipt>[0]);

    expect(vault.getReceipt("rec_edit")?.merchant).toBe("Renamed");
    expect(vault.getReceipt("rec_edit")?.custom_fields).toEqual({ cf_keep: "still here" });
  });
});

// --- L2: capture drafts ------------------------------------------------------

describe("capture drafts survive process death", () => {
  function draft(id: string): CaptureDraft {
    return {
      id,
      merchant: "Half typed",
      transaction_date: "2026-09-06",
      amount: "302.40",
      currency: "PHP",
      document_type: "receipt",
      purpose: "",
      notes: "",
      tags: [],
      collection_ids: [],
      attachment_relative_path: "originals/2026/09/draft.jpg",
      attachment_file_name: "draft.jpg",
      attachment_mime_type: "image/jpeg",
      attachment_sha256: "abc",
      attachment_size_bytes: 10,
      source_text: null,
      unconfirmed_fields: ["amount"],
      created_at: "2026-09-06T00:00:00.000Z",
      updated_at: "2026-09-06T00:00:00.000Z",
    };
  }

  it("reloads a draft and its original after a relaunch", () => {
    const store = new InMemoryVaultStore();
    const first = new LocalReceiptVault(store);
    store.writeAttachment("originals/2026/09/draft.jpg", new Uint8Array([1, 2, 3]));
    first.saveDraft(draft("draft_1"));

    const relaunched = new LocalReceiptVault(store);
    const recovered = relaunched.getDraft("draft_1");

    expect(recovered?.merchant).toBe("Half typed");
    expect(recovered?.amount).toBe("302.40");
    expect(relaunched.getFileBytes("originals/2026/09/draft.jpg")).toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });

  it("cleans up the orphaned original when a draft is abandoned", () => {
    const store = new InMemoryVaultStore();
    const vault = new LocalReceiptVault(store);
    store.writeAttachment("originals/2026/09/draft.jpg", new Uint8Array([1]));
    vault.saveDraft(draft("draft_2"));

    vault.discardDraft("draft_2", false);

    expect(vault.getDraft("draft_2")).toBeNull();
    expect(store.readAttachment("originals/2026/09/draft.jpg")).toBeNull();
  });

  it("keeps the original when the draft was committed to a receipt", () => {
    const store = new InMemoryVaultStore();
    const vault = new LocalReceiptVault(store);
    store.writeAttachment("originals/2026/09/draft.jpg", new Uint8Array([1]));
    vault.saveDraft(draft("draft_3"));

    vault.discardDraft("draft_3", true);

    expect(store.readAttachment("originals/2026/09/draft.jpg")).not.toBeNull();
  });
});

// --- L2: duplicate suggestions ----------------------------------------------

describe("duplicate suggestions", () => {
  it("reports an identical attachment as certain, not as a guess", () => {
    const bytes = new TextEncoder().encode("same photo");
    const hash = computeSha256(bytes);
    const attachments = new Map([
      ["rec_1", [attachment("rec_1", hash)]],
      ["rec_2", [attachment("rec_2", hash)]],
    ]);

    const found = findAllDuplicateSuggestions(
      [receipt({ id: "rec_1" }), receipt({ id: "rec_2", merchant: "Different name" })],
      attachments,
    );

    expect(found).toHaveLength(1);
    expect(found[0]?.confidence).toBe("identical_file");
  });

  it("suggests same merchant, amount and date as likely", () => {
    const found = findAllDuplicateSuggestions(
      [
        receipt({ id: "a", merchant: "Jollibee", total_minor_units: 48500 }),
        receipt({ id: "b", merchant: "JOLLIBEE  ", total_minor_units: 48500 }),
      ],
      new Map(),
    );
    expect(found).toHaveLength(1);
    expect(found[0]?.confidence).toBe("likely");
  });

  it("does not treat two unknown amounts as evidence of anything", () => {
    const found = findAllDuplicateSuggestions(
      [
        receipt({ id: "a", total_minor_units: null }),
        receipt({ id: "b", total_minor_units: null }),
      ],
      new Map(),
    );
    expect(found).toEqual([]);
  });

  it("does not match across currencies", () => {
    const found = findAllDuplicateSuggestions(
      [
        receipt({ id: "a", currency: "PHP", total_minor_units: 5000 }),
        receipt({ id: "b", currency: "USD", total_minor_units: 5000 }),
      ],
      new Map(),
    );
    expect(found).toEqual([]);
  });

  it("ignores trashed receipts", () => {
    const found = findAllDuplicateSuggestions(
      [receipt({ id: "a" }), receipt({ id: "b", is_trashed: true })],
      new Map(),
    );
    expect(found).toEqual([]);
  });

  it("reports each pair once, not twice", () => {
    const vault = new LocalReceiptVault(new InMemoryVaultStore());
    vault.saveReceipt(receipt({ id: "a", merchant: "Shell", total_minor_units: 250000 }));
    vault.saveReceipt(receipt({ id: "b", merchant: "Shell", total_minor_units: 250000 }));
    expect(vault.findAllDuplicates()).toHaveLength(1);
  });

  it("never mutates the vault", () => {
    const vault = new LocalReceiptVault(new InMemoryVaultStore());
    vault.saveReceipt(receipt({ id: "a", merchant: "Shell", total_minor_units: 250000 }));
    vault.saveReceipt(receipt({ id: "b", merchant: "Shell", total_minor_units: 250000 }));
    vault.findAllDuplicates();
    expect(vault.listReceipts()).toHaveLength(2);
  });
});

// --- L3: reports -------------------------------------------------------------

describe("CSV export", () => {
  const collections = [
    {
      id: "col_work",
      name: "Work",
      color: "#146B55",
      icon: "briefcase",
      description: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ];

  it("neutralises spreadsheet formula injection", () => {
    const csv = buildReceiptsCsv(
      [receipt({ id: "rec_evil", merchant: "=SUM(A1:A9)", notes: "@cmd|calc" })],
      collections,
    );
    expect(csv).toContain('"\'=SUM(A1:A9)"');
    expect(csv).toContain('"\'@cmd|calc"');
  });

  it("leaves an unknown amount empty rather than writing zero", () => {
    const csv = buildReceiptsCsv([receipt({ id: "rec_u", total_minor_units: null })], collections);
    const dataLine = csv.split("\r\n")[1] ?? "";
    expect(dataLine).toContain('"",""');
    expect(dataLine).not.toContain('"0"');
  });

  it("writes one row per receipt however many collections it is in", () => {
    const csv = buildReceiptsCsv(
      [receipt({ id: "rec_multi", collection_ids: ["col_work", "col_work"] })],
      collections,
    );
    const dataLines = csv.trim().split("\r\n").slice(1);
    expect(dataLines).toHaveLength(1);
  });

  it("exports the exact integer alongside the formatted figure", () => {
    const csv = buildReceiptsCsv([receipt({ id: "r", total_minor_units: 157900 })], collections);
    expect(csv).toContain('"157900"');
    expect(csv).toContain("₱1,579.00");
  });
});

describe("PDF report HTML", () => {
  it("separates currencies and never sums them", () => {
    const html = buildReceiptsReportHtml(
      [
        receipt({ id: "a", currency: "PHP", total_minor_units: 100000 }),
        receipt({ id: "b", currency: "USD", total_minor_units: 5000 }),
      ],
      [],
      { title: "All receipts", includesUnreviewed: true },
    );
    expect(html).toContain("₱1,000.00");
    expect(html).toContain("$50.00");
    expect(html).toContain("never added together");
  });

  it("states how many receipts were excluded for having no amount", () => {
    const html = buildReceiptsReportHtml(
      [receipt({ id: "a" }), receipt({ id: "b", total_minor_units: null })],
      [],
      { title: "Report", includesUnreviewed: true },
    );
    expect(html).toContain("1 receipt(s) have no recorded amount");
  });

  it("escapes user text into the document", () => {
    const html = buildReceiptsReportHtml(
      [receipt({ id: "a", merchant: "<script>alert(1)</script>" })],
      [],
      { title: "Report", includesUnreviewed: true },
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("counts a receipt once even when passed twice", () => {
    const one = receipt({ id: "dupe", total_minor_units: 10000 });
    const html = buildReceiptsReportHtml([one, { ...one }], [], {
      title: "Report",
      includesUnreviewed: true,
    });
    expect(html).toContain("Receipts (1)");
  });
});

// --- Portability of the on-disk headers --------------------------------------

describe("header checks do not depend on Buffer.subarray behaviour", () => {
  it("recognises a sealed blob from a plain Uint8Array", () => {
    const sealed = sealBytes(generateVaultKey(), new TextEncoder().encode("x"));
    // A copy with no Buffer prototype at all: this is what the React Native
    // polyfill hands back from `subarray`, and what broke the magic check on
    // device while every in-memory test passed.
    const plain = Uint8Array.from(sealed);
    expect(isSealed(plain)).toBe(true);
  });

  it("matches an ASCII marker byte by byte", () => {
    expect(bytesStartWithAscii(new TextEncoder().encode("KTS1rest"), "KTS1")).toBe(true);
    expect(bytesStartWithAscii(new TextEncoder().encode("NOPE"), "KTS1")).toBe(false);
    expect(bytesStartWithAscii(new Uint8Array(2), "KTS1")).toBe(false);
  });

  it("opens a sealed blob that arrives as a plain Uint8Array", () => {
    const key = generateVaultKey();
    const sealed = sealBytes(key, new TextEncoder().encode("receipt data"));
    const plain = Uint8Array.from(sealed);
    expect(new TextDecoder().decode(openBytes(key, plain))).toBe("receipt data");
  });

  it("reads a backup archive that arrives as a plain Uint8Array", () => {
    const archive = createEncryptedBackup(
      { receipts: [], attachments: [], collections: [], actions: [], files: {} },
      "a good password",
    );
    const plain = Uint8Array.from(archive);
    expect(restoreEncryptedBackup(plain, "a good password").receipts).toEqual([]);
  });
});
