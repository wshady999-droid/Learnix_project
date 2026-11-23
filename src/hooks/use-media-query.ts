"use client";

import { useSyncExternalStore } from "react";

/**
 * Subscribe to a CSS media query. Returns `false` on the server and during hydration,
 * so prefer CSS breakpoints for layout and use this only for behavior (e.g. tooltips).
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
