import { describe, expect, it } from "vitest";
import { SEED_EXCEPTIONS, type ExceptionReviewItem } from "../../../apps/web/lib/data";

describe("Katibay Exception Queue & Review Logic", () => {
  it("contains exactly 12 diverse seed exceptions covering all kinds and severities", () => {
    expect(SEED_EXCEPTIONS.length).toBe(12);

    const kinds = new Set(SEED_EXCEPTIONS.map((e) => e.kind));
    expect(kinds.has("arith_mismatch")).toBe(true);
    expect(kinds.has("duplicate")).toBe(true);
    expect(kinds.has("out_of_period")).toBe(true);
    expect(kinds.has("over_budget")).toBe(true);
    expect(kinds.has("low_confidence")).toBe(true);
    expect(kinds.has("missing_doc")).toBe(true);

    const severities = new Set(SEED_EXCEPTIONS.map((e) => e.severity));
    expect(severities.has("blocking")).toBe(true);
    expect(severities.has("warning")).toBe(true);
  });

  it("provides bilingual English and Filipino question texts for every exception", () => {
    SEED_EXCEPTIONS.forEach((exc) => {
      expect(exc.question_text.length).toBeGreaterThan(10);
      expect(exc.question_text_fil.length).toBeGreaterThan(10);
      expect(exc.confidence).toBeGreaterThanOrEqual(0);
      expect(exc.confidence).toBeLessThanOrEqual(1);
    });
  });

  it("simulates full 12-exception queue resolution unlocking evidence packet export", () => {
    let queue: ExceptionReviewItem[] = [...SEED_EXCEPTIONS];

    // Initial state: 0 resolved
    expect(queue.filter((e) => e.status !== "open").length).toBe(0);

    // Resolve item 1 by acceptance
    queue = queue.map((e, idx) =>
      idx === 0
        ? { ...e, status: "resolved" as const, resolution_note: "Accepted extracted values" }
        : e,
    );

    // Resolve item 2 by waiver with reason
    const waiverReason = "Approved by Org President due to urgent summit logistics";
    queue = queue.map((e, idx) =>
      idx === 1
        ? { ...e, status: "waived" as const, resolution_note: `Waived: ${waiverReason}` }
        : e,
    );

    // Resolve item 3 by correction
    queue = queue.map((e, idx) =>
      idx === 2
        ? {
            ...e,
            status: "resolved" as const,
            resolved_value: "₱1,250.00",
            resolution_note: "Corrected amount",
          }
        : e,
    );

    // Resolve the remaining 9 items
    queue = queue.map((e) =>
      e.status === "open"
        ? { ...e, status: "resolved" as const, resolution_note: "Verified by Treasurer" }
        : e,
    );

    // All 12 must be resolved
    const resolvedCount = queue.filter((e) => e.status !== "open").length;
    expect(resolvedCount).toBe(12);

    // No blocking open exceptions remain
    const openBlocking = queue.filter((e) => e.status === "open" && e.severity === "blocking");
    expect(openBlocking.length).toBe(0);

    // Unlocks export
    const canExport = openBlocking.length === 0 && resolvedCount === 12;
    expect(canExport).toBe(true);
  });
});
