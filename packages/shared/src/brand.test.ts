import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Katibay Brand Logo System", () => {
  const brandDir = path.resolve(__dirname, "../brand");
  const conceptsDir = path.join(brandDir, "concepts");

  const concepts = ["concept-1-seal", "concept-2-receipt", "concept-3-woven"];
  const variants = ["icon.svg", "lockup.svg", "monochrome.svg"];

  it("has rationale.md with clear concept recommendations", () => {
    const rationalePath = path.join(brandDir, "rationale.md");
    expect(fs.existsSync(rationalePath)).toBe(true);
    const content = fs.readFileSync(rationalePath, "utf-8");
    expect(content).toContain("Concept 1");
    expect(content).toContain("Concept 2");
    expect(content).toContain("Concept 3");
    expect(content).toContain("Primary Recommendation");
    expect(content).toContain("katibayan");
  });

  concepts.forEach((concept) => {
    describe(`Concept: ${concept}`, () => {
      variants.forEach((variant) => {
        it(`renders valid SVG for ${variant} without AI slop/forbidden patterns`, () => {
          const filePath = path.join(conceptsDir, concept, variant);
          expect(fs.existsSync(filePath), `File ${filePath} must exist`).toBe(true);

          const svgContent = fs.readFileSync(filePath, "utf-8");

          // Must be valid SVG with viewBox
          expect(svgContent).toContain("<svg");
          expect(svgContent).toContain("</svg>");
          expect(svgContent).toContain("viewBox=");

          // Must strictly adhere to no-slop rules
          expect(svgContent.toLowerCase()).not.toContain("lineargradient");
          expect(svgContent.toLowerCase()).not.toContain("radialgradient");
          expect(svgContent.toLowerCase()).not.toContain("feGaussianBlur");
          expect(svgContent.toLowerCase()).not.toContain("backdrop-filter");
          expect(svgContent.toLowerCase()).not.toContain("filter=");
        });
      });
    });
  });
});
