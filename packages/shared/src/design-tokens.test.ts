import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Katibay Design Tokens & Tailwind Sync", () => {
  const sharedDir = path.resolve(__dirname, "..");
  const webDir = path.resolve(__dirname, "../../../apps/web");
  const tokensMdPath = path.join(sharedDir, "design-tokens.md");
  const tailwindConfigPath = path.join(webDir, "tailwind.config.ts");

  it("has design-tokens.md with required sections", () => {
    expect(fs.existsSync(tokensMdPath)).toBe(true);
    const content = fs.readFileSync(tokensMdPath, "utf-8");
    expect(content).toContain("brand-primary");
    expect(content).toContain("brand-accent");
    expect(content).toContain("status-success");
    expect(content).toContain("status-warning");
    expect(content).toContain("status-danger");
    expect(content).toContain("status-neutral");
    expect(content).toContain("status-info");
    expect(content).toContain("Typography Scale");
    expect(content).toContain("Spacing Scale");
  });

  it("reflects every core named token in apps/web/tailwind.config.ts", () => {
    expect(fs.existsSync(tailwindConfigPath)).toBe(true);
    const tailwindContent = fs.readFileSync(tailwindConfigPath, "utf-8");

    const requiredTokens = [
      "brand-primary",
      "brand-primary-hover",
      "brand-primary-fg",
      "brand-accent",
      "brand-accent-hover",
      "brand-accent-fg",
      "brand-surface",
      "status-success",
      "status-warning",
      "status-danger",
      "status-neutral",
      "status-info",
    ];

    requiredTokens.forEach((token) => {
      expect(
        tailwindContent.includes(token),
        `tailwind.config.ts must contain named token '${token}'`,
      ).toBe(true);
    });
  });
});
