import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Keeptrail Brand Assets & Guidelines (Prompt L1)", () => {
  const brandDir = path.resolve(__dirname, "../brand/keeptrail");
  const mobileAssetsDir = path.resolve(__dirname, "../../../apps/mobile/assets");

  it("includes all 6 required vector assets", () => {
    const requiredFiles = [
      "icon.svg",
      "symbol.svg",
      "lockup.svg",
      "monochrome-black.svg",
      "monochrome-white.svg",
      "dark.svg",
    ];

    for (const file of requiredFiles) {
      const fullPath = path.join(brandDir, file);
      expect(fs.existsSync(fullPath), `Missing ${file}`).toBe(true);
      const content = fs.readFileSync(fullPath, "utf-8");
      expect(content).toContain("<svg");
      expect(content).toContain("</svg>");
    }
  });

  it("validates icon.svg satisfies L1 specifications without baked-in rounded corners", () => {
    const iconPath = path.join(brandDir, "icon.svg");
    const content = fs.readFileSync(iconPath, "utf-8");

    // Must use brand colors
    expect(content).toContain("#146B55"); // Evergreen
    expect(content).toContain("#F7F8F4"); // Warm white

    // Must NOT bake rounded device corners into the source icon artwork per Prompt L1
    expect(content).not.toContain('rx="112"');
    expect(content).not.toContain("rx=");
  });

  it("validates lockup.svg includes both the symbol and correctly styled wordmark", () => {
    const lockupPath = path.join(brandDir, "lockup.svg");
    const content = fs.readFileSync(lockupPath, "utf-8");

    expect(content).toContain("Keeptrail");
    expect(content).toContain("RECEIPT ORGANIZER");
    expect(content).toContain("#146B55");
  });

  it("validates dark.svg uses the correct dark tokens", () => {
    const darkPath = path.join(brandDir, "dark.svg");
    const content = fs.readFileSync(darkPath, "utf-8");

    expect(content).toContain("#111A16"); // Dark neutral background
    expect(content).toContain("#8DDBB0"); // Mint primary accent
  });

  it("validates mobile PNG raster assets are present and non-empty", () => {
    const expectedPngs = [
      "icon.png",
      "splash-icon.png",
      "android-icon-foreground.png",
      "android-icon-background.png",
      "android-icon-monochrome.png",
      "favicon.png",
    ];

    for (const png of expectedPngs) {
      const fullPath = path.join(mobileAssetsDir, png);
      expect(fs.existsSync(fullPath), `Missing mobile asset ${png}`).toBe(true);
      const stats = fs.statSync(fullPath);
      expect(stats.size).toBeGreaterThan(100);
    }
  });
});
