import { describe, expect, it } from "vitest";
import { computeWarrantyCountdown, SEED_PASSPORTS } from "../../../apps/web/lib/data";

describe("Katibay Passport & Warranty Coverage Calculations", () => {
  const referenceDate = "2026-09-01";

  it("classifies >60 days as active coverage tier", () => {
    // 100 days remaining
    const countdown = computeWarrantyCountdown("2026-12-10", referenceDate);
    expect(countdown.status).toBe("active");
    expect(countdown.tier).toBe("active");
    expect(countdown.daysRemaining).toBe(100);
    expect(countdown.statusChipStatus).toBe("active");
  });

  it("classifies 31-60 days as notice_60d tier", () => {
    // 45 days remaining
    const countdown = computeWarrantyCountdown("2026-10-16", referenceDate);
    expect(countdown.status).toBe("expiring");
    expect(countdown.tier).toBe("notice_60d");
    expect(countdown.daysRemaining).toBe(45);
    expect(countdown.statusChipStatus).toBe("expiring");
    expect(countdown.chipCustomLabel).toContain("60d");
  });

  it("classifies 8-30 days as warning_30d tier", () => {
    // 20 days remaining
    const countdown = computeWarrantyCountdown("2026-09-21", referenceDate);
    expect(countdown.status).toBe("expiring");
    expect(countdown.tier).toBe("warning_30d");
    expect(countdown.daysRemaining).toBe(20);
    expect(countdown.statusChipStatus).toBe("expiring");
    expect(countdown.chipCustomLabel).toContain("30d");
  });

  it("classifies 1-7 days as critical_7d tier", () => {
    // 4 days remaining
    const countdown = computeWarrantyCountdown("2026-09-05", referenceDate);
    expect(countdown.status).toBe("expiring");
    expect(countdown.tier).toBe("critical_7d");
    expect(countdown.daysRemaining).toBe(4);
    expect(countdown.statusChipStatus).toBe("expiring");
    expect(countdown.chipCustomLabel).toContain("7d");
  });

  it("classifies <=0 days as expired tier", () => {
    // Expired 3 days ago
    const countdown = computeWarrantyCountdown("2026-08-29", referenceDate);
    expect(countdown.status).toBe("expired");
    expect(countdown.tier).toBe("expired");
    expect(countdown.daysRemaining).toBe(-3);
    expect(countdown.statusChipStatus).toBe("expired");
    expect(countdown.label).toContain("Expired 3 days ago");
  });

  it("verifies seed passports include assets spanning active, notice_60d, warning_30d, critical_7d, and expired", () => {
    expect(SEED_PASSPORTS.length).toBeGreaterThanOrEqual(4);
    const tiers = SEED_PASSPORTS.map((p) => computeWarrantyCountdown(p.warranty_expires_at).tier);
    expect(tiers).toContain("active");
    expect(tiers).toContain("notice_60d");
    expect(tiers).toContain("warning_30d");
    expect(tiers).toContain("critical_7d");
    expect(tiers).toContain("expired");
  });
});
