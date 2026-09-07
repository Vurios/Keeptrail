/**
 * Shared types and constants for Katibay.
 * Application code (web, mobile) and API payloads agree on these.
 */

export * from "./i18n";

/** Supported locales. Rule 5: 'en' and 'fil' only — no other locale is supported. */
export const SUPPORTED_LOCALES = ["en", "fil"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
