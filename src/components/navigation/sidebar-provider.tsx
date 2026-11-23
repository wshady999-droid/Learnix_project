"use client";

import {
  createContext,
  use,
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { mediaQuery } from "@/config/breakpoints";
import { useMediaQuery } from "@/hooks/use-media-query";
import { createPreferenceStore } from "@/lib/preference-store";
import {
  DEFAULT_SIDEBAR_STATE,
  isSidebarState,
  SIDEBAR_STORAGE_KEY,
  type SidebarState,
} from "@/lib/preferences";

const sidebarStore = createPreferenceStore<SidebarState>({
  key: SIDEBAR_STORAGE_KEY,
  fallback: DEFAULT_SIDEBAR_STATE,
  validate: isSidebarState,
});

function applySidebarState(state: SidebarState) {
  document.documentElement.setAttribute("data-sidebar-state", state);
}

interface SidebarContextValue {
  /** Persisted desktop preference ("expanded" | "collapsed"). */
  state: SidebarState;
  /** True when the sidebar currently renders as a compact icon rail (tablet or collapsed desktop). */
  isCompact: boolean;
  /** True when the mobile drawer is open. */
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  setState: (state: SidebarState) => void;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const state = useSyncExternalStore(
    sidebarStore.subscribe,
    sidebarStore.getSnapshot,
    sidebarStore.getServerSnapshot,
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  const isTablet = useMediaQuery(mediaQuery.between("md", "lg"));
  const isDesktop = useMediaQuery(mediaQuery.up("lg"));
  const isCompact = isTablet || (isDesktop && state === "collapsed");

  useLayoutEffect(() => {
    applySidebarState(sidebarStore.getSnapshot());
  }, [state]);

  const setState = useCallback((next: SidebarState) => {
    sidebarStore.set(next);
  }, []);

  const toggle = useCallback(() => {
    const next: SidebarState =
      sidebarStore.getSnapshot() === "collapsed" ? "expanded" : "collapsed";
    sidebarStore.set(next);
  }, []);

  const value = useMemo<SidebarContextValue>(
    () => ({
      state,
      isCompact,
      mobileOpen,
      setMobileOpen,
      setState,
      toggle,
    }),
    [state, isCompact, mobileOpen, setState, toggle],
  );

  return <SidebarContext value={value}>{children}</SidebarContext>;
}

export function useSidebar(): SidebarContextValue {
  const context = use(SidebarContext);
  if (!context) throw new Error("useSidebar must be used within <SidebarProvider>.");
  return context;
}
