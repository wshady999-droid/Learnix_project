"use client";

import { createContext, use, useCallback, useLayoutEffect, useMemo, useSyncExternalStore } from "react";

import { useMediaQuery } from "@/hooks/use-media-query";
import { createPreferenceStore } from "@/lib/preference-store";
import {
  DEFAULT_THEME,
  isTheme,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type Theme,
} from "@/lib/preferences";

const DARK_QUERY = "(prefers-color-scheme: dark)";
const TRANSITION_MS = 260;

const themeStore = createPreferenceStore<Theme>({
  key: THEME_STORAGE_KEY,
  fallback: DEFAULT_THEME,
  validate: isTheme,
});

function resolveTheme(theme: Theme, prefersDark: boolean): ResolvedTheme {
  if (theme === "system") return prefersDark ? "dark" : "light";
  return theme;
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

interface ThemeContextValue {
  /** User preference (may be "system"). `"system"` during SSR/hydration. */
  theme: Theme;
  /** The theme actually applied. */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(
    themeStore.subscribe,
    themeStore.getSnapshot,
    themeStore.getServerSnapshot,
  );
  const prefersDark = useMediaQuery(DARK_QUERY);
  const resolvedTheme = resolveTheme(theme, prefersDark);

  // The boot script applies the theme before paint. This effect keeps <html> in sync
  // afterwards (preference / OS changes, dev Strict Mode remounts). It reads the stores
  // directly so the hydration pass (server snapshot) never applies a stale theme.
  useLayoutEffect(() => {
    applyTheme(
      resolveTheme(themeStore.getSnapshot(), window.matchMedia(DARK_QUERY).matches),
    );
  }, [theme, prefersDark]);

  const setTheme = useCallback((next: Theme) => {
    const root = document.documentElement;
    root.classList.add("theme-transition");
    themeStore.set(next);
    window.setTimeout(() => root.classList.remove("theme-transition"), TRANSITION_MS);
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const context = use(ThemeContext);
  if (!context) throw new Error("useTheme must be used within <ThemeProvider>.");
  return context;
}
