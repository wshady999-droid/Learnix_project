import { ar } from "@/i18n/dictionaries/ar";
import { de } from "@/i18n/dictionaries/de";
import { en } from "@/i18n/dictionaries/en";
import { fr } from "@/i18n/dictionaries/fr";
import { it } from "@/i18n/dictionaries/it";
import type { Dictionary } from "@/i18n/types";
import {
  DEFAULT_LOCALE,
  getLocaleDirection,
  SUPPORTED_LOCALES,
  type Locale,
} from "@/lib/preferences";

export { DEFAULT_LOCALE, getLocaleDirection, SUPPORTED_LOCALES, type Dictionary, type Locale };

export interface LocaleMetadata {
  code: Locale;
  nativeName: string;
  englishName: string;
  shortLabel: string;
  dir: "ltr" | "rtl";
}

export const LOCALE_METADATA: Readonly<Record<Locale, LocaleMetadata>> = {
  en: {
    code: "en",
    nativeName: "English",
    englishName: "English",
    shortLabel: "EN",
    dir: "ltr",
  },
  ar: {
    code: "ar",
    nativeName: "العربية",
    englishName: "Arabic",
    shortLabel: "AR",
    dir: "rtl",
  },
  de: {
    code: "de",
    nativeName: "Deutsch",
    englishName: "German",
    shortLabel: "DE",
    dir: "ltr",
  },
  it: {
    code: "it",
    nativeName: "Italiano",
    englishName: "Italian",
    shortLabel: "IT",
    dir: "ltr",
  },
  fr: {
    code: "fr",
    nativeName: "Français",
    englishName: "French",
    shortLabel: "FR",
    dir: "ltr",
  },
};

const dictionaries: Readonly<Record<Locale, Dictionary>> = {
  en,
  ar,
  de,
  it,
  fr,
};

export function getDictionary(locale: Locale = DEFAULT_LOCALE): Dictionary {
  return dictionaries[locale] ?? dictionaries.en;
}

export function isRtlLocale(locale: Locale): boolean {
  return getLocaleDirection(locale) === "rtl";
}
