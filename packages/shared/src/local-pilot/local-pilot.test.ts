import { describe, it, expect } from "vitest";
import {
  formatMoney,
  parseMoneyToMinorUnits,
  calculateReceiptTotals,
  sanitizeForExport,
} from "./deterministic-money";
import { extractReceiptFromText } from "./ocr-extractor";
import { AskKeeptrailEngine } from "./assistant-engine";
import type { ReceiptRecord, ActionRecord, CollectionRecord } from "./types";

describe("L1: Deterministic Money Tools", () => {
  it("formats integer minor units to locale currency strings without rounding drift", () => {
    expect(formatMoney(157900, "PHP")).toBe("₱1,579.00");
    expect(formatMoney(2550, "USD")).toBe("$25.50");
    expect(formatMoney(500, "JPY")).toBe("¥500");
    expect(formatMoney(null, "PHP")).toBe("Unknown");
    expect(formatMoney(undefined, "USD")).toBe("Unknown");
  });

  it("parses user input strings into exact integer minor units", () => {
    expect(parseMoneyToMinorUnits("₱1,579.00", "PHP")).toBe(157900);
    expect(parseMoneyToMinorUnits("25.50", "USD")).toBe(2550);
    expect(parseMoneyToMinorUnits("1,000", "PHP")).toBe(100000);
    expect(parseMoneyToMinorUnits("", "PHP")).toBeNull();
    expect(parseMoneyToMinorUnits("invalid", "PHP")).toBeNull();
  });

  it("strictly segregates multiple currencies and keeps unknown amounts null", () => {
    const receipts: ReceiptRecord[] = [
      {
        id: "rec_1",
        title: "Groceries",
        merchant: "SM Supermarket",
        transaction_date: "2026-09-01",
        currency: "PHP",
        total_minor_units: 157900,
        subtotal_minor_units: 141000,
        tax_minor_units: 16900,
        document_type: "receipt",
        review_status: "reviewed",
        notes: null,
        purpose: "Pantry",
        tags: ["food"],
        collection_ids: ["col_1"],
        is_trashed: false,
        created_at: "2026-09-01T10:00:00Z",
        updated_at: "2026-09-01T10:00:00Z",
        deleted_at: null,
      },
      {
        id: "rec_2",
        title: "Pharmacy",
        merchant: "Mercury Drug",
        transaction_date: "2026-09-02",
        currency: "PHP",
        total_minor_units: 42000,
        subtotal_minor_units: 37500,
        tax_minor_units: 4500,
        document_type: "receipt",
        review_status: "unreviewed",
        notes: null,
        purpose: "Meds",
        tags: ["health"],
        collection_ids: ["col_1"],
        is_trashed: false,
        created_at: "2026-09-02T10:00:00Z",
        updated_at: "2026-09-02T10:00:00Z",
        deleted_at: null,
      },
      {
        id: "rec_3",
        title: "Cloud hosting domain",
        merchant: "Namecheap",
        transaction_date: "2026-09-03",
        currency: "USD",
        total_minor_units: 1200, // $12.00
        subtotal_minor_units: 1200,
        tax_minor_units: 0,
        document_type: "invoice",
        review_status: "reviewed",
        notes: null,
        purpose: "Tech",
        tags: ["tech"],
        collection_ids: [],
        is_trashed: false,
        created_at: "2026-09-03T10:00:00Z",
        updated_at: "2026-09-03T10:00:00Z",
        deleted_at: null,
      },
      {
        id: "rec_4",
        title: "Unreadable paper",
        merchant: null,
        transaction_date: "2026-09-04",
        currency: "PHP",
        total_minor_units: null, // Unknown amount!
        subtotal_minor_units: null,
        tax_minor_units: null,
        document_type: "receipt",
        review_status: "unreviewed",
        notes: "Ink faded",
        purpose: null,
        tags: [],
        collection_ids: [],
        is_trashed: false,
        created_at: "2026-09-04T10:00:00Z",
        updated_at: "2026-09-04T10:00:00Z",
        deleted_at: null,
      },
    ];

    const totals = calculateReceiptTotals(receipts);

    // Rule 3: Never combine PHP and USD
    expect(totals.currencies["PHP"]!.total_minor_units).toBe(199900); // 157900 + 42000
    expect(totals.currencies["PHP"]!.formatted).toBe("₱1,999.00");
    expect(totals.currencies["PHP"]!.record_count).toBe(2);

    expect(totals.currencies["USD"]!.total_minor_units).toBe(1200);
    expect(totals.currencies["USD"]!.formatted).toBe("$12.00");
    expect(totals.currencies["USD"]!.record_count).toBe(1);

    // Rule 2: Unknown amounts stay null and are tracked explicitly
    expect(totals.total_records_unknown_amount).toBe(1);
    expect(totals.total_records_reviewed).toBe(2);
    expect(totals.total_records_unreviewed).toBe(2);
  });

  it("sanitizes CSV formula injection attempts", () => {
    expect(sanitizeForExport("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
    expect(sanitizeForExport("+12345")).toBe("'+12345");
    expect(sanitizeForExport("-500")).toBe("'-500");
    expect(sanitizeForExport("@CMD")).toBe("'@CMD");
    expect(sanitizeForExport("Jollibee Food Corp")).toBe("Jollibee Food Corp");
  });
});

describe("L1: On-Device Receipt Extractor", () => {
  it("extracts merchant, date, currency, and amounts from raw receipt text", () => {
    const sampleReceipt = `
      JOLLIBEE FOODS CORPORATION
      BRANCH 1024 MAKATI
      TIN: 000-123-456-789
      DATE: 2026-09-05
      
      1 1PC CHICKENJOY W/ RICE    120.00
      1 PEACH MANGO PIE            45.00
      SUBTOTAL                    165.00
      VAT 12%                      19.80
      TOTAL AMOUNT DUE          ₱ 184.80
      
      THANK YOU FOR DINING WITH US!
    `;

    const extracted = extractReceiptFromText(sampleReceipt);

    expect(extracted.merchant).toBe("JOLLIBEE FOODS CORPORATION");
    expect(extracted.transaction_date).toBe("2026-09-05");
    expect(extracted.currency).toBe("PHP");
    expect(extracted.total_minor_units).toBe(18480);
    expect(extracted.subtotal_minor_units).toBe(16500);
    expect(extracted.tax_minor_units).toBe(1980);
    expect(extracted.document_type).toBe("receipt");
    expect(extracted.date_is_ambiguous).toBe(false);
    expect(extracted.arithmetic_matches).toBe(true);
  });

  it("detects payment screenshots and ambiguous dates", () => {
    const paymentScreenshot = `
      GCash
      Transfer Successful
      Sent to: Maria Santos
      09171234567
      Ref No. 123456789
      Date: 05/06/2026
      Amount: PHP 1,250.00
    `;

    const extracted = extractReceiptFromText(paymentScreenshot);

    expect(extracted.document_type).toBe("payment_screenshot");
    expect(extracted.currency).toBe("PHP");
    expect(extracted.total_minor_units).toBe(125000);
    expect(extracted.date_is_ambiguous).toBe(true); // 05/06/2026 could be May 6 or June 5
  });

  it("keeps unknown amounts as null when no valid totals exist", () => {
    const blurredText = `
      STORE #44
      BLURRED UNREADABLE LINE
      THANK YOU
    `;

    const extracted = extractReceiptFromText(blurredText);
    expect(extracted.merchant).toBe("STORE #44");
    expect(extracted.total_minor_units).toBeNull();
    expect(extracted.currency).toBeNull();
  });
});

describe("L1: Ask Keeptrail Assistant & Honestly Labeled Basic Helper", () => {
  const receipts: ReceiptRecord[] = [
    {
      id: "rec_1",
      title: "Printer Cartridges",
      merchant: "National Book Store",
      transaction_date: "2026-09-01",
      currency: "PHP",
      total_minor_units: 157900,
      subtotal_minor_units: null,
      tax_minor_units: null,
      document_type: "receipt",
      review_status: "reviewed",
      notes: "Office ink",
      purpose: "Office Supplies",
      tags: ["supplies"],
      collection_ids: [],
      is_trashed: false,
      created_at: "2026-09-01T10:00:00Z",
      updated_at: "2026-09-01T10:00:00Z",
      deleted_at: null,
    },
    {
      id: "rec_2",
      title: "New Mouse",
      merchant: "Octagon Computer",
      transaction_date: "2026-09-03",
      currency: "PHP",
      total_minor_units: 65000,
      subtotal_minor_units: null,
      tax_minor_units: null,
      document_type: "receipt",
      review_status: "unreviewed",
      notes: "Bluetooth mouse",
      purpose: "Hardware",
      tags: ["gear"],
      collection_ids: [],
      is_trashed: false,
      created_at: "2026-09-03T10:00:00Z",
      updated_at: "2026-09-03T10:00:00Z",
      deleted_at: null,
    },
  ];

  const actions: ActionRecord[] = [
    {
      id: "act_1",
      receipt_id: "rec_2",
      action_type: "return_deadline",
      title: "7-day replacement deadline for Octagon mouse",
      due_date: "2026-09-10",
      status: "pending",
      amount_minor_units: null,
      currency: null,
      notes: "Bring box and receipt",
      created_at: "2026-09-03T10:00:00Z",
      updated_at: "2026-09-03T10:00:00Z",
    },
  ];

  it("uses honestly labeled Basic Helper when on-device LLM is unavailable", async () => {
    const engine = new AskKeeptrailEngine({
      receipts,
      collections: [],
      actions,
      isModelAvailable: false, // Unsupported hardware / model not downloaded
    });

    const response = await engine.query("What did I spend?");

    expect(response.mode_used).toBe("basic_helper");
    expect(response.model_label).toContain("Basic Helper");
    expect(response.calculation_card).toBeDefined();
    expect(response.calculation_card?.total_formatted).toBe("₱2,229.00"); // 157900 + 65000
    expect(response.answer).toContain("₱2,229.00");
  });

  it("handles receipt review queries deterministically", async () => {
    const engine = new AskKeeptrailEngine({
      receipts,
      collections: [],
      actions,
      isModelAvailable: false,
    });

    const response = await engine.query("Which receipts need review?");
    expect(response.answer).toContain("1 receipt(s) needing review");
    expect(response.answer).toContain("Octagon Computer");
  });

  it("handles action and reminder queries", async () => {
    const engine = new AskKeeptrailEngine({
      receipts,
      collections: [],
      actions,
      isModelAvailable: false,
    });

    const response = await engine.query("Do I have any return deadlines?");
    expect(response.answer).toContain("7-day replacement deadline");
  });

  it("handles search queries by keyword", async () => {
    const engine = new AskKeeptrailEngine({
      receipts,
      collections: [],
      actions,
      isModelAvailable: false,
    });

    const response = await engine.query("mouse");
    expect(response.answer).toContain("Found 1 matching receipt");
    expect(response.answer).toContain("Octagon Computer");
  });
});
