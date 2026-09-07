import { describe, expect, it } from "vitest";
import { en, fil, getTranslations, isSupportedLocale, SUPPORTED_LOCALES } from "./index";

describe("Katibay i18n System", () => {
  it("strictly supports only 'en' and 'fil' (Rule 5)", () => {
    expect(SUPPORTED_LOCALES).toEqual(["en", "fil"]);
    expect(isSupportedLocale("en")).toBe(true);
    expect(isSupportedLocale("fil")).toBe(true);
    expect(isSupportedLocale("es")).toBe(false);
    expect(isSupportedLocale("ja")).toBe(false);
  });

  it("provides matching key structure between English and Filipino dictionaries", () => {
    const checkKeysMatch = (
      objA: Record<string, unknown>,
      objB: Record<string, unknown>,
      prefix = "",
    ) => {
      const keysA = Object.keys(objA);
      const keysB = Object.keys(objB);

      expect(keysA.sort()).toEqual(keysB.sort());

      for (const key of keysA) {
        const fullPath = prefix ? `${prefix}.${key}` : key;
        const valA = objA[key];
        const valB = objB[key];
        if (typeof valA === "object" && valA !== null) {
          expect(typeof valB, `Type mismatch at ${fullPath}`).toBe("object");
          checkKeysMatch(
            valA as Record<string, unknown>,
            valB as Record<string, unknown>,
            fullPath,
          );
        } else {
          expect(typeof valB, `Type mismatch at ${fullPath}`).toBe("string");
          expect(
            (valB as string).length,
            `Empty translation string at ${fullPath}`,
          ).toBeGreaterThan(0);
        }
      }
    };

    checkKeysMatch(
      en as unknown as Record<string, unknown>,
      fil as unknown as Record<string, unknown>,
    );
  });

  it("retrieves translations via getTranslations helper", () => {
    expect(getTranslations("en").nav.dashboard).toBe("Activities");
    expect(getTranslations("fil").nav.dashboard).toBe("Mga Aktibidad");
  });
});
