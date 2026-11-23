"use client";

import {
  createContext,
  use,
  useCallback,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { toast } from "sonner";

import {
  DEFAULT_LOCALE,
  getDictionary,
  getLocaleDirection,
  LOCALE_METADATA,
  type Dictionary,
  type Locale,
  type LocaleMetadata,
} from "@/i18n";
import { createPreferenceStore } from "@/lib/preference-store";
import { isLocale, LOCALE_STORAGE_KEY } from "@/lib/preferences";

const localeStore = createPreferenceStore<Locale>({
  key: LOCALE_STORAGE_KEY,
  fallback: DEFAULT_LOCALE,
  validate: isLocale,
});

function applyLocaleToDocument(locale: Locale) {
  const root = document.documentElement;
  const dir = getLocaleDirection(locale);
  root.lang = locale;
  root.dir = dir;
}

interface LocaleContextValue {
  locale: Locale;
  dir: "ltr" | "rtl";
  isRtl: boolean;
  metadata: LocaleMetadata;
  t: Dictionary;
  setLocale: (next: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(
    localeStore.subscribe,
    localeStore.getSnapshot,
    localeStore.getServerSnapshot,
  );

  const dir = getLocaleDirection(locale);
  const isRtl = dir === "rtl";
  const t = getDictionary(locale);
  const metadata = LOCALE_METADATA[locale];

  useLayoutEffect(() => {
    applyLocaleToDocument(localeStore.getSnapshot());
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    const previous = localeStore.getSnapshot();
    localeStore.set(next);
    applyLocaleToDocument(next);

    if (previous !== next) {
      const nextDict = getDictionary(next);
      toast.success(nextDict.language.switchedToastTitle, {
        description: nextDict.language.switchedToastDescription,
      });
    }
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      dir,
      isRtl,
      metadata,
      t,
      setLocale,
    }),
    [locale, dir, isRtl, metadata, t, setLocale],
  );

  return <LocaleContext value={value}>{children}</LocaleContext>;
}

export function useLocale(): LocaleContextValue {
  const context = use(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within <LocaleProvider>.");
  }
  return context;
}
