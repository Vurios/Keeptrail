import { describe, expect, it } from "vitest";
import { SUPPORTED_LOCALES, isSupportedLocale } from "./index";

describe("SUPPORTED_LOCALES", () => {
  it("contains exactly 'en' and 'fil' (rule 5)", () => {
    expect(SUPPORTED_LOCALES).toEqual(["en", "fil"]);
  });

  it("rejects locales outside the supported set", () => {
    expect(isSupportedLocale("en")).toBe(true);
    expect(isSupportedLocale("fil")).toBe(true);
    expect(isSupportedLocale("bikol")).toBe(false);
    expect(isSupportedLocale("tl")).toBe(false);
  });
});
