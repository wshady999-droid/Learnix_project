"use client";

import { useState } from "react";
import Link from "next/link";
import { LogIn, Menu, UserPlus } from "lucide-react";

import { LanguageSelector } from "@/components/i18n/language-selector";
import { useLocale } from "@/components/i18n/locale-provider";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function PublicNavbar() {
  const { t, isRtl } = useLocale();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeAnchor, setActiveAnchor] = useState<string>("home");

  const navItems = [
    { id: "home", label: t.nav.home, href: "/#home" },
    { id: "about", label: t.nav.about, href: "/#about" },
    { id: "features", label: t.nav.features, href: "/#features" },
    { id: "courses", label: t.nav.courses, href: "/#courses" },
    { id: "contact", label: t.nav.contact, href: "/#contact" },
  ] as const;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/#home"
          onClick={() => setActiveAnchor("home")}
          aria-label={t.brand.fullName}
          className="rounded-md focus-visible:outline-2 focus-visible:outline-ring"
        >
          <BrandLogo />
        </Link>

        <nav aria-label={t.footer.usefulLinksTitle} className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => {
            const isActive = activeAnchor === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setActiveAnchor(item.id)}
                className={cn(
                  "rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-gold-subtle font-semibold text-gold-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSelector />
          <ThemeSwitcher />

          <div className="hidden items-center gap-2 sm:flex">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">{t.nav.login}</Link>
            </Button>
            <Button asChild variant="gold" size="sm">
              <Link href="/signup">{t.nav.createAccount}</Link>
            </Button>
          </div>

          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                className="lg:hidden"
                aria-label={t.nav.openMenuAria}
              >
                <Menu className="size-4" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side={isRtl ? "right" : "left"} className="w-80 p-0">
              <SheetHeader className="border-b border-border px-5 py-4 text-start">
                <SheetTitle asChild>
                  <div>
                    <BrandLogo />
                  </div>
                </SheetTitle>
                <SheetDescription className="sr-only">
                  {t.nav.mobileMenuDescription}
                </SheetDescription>
              </SheetHeader>

              <nav
                aria-label={t.footer.usefulLinksTitle}
                className="flex flex-1 flex-col gap-1.5 p-4"
              >
                {navItems.map((item) => {
                  const isActive = activeAnchor === item.id;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => {
                        setActiveAnchor(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={cn(
                        "flex h-10 items-center rounded-lg px-3.5 text-sm font-medium transition-colors",
                        isActive
                          ? "gold-sheen bg-gold-metallic font-semibold text-brand-charcoal shadow-gold"
                          : "text-foreground hover:bg-accent",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="flex flex-col gap-2.5 border-t border-border p-4">
                <Button
                  asChild
                  variant="outline"
                  fullWidth
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Link href="/login">
                    <LogIn aria-hidden="true" />
                    {t.nav.login}
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="gold"
                  fullWidth
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Link href="/signup">
                    <UserPlus aria-hidden="true" />
                    {t.nav.createAccount}
                  </Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
