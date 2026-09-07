/**
 * Keeptrail "Ask Keeptrail" Assistant Engine
 * 
 * Strict Local Rules:
 * 1. Pretrained model on device (or deterministic Basic Helper on unsupported phones).
 * 2. NO CLAIM of self-training or fine-tuning on users' receipts.
 * 3. Deterministic calculation: numbers come from typed application code, never guessed by LLM.
 * 4. Read-only tools only. Cannot mutate records or delete files.
 * 5. Honestly labeled "Basic Helper" when native model runtime is unavailable.
 */

import type { ReceiptRecord, ActionRecord, CollectionRecord } from "./types";
import { calculateReceiptTotals, formatMoney } from "./deterministic-money";

export interface AssistantResponse {
  answer: string;
  source_record_ids: string[];
  calculation_card?: {
    title: string;
    currency: string;
    total_formatted: string;
    count: number;
    breakdown_notes: string[];
  };
  mode_used: "on_device_model" | "basic_helper";
  model_label: string;
}

export interface AssistantContext {
  receipts: ReceiptRecord[];
  collections: CollectionRecord[];
  actions: ActionRecord[];
  isModelAvailable?: boolean;
  modelName?: string;
}

/**
 * Handle receipt questions using local tools and deterministic logic.
 */
export class AskKeeptrailEngine {
  private receipts: ReceiptRecord[];
  private collections: CollectionRecord[];
  private actions: ActionRecord[];
  private isModelAvailable: boolean;
  private modelName: string;

  constructor(context: AssistantContext) {
    this.receipts = context.receipts.filter((r) => !r.is_trashed);
    this.collections = context.collections;
    this.actions = context.actions;
    this.isModelAvailable = context.isModelAvailable ?? false;
    this.modelName = context.modelName ?? "Qwen2.5-1.5B (Pretrained on-device)";
  }

  /**
   * Main query entry point
   */
  public async query(userPrompt: string): Promise<AssistantResponse> {
    const prompt = userPrompt.trim().toLowerCase();

    // Route 1: Spend summary / total query
    if (
      prompt.includes("spend") ||
      prompt.includes("total") ||
      prompt.includes("how much") ||
      prompt.includes("gastos") ||
      prompt.includes("magkano")
    ) {
      return this.handleSpendSummaryQuery(userPrompt);
    }

    // Route 2: Review queries ("which need review", "unreviewed")
    if (
      prompt.includes("review") ||
      prompt.includes("unreviewed") ||
      prompt.includes("attention") ||
      prompt.includes("kailangan tingnan")
    ) {
      return this.handleReviewQuery();
    }

    // Route 3: Action / reminder queries ("deadlines", "reminders", "refund")
    if (
      prompt.includes("deadline") ||
      prompt.includes("reminder") ||
      prompt.includes("refund") ||
      prompt.includes("action") ||
      prompt.includes("reimburse")
    ) {
      return this.handleActionQuery();
    }

    // Route 4: Help query ("how to", "backup", "export", "paano")
    if (
      prompt.includes("how") ||
      prompt.includes("paano") ||
      prompt.includes("backup") ||
      prompt.includes("export") ||
      prompt.includes("help")
    ) {
      return this.handleHelpQuery(userPrompt);
    }

    // Route 5: Search query by merchant or text
    return this.handleSearchQuery(userPrompt);
  }

  private handleSpendSummaryQuery(userPrompt: string): AssistantResponse {
    const summary = calculateReceiptTotals(this.receipts, { reviewedOnly: false });
    const currencyKeys = Object.keys(summary.currencies);

    if (currencyKeys.length === 0) {
      return {
        answer: "You have no saved receipts with recorded amounts yet. Add receipts or enter amounts manually to see totals.",
        source_record_ids: [],
        mode_used: this.isModelAvailable ? "on_device_model" : "basic_helper",
        model_label: this.isModelAvailable ? this.modelName : "Basic Helper (Deterministic Fallback)",
      };
    }

    const primaryCurrency = currencyKeys[0] || "PHP";
    const totalItem = summary.currencies[primaryCurrency] || {
      currency: primaryCurrency,
      total_minor_units: 0,
      formatted: "₱0.00",
      record_count: 0,
    };

    const breakdownNotes: string[] = [];
    for (const curr of currencyKeys) {
      const item = summary.currencies[curr];
      if (item) {
        breakdownNotes.push(`${item.formatted} across ${item.record_count} record(s)`);
      }
    }

    if (summary.total_records_unknown_amount > 0) {
      breakdownNotes.push(`${summary.total_records_unknown_amount} receipt(s) have unknown amounts and were excluded from sum.`);
    }

    const answerLines: string[] = [
      `Here is your calculated spending:`,
      ...breakdownNotes.map((n) => `• ${n}`),
      `\nTotals are calculated deterministically on this device.`,
    ];

    return {
      answer: answerLines.join("\n"),
      source_record_ids: this.receipts.map((r) => r.id),
      calculation_card: {
        title: "Total Spending",
        currency: primaryCurrency,
        total_formatted: totalItem.formatted,
        count: totalItem.record_count,
        breakdown_notes: breakdownNotes,
      },
      mode_used: this.isModelAvailable ? "on_device_model" : "basic_helper",
      model_label: this.isModelAvailable ? this.modelName : "Basic Helper (Deterministic Fallback)",
    };
  }

  private handleReviewQuery(): AssistantResponse {
    const needsReview = this.receipts.filter(
      (r) => r.review_status !== "reviewed"
    );

    if (needsReview.length === 0) {
      return {
        answer: "All your saved receipts are marked as Reviewed! Great job organizing your records.",
        source_record_ids: [],
        mode_used: this.isModelAvailable ? "on_device_model" : "basic_helper",
        model_label: this.isModelAvailable ? this.modelName : "Basic Helper (Deterministic Fallback)",
      };
    }

    const sample = needsReview.slice(0, 5);
    const list = sample
      .map(
        (r) =>
          `• ${r.merchant || r.title || "Untitled"} (${formatMoney(r.total_minor_units, r.currency)})`
      )
      .join("\n");

    return {
      answer: `You have ${needsReview.length} receipt(s) needing review:\n${list}${
        needsReview.length > 5 ? `\n...and ${needsReview.length - 5} more.` : ""
      }\nTap on any receipt in your Receipts tab to confirm its details.`,
      source_record_ids: sample.map((r) => r.id),
      mode_used: this.isModelAvailable ? "on_device_model" : "basic_helper",
      model_label: this.isModelAvailable ? this.modelName : "Basic Helper (Deterministic Fallback)",
    };
  }

  private handleActionQuery(): AssistantResponse {
    const pending = this.actions.filter((a) => a.status === "pending");

    if (pending.length === 0) {
      return {
        answer: "You have no pending deadlines, return reminders, or refund follow-ups.",
        source_record_ids: [],
        mode_used: this.isModelAvailable ? "on_device_model" : "basic_helper",
        model_label: this.isModelAvailable ? this.modelName : "Basic Helper (Deterministic Fallback)",
      };
    }

    const list = pending
      .map((a) => `• ${a.title} (Due: ${a.due_date})`)
      .join("\n");

    return {
      answer: `You have ${pending.length} pending reminder(s):\n${list}`,
      source_record_ids: pending.map((a) => a.receipt_id).filter(Boolean),
      mode_used: this.isModelAvailable ? "on_device_model" : "basic_helper",
      model_label: this.isModelAvailable ? this.modelName : "Basic Helper (Deterministic Fallback)",
    };
  }

  private handleHelpQuery(userPrompt: string): AssistantResponse {
    const p = userPrompt.toLowerCase();
    let text = "";

    if (p.includes("backup") || p.includes("restore")) {
      text =
        "To back up your receipts:\n1. Open Settings -> Storage & Backup.\n2. Tap 'Back Up Receipts' and enter a secure password.\n3. Save the encrypted .keeptrail file to your Documents or USB drive.\nTo restore, select 'Restore Backup' and provide your password. Your data never leaves your control.";
    } else if (p.includes("export")) {
      text =
        "You can export your receipts as CSV or PDF from your Collections or Receipts view. For complete data recovery, use the encrypted .keeptrail backup in Storage & Backup.";
    } else {
      text =
        "Keeptrail is a 100% local receipt organizer. Save photos, screenshot payment confirmations, or enter manually. All files and data remain strictly on your device.";
    }

    return {
      answer: text,
      source_record_ids: [],
      mode_used: this.isModelAvailable ? "on_device_model" : "basic_helper",
      model_label: this.isModelAvailable ? this.modelName : "Basic Helper (Deterministic Fallback)",
    };
  }

  private handleSearchQuery(userPrompt: string): AssistantResponse {
    const query = userPrompt.trim().toLowerCase();
    const matches = this.receipts.filter((r) => {
      const m = (r.merchant || "").toLowerCase();
      const t = (r.title || "").toLowerCase();
      const n = (r.notes || "").toLowerCase();
      const p = (r.purpose || "").toLowerCase();
      return (
        m.includes(query) ||
        t.includes(query) ||
        n.includes(query) ||
        p.includes(query)
      );
    });

    if (matches.length === 0) {
      return {
        answer: `No receipts found matching "${userPrompt}". Try searching by merchant name, item, or note.`,
        source_record_ids: [],
        mode_used: this.isModelAvailable ? "on_device_model" : "basic_helper",
        model_label: this.isModelAvailable ? this.modelName : "Basic Helper (Deterministic Fallback)",
      };
    }

    const sample = matches.slice(0, 5);
    const list = sample
      .map(
        (r) =>
          `• ${r.merchant || r.title} (${r.transaction_date || "No date"}) — ${formatMoney(r.total_minor_units, r.currency)}`
      )
      .join("\n");

    return {
      answer: `Found ${matches.length} matching receipt(s):\n${list}${
        matches.length > 5 ? `\n...and ${matches.length - 5} more.` : ""
      }`,
      source_record_ids: sample.map((r) => r.id),
      mode_used: this.isModelAvailable ? "on_device_model" : "basic_helper",
      model_label: this.isModelAvailable ? this.modelName : "Basic Helper (Deterministic Fallback)",
    };
  }
}
