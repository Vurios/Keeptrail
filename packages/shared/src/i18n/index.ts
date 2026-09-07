import { en, type TranslationDictionary } from "./en";
import { fil } from "./fil";

export { en, fil, type TranslationDictionary };

export const translations: Record<"en" | "fil", TranslationDictionary> = {
  en,
  fil,
};

export function getTranslations(locale: "en" | "fil" = "en"): TranslationDictionary {
  return translations[locale] || en;
}
