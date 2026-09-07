"use client";

import React, { createContext, useContext, useState } from "react";
import {
  type Locale,
  type TranslationDictionary,
  getTranslations,
  isSupportedLocale,
} from "@katibay/shared";

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslationDictionary;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("katibay_locale");
        if (saved && isSupportedLocale(saved)) {
          return saved;
        }
      } catch {
        // Fallback if localStorage is inaccessible
      }
    }
    return "en";
  });

  const setLocale = (newLocale: Locale) => {
    if (isSupportedLocale(newLocale)) {
      setLocaleState(newLocale);
      try {
        localStorage.setItem("katibay_locale", newLocale);
      } catch {
        // Ignore storage errors
      }
    }
  };

  const t = getTranslations(locale);

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    return {
      locale: "en" as Locale,
      setLocale: () => {},
      t: getTranslations("en"),
    };
  }
  return context;
}
