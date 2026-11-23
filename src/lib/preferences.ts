/**
 * Client-side UI preferences persisted in localStorage.
 * The same keys are read by the inline boot script (see `PreferencesScript`)
 * so the correct theme, sidebar state, and language/direction are applied before first paint.
 */

export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];
export type ResolvedTheme = Exclude<Theme, "system">;

export const THEME_STORAGE_KEY = "learnix-theme";
export const DEFAULT_THEME: Theme = "system";

export const SIDEBAR_STORAGE_KEY = "learnix-sidebar-state";
export const SIDEBAR_STATES = ["expanded", "collapsed"] as const;
export type SidebarState = (typeof SIDEBAR_STATES)[number];
export const DEFAULT_SIDEBAR_STATE: SidebarState = "expanded";

export const LOCALE_STORAGE_KEY = "learnix-locale";
export const SUPPORTED_LOCALES = ["en", "ar", "de", "it", "fr"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

export function isSidebarState(value: unknown): value is SidebarState {
  return typeof value === "string" && (SIDEBAR_STATES as readonly string[]).includes(value);
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function getLocaleDirection(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

/**
 * Minified boot script. Runs synchronously in <head> before the body is parsed.
 * Keep it dependency-free and wrapped in try/catch (localStorage may be blocked).
 */
export const preferencesBootScript = `(function(){try{var d=document.documentElement;var t=localStorage.getItem("${THEME_STORAGE_KEY}");var k=t==="dark"||((!t||t==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);d.classList.toggle("dark",k);d.style.colorScheme=k?"dark":"light";var s=localStorage.getItem("${SIDEBAR_STORAGE_KEY}");d.setAttribute("data-sidebar-state",s==="collapsed"?"collapsed":"expanded");var l=localStorage.getItem("${LOCALE_STORAGE_KEY}");var v=["en","ar","de","it","fr"].indexOf(l)!==-1?l:"${DEFAULT_LOCALE}";d.lang=v;d.dir=v==="ar"?"rtl":"ltr"}catch(e){}})();`;
