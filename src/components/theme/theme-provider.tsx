"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"; 

import { useMediaQuery } from "@/hooks/use-media-query";
import {
  DEFAULT_THEME,
  isTheme,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type Theme,
} from "@/lib/preferences";

const DARK_QUERY = "(prefers-color-scheme: dark)";
const TRANSITION_MS = 260;

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
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const prefersDark = useMediaQuery(DARK_QUERY);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  const syncTheme = useCallback(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setResolvedTheme(isDark ? "dark" : "light");
  }, []);

  useEffect(() => {
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [syncTheme]);

  const setTheme = useCallback((next: Theme) => {
    const root = document.documentElement;
    root.classList.add("theme-transition");
    
    const newResolved = resolveTheme(next, window.matchMedia(DARK_QUERY).matches);
    setResolvedTheme(newResolved);
    applyTheme(newResolved);

    window.setTimeout(() => root.classList.remove("theme-transition"), TRANSITION_MS);
  }, []);

  const value = useMemo(
    () => ({ theme: "system" as Theme, resolvedTheme, setTheme }),
    [resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within <ThemeProvider>.");
  return context;
}