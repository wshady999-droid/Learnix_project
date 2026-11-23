"use client";

import { useState } from "react";

import {
  AppSidebar,
  AppTopbar,
  MobileBottomNav,
} from "@/components/navigation/app-navigation";
import { SidebarProvider } from "@/components/navigation/sidebar-provider";
import { FOUNDATION_NAV_SECTIONS } from "@/config/navigation";
import type { NavItem, NavSection } from "@/types/navigation";

interface AppShellProps {
  sections?: readonly NavSection[];
  defaultActiveId?: string;
  title?: string;
  subtitle?: string;
  topbarActions?: React.ReactNode;
  sidebarFooter?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Responsive application shell combining:
 * - Desktop (`lg+`): collapsible sidebar with icon tooltips when collapsed
 * - Tablet (`md` to `<lg`): compact icon-rail sidebar with tooltips
 * - Mobile (`<md`): topbar hamburger drawer + fixed bottom quick-nav bar
 */
export function AppShell({
  sections = FOUNDATION_NAV_SECTIONS,
  defaultActiveId = "overview",
  title,
  subtitle,
  topbarActions,
  sidebarFooter,
  children,
}: AppShellProps) {
  const [activeItemId, setActiveItemId] = useState<string>(defaultActiveId);

  const handleSelectItem = (item: NavItem) => {
    setActiveItemId(item.id);
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-dvh w-full bg-background text-foreground">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg"
        >
          Skip to main content
        </a>
        <AppSidebar
          sections={sections}
          activeItemId={activeItemId}
          onSelectItem={handleSelectItem}
          footerSlot={sidebarFooter}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppTopbar
            sections={sections}
            activeItemId={activeItemId}
            onSelectItem={handleSelectItem}
            title={title}
            subtitle={subtitle}
            actions={topbarActions}
          />
          <main
            id="main-content"
            className="mx-auto w-full max-w-[1600px] flex-1 px-4 pt-6 pb-24 sm:px-6 md:pb-12 lg:px-8 3xl:max-w-[1800px]"
          >
            {children}
          </main>
        </div>
        <MobileBottomNav
          sections={sections}
          activeItemId={activeItemId}
          onSelectItem={handleSelectItem}
        />
      </div>
    </SidebarProvider>
  );
}
