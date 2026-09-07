/**
 * Shared types and constants for Katibay.
 * Application code (web, mobile) and API payloads agree on these.
 */

export * from "./i18n";
export * from "./local-pilot/types";
export * from "./local-pilot/deterministic-money";
export * from "./local-pilot/ocr-extractor";
export * from "./local-pilot/assistant-engine";
export * from "./local-pilot/backup-encryption";
export * from "./local-pilot/local-vault";

/** Supported locales. Rule 5: 'en' and 'fil' only — no other locale is supported. */
export const SUPPORTED_LOCALES = ["en", "fil"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

