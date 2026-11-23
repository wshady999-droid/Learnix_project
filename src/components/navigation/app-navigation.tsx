"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { useSidebar } from "@/components/navigation/sidebar-provider";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { NavItem, NavSection } from "@/types/navigation";

function isItemActive(pathname: string, activeItemId: string | undefined, item: NavItem): boolean {
  if (activeItemId) return activeItemId === item.id;
  if (item.href.includes("#")) return false;
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

interface NavItemLinkProps {
  item: NavItem;
  active: boolean;
  /** Render inside a compact icon rail (shows tooltip on hover/focus). */
  compact?: boolean;
  onSelect?: (item: NavItem) => void;
}

function NavItemLink({ item, active, compact = false, onSelect }: NavItemLinkProps) {
  const Icon = item.icon;

  const link = (
    <Link
      href={item.href}
      onClick={() => onSelect?.(item)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-all duration-150",
        "compact:justify-center compact:px-0",
        active
          ? "gold-sheen bg-gold-metallic font-semibold text-brand-charcoal shadow-gold"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "size-4 shrink-0 transition-colors",
          active
            ? "text-brand-charcoal"
            : "text-sidebar-muted-foreground group-hover:text-gold-foreground",
        )}
      />
      <span className="truncate compact:sr-only">{item.label}</span>
      {item.badge ? (
        <Badge
          variant={active ? "neutral" : "gold-subtle"}
          className={cn(
            "ms-auto px-1.5 py-0 text-[10px] compact:hidden",
            active && "bg-brand-charcoal/15 text-brand-charcoal",
          )}
        >
          {item.badge}
        </Badge>
      ) : null}
    </Link>
  );

  if (!compact) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>
        <span>{item.label}</span>
        {item.badge ? <span className="ms-1.5 opacity-75">({item.badge})</span> : null}
      </TooltipContent>
    </Tooltip>
  );
}

interface AppSidebarProps {
  sections: readonly NavSection[];
  activeItemId?: string;
  onSelectItem?: (item: NavItem) => void;
  footerSlot?: React.ReactNode;
}

/**
 * Shared responsive sidebar:
 * - Tablet (`md` to `<lg`): always compact icon rail (`w-17`) with tooltips.
 * - Desktop (`lg+`): collapsible between full width (`w-64`) and compact icon rail (`w-17`).
 * - Mobile (`<md`): hidden (replaced by `MobileNavDrawer` + `MobileBottomNav`).
 */
export function AppSidebar({
  sections,
  activeItemId,
  onSelectItem,
  footerSlot,
}: AppSidebarProps) {
  const pathname = usePathname();
  const { state, isCompact, toggle } = useSidebar();

  return (
    <TooltipProvider delayDuration={120}>
      <aside
        aria-label="Primary sidebar"
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-e border-sidebar-border bg-sidebar text-sidebar-foreground md:flex",
          "w-64 transition-[width] duration-200 ease-standard compact:w-17",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4 compact:justify-center compact:px-2">
          <Link
            href="/"
            aria-label="Learnix home"
            className="rounded-md focus-visible:outline-2 focus-visible:outline-ring"
          >
            <BrandLogo hideWordmarkInCompact />
          </Link>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={toggle}
                aria-label={state === "collapsed" ? "Expand sidebar" : "Collapse sidebar"}
                className="hidden lg:inline-flex compact:hidden"
              >
                <PanelLeftClose className="size-4" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Collapse sidebar</TooltipContent>
          </Tooltip>
        </div>

        <nav
          aria-label="Main navigation"
          className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4 compact:px-2"
        >
          {sections.map((section) => (
            <div key={section.id} className="flex flex-col gap-1">
              {section.title ? (
                <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-sidebar-muted-foreground uppercase compact:sr-only">
                  {section.title}
                </p>
              ) : null}
              <ul className="flex flex-col gap-1" role="list">
                {section.items.map((item) => (
                  <li key={item.id}>
                    <NavItemLink
                      item={item}
                      active={isItemActive(pathname, activeItemId, item)}
                      compact={isCompact}
                      onSelect={onSelectItem}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="flex flex-col gap-2 border-t border-sidebar-border p-3 compact:items-center compact:p-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={toggle}
                aria-label="Expand sidebar"
                className="hidden lg:compact:inline-flex"
              >
                <PanelLeftOpen className="size-4" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Expand sidebar</TooltipContent>
          </Tooltip>
          {footerSlot}
        </div>
      </aside>
    </TooltipProvider>
  );
}

interface MobileNavDrawerProps {
  sections: readonly NavSection[];
  activeItemId?: string;
  onSelectItem?: (item: NavItem) => void;
}

export function MobileNavDrawer({
  sections,
  activeItemId,
  onSelectItem,
}: MobileNavDrawerProps) {
  const pathname = usePathname();
  const { mobileOpen, setMobileOpen } = useSidebar();

  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon-sm"
          className="md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="size-4" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-b border-border px-4 py-3.5 text-start">
          <SheetTitle asChild>
            <div>
              <BrandLogo />
            </div>
          </SheetTitle>
          <SheetDescription className="sr-only">
            Navigate across Learnix sections.
          </SheetDescription>
        </SheetHeader>
        <nav aria-label="Mobile navigation" className="flex flex-1 flex-col gap-5 overflow-y-auto p-3">
          {sections.map((section) => (
            <div key={section.id} className="flex flex-col gap-1">
              {section.title ? (
                <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {section.title}
                </p>
              ) : null}
              <ul className="flex flex-col gap-1" role="list">
                {section.items.map((item) => (
                  <li key={item.id}>
                    <NavItemLink
                      item={item}
                      active={isItemActive(pathname, activeItemId, item)}
                      onSelect={(selected) => {
                        setMobileOpen(false);
                        onSelectItem?.(selected);
                      }}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

interface MobileBottomNavProps {
  sections: readonly NavSection[];
  activeItemId?: string;
  onSelectItem?: (item: NavItem) => void;
}

/** Fixed mobile bottom bar showing up to 4 primary items for one-handed reach. */
export function MobileBottomNav({
  sections,
  activeItemId,
  onSelectItem,
}: MobileBottomNavProps) {
  const pathname = usePathname();
  const primaryItems = sections
    .flatMap((section) => section.items)
    .filter((item) => item.mobilePrimary)
    .slice(0, 4);

  if (primaryItems.length === 0) return null;

  return (
    <nav
      aria-label="Quick mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md md:hidden"
    >
      <ul className="grid h-16 grid-cols-4 items-center px-2" role="list">
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const active = isItemActive(pathname, activeItemId, item);
          return (
            <li key={item.id} className="flex justify-center">
              <Link
                href={item.href}
                onClick={() => onSelectItem?.(item)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex w-full flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-medium transition-colors",
                  active
                    ? "text-gold-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full transition-all",
                    active && "gold-sheen bg-gold-metallic text-brand-charcoal shadow-gold",
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="max-w-full truncate px-1">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

interface AppTopbarProps {
  sections: readonly NavSection[];
  activeItemId?: string;
  onSelectItem?: (item: NavItem) => void;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function AppTopbar({
  sections,
  activeItemId,
  onSelectItem,
  title = "Learnix Foundation",
  subtitle = "Design System & Architecture",
  actions,
}: AppTopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <MobileNavDrawer
          sections={sections}
          activeItemId={activeItemId}
          onSelectItem={onSelectItem}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{title}</p>
            <Badge variant="gold-subtle" className="hidden sm:inline-flex">
              Part 1
            </Badge>
          </div>
          {subtitle ? (
            <p className="hidden truncate text-xs text-muted-foreground sm:block">{subtitle}</p>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <ThemeSwitcher />
      </div>
    </header>
  );
}
