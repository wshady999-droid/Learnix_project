"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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

interface PublicNavbarProps {
  overlayHero?: boolean;
}

const SECTION_IDS = ["home", "about", "features", "courses", "contact"] as const;
const NAVBAR_HEIGHT_OFFSET = 80;

export function PublicNavbar({ overlayHero = false }: PublicNavbarProps) {
  const { t, isRtl } = useLocale();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeAnchor, setActiveAnchor] = useState<string>("home");
  const [scrolled, setScrolled] = useState(false);

  const scrollToSection = useCallback((sectionId: string) => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const behavior: ScrollBehavior = prefersReducedMotion ? "auto" : "smooth";

    if (sectionId === "home") {
      window.scrollTo({ top: 0, behavior });
      window.history.replaceState(null, "", "/#home");
      return;
    }

    const targetEl = document.getElementById(sectionId);
    if (!targetEl) return;

    const targetTop =
      targetEl.getBoundingClientRect().top +
      window.scrollY -
      NAVBAR_HEIGHT_OFFSET;

    window.scrollTo({
      top: Math.max(0, targetTop),
      behavior,
    });
    window.history.replaceState(null, "", `/#${sectionId}`);
  }, []);

  useEffect(() => {
    let ticking = false;

    function updateScrollState() {
      ticking = false;
      const scrollY = window.scrollY;
      const nextScrolled = scrollY > 24;
      setScrolled((prev) => (prev === nextScrolled ? prev : nextScrolled));

      if (pathname !== "/") return;

      if (scrollY < 140) {
        setActiveAnchor((prev) => (prev === "home" ? prev : "home"));
        return;
      }

      const probeY = scrollY + NAVBAR_HEIGHT_OFFSET + 120;
      let currentSection = "home";

      for (const id of SECTION_IDS) {
        const el = document.getElementById(id);
        if (el && el.offsetTop <= probeY) {
          currentSection = id;
        }
      }

      setActiveAnchor((prev) => (prev === currentSection ? prev : currentSection));
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(updateScrollState);
      }
    }

    updateScrollState();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/") return;
    const rawHash = window.location.hash.replace(/^#/, "");
    if (
      rawHash &&
      (SECTION_IDS as readonly string[]).includes(rawHash)
    ) {
      const timer = window.setTimeout(() => {
        setActiveAnchor(rawHash);
        scrollToSection(rawHash);
      }, 60);
      return () => window.clearTimeout(timer);
    }
  }, [pathname, scrollToSection]);

  function handleNavClick(
    event: React.MouseEvent<HTMLAnchorElement>,
    sectionId: string,
  ) {
    setActiveAnchor(sectionId);
    if (pathname === "/") {
      event.preventDefault();
      scrollToSection(sectionId);
    }
  }

  const navItems = [
    { id: "home", label: t.nav.home, href: "/#home" },
    { id: "about", label: t.nav.about, href: "/#about" },
    { id: "features", label: t.nav.features, href: "/#features" },
    { id: "courses", label: t.nav.courses, href: "/#courses" },
    { id: "contact", label: t.nav.contact, href: "/#contact" },
  ] as const;

  // التعديل الجديد: شفاف تماماً في الأعلى، ويصبح له خلفية عند التمرير
  const headerClasses = cn(
    "z-40 w-full transition-all duration-300",
    overlayHero ? "fixed top-0 inset-x-0" : "sticky top-0",
    overlayHero
      ? scrolled
        // عند التمرير: خلفية مع ضبابية
        ? "border-b border-gray-200 bg-white/90 backdrop-blur-md shadow-sm dark:border-[#1A453B] dark:bg-[#09251F]/95 dark:shadow-lg" 
        // في الأعلى: شفاف تماماً (بدون خلفية ولا حواف)
        : "border-b border-transparent bg-transparent" 
      // للصفحات الأخرى غير الرئيسية
      : "border-b border-gray-200 bg-white/90 backdrop-blur-md dark:border-[#1A453B] dark:bg-[#09251F]/95",
  );

  return (
    <header className={headerClasses}>
      <div className="flex h-20 w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="hidden h-7 w-1 rounded-full bg-[#20B89A] sm:inline-block"
          />
          <Link
            href="/#home"
            onClick={(e) => handleNavClick(e, "home")}
            aria-label={t.brand.fullName}
            className="flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-[#20B89A]"
          >
            <BrandLogo className="text-[#09251F] dark:text-white" />
          </Link>
          <span
            aria-hidden="true"
            className="hidden h-6 w-px bg-gray-300 dark:bg-white/15 lg:inline-block"
          />
        </div>

        <nav
          aria-label={t.footer.usefulLinksTitle}
          className="hidden items-center gap-4 md:flex lg:gap-8"
        >
          {navItems.map((item) => {
            const isActive = activeAnchor === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.id)}
                className={cn(
                  "relative px-6 py-2 text-sm font-medium transition-colors duration-200",
                  isActive
                    ? "font-semibold text-[#09251F] dark:text-white"
                    : "text-gray-600 hover:text-[#09251F] dark:text-[#B8CECA] dark:hover:text-white",
                )}
              >
                <span>{item.label}</span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-x-6 -bottom-0.5 h-0.5 rounded-full bg-[#20B89A] transition-all duration-200",
                    isActive ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0",
                  )}
                />
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5">
          <div className="[&_button]:border-gray-300 [&_button]:bg-gray-50 [&_button]:text-gray-700 [&_button:hover]:border-[#20B89A] [&_button:hover]:bg-gray-100 [&_svg]:!text-[#20B89A] dark:[&_button]:border-[#1A453B] dark:[&_button]:bg-[#12352D]/80 dark:[&_button]:text-white">
            <LanguageSelector />
          </div>
          <div className="[&_button]:border-gray-300 [&_button]:bg-gray-50 [&_button]:text-gray-700 [&_button:hover]:border-[#20B89A] [&_button:hover]:bg-gray-100 [&_svg]:!text-[#20B89A] dark:[&_button]:border-[#1A453B] dark:[&_button]:bg-[#12352D]/80 dark:[&_button]:text-white">
            <ThemeSwitcher />
          </div>

          <div className="hidden items-center gap-2.5 sm:flex">
            <Link
              href="/login"
              className="inline-flex h-10 items-center justify-center rounded-full border border-gray-300 bg-white/80 px-6 text-xs font-semibold text-[#09251F] transition-all duration-200 hover:border-[#20B89A] hover:bg-gray-50 dark:border-[#20B89A]/50 dark:bg-transparent dark:text-white dark:hover:border-[#20B89A] dark:hover:bg-[#20B89A]/10"
            >
              {t.nav.login}
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-10 items-center justify-center rounded-full bg-[#20B89A] px-6 text-xs font-semibold text-white shadow-[0_4px_14px_rgba(32,184,154,0.35)] transition-all duration-200 hover:bg-[#1a9e84] hover:shadow-[0_6px_20px_rgba(32,184,154,0.5)] dark:bg-[#00E5C0] dark:text-[#09251F] dark:hover:bg-[#8FFFD2]"
            >
              {t.nav.createAccount}
            </Link>
          </div>

          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                className="border-gray-300 bg-white/80 text-gray-700 hover:border-[#20B89A] hover:bg-gray-50 md:hidden dark:border-[#1A453B] dark:bg-[#12352D]/80 dark:text-white dark:hover:bg-[#12352D]"
                aria-label={t.nav.openMenuAria}
              >
                <Menu className="size-4 text-[#20B89A]" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side={isRtl ? "right" : "left"}
              className="w-80 border-gray-200 bg-white p-0 text-[#09251F] dark:border-[#1A453B] dark:bg-[#09251F] dark:text-white"
            >
              <SheetHeader className="border-b border-gray-200 px-5 py-4 text-start dark:border-[#1A453B]">
                <SheetTitle asChild>
                  <div className="[&_span]:!text-[#09251F] dark:[&_span]:!text-white">
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
                      onClick={(e) => {
                        setMobileMenuOpen(false);
                        handleNavClick(e, item.id);
                      }}
                      className={cn(
                        "flex h-10 items-center rounded-lg px-3.5 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-[#20B89A] font-semibold text-white"
                          : "text-gray-600 hover:bg-gray-100 hover:text-[#09251F] dark:text-[#B8CECA] dark:hover:bg-[#12352D] dark:hover:text-white",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="flex flex-col gap-2.5 border-t border-gray-200 p-4 dark:border-[#1A453B]">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-4 text-sm font-semibold text-[#09251F] transition-colors hover:bg-gray-50 dark:border-[#20B89A]/50 dark:bg-transparent dark:text-white dark:hover:bg-[#12352D]"
                >
                  <LogIn className="size-4 text-[#20B89A]" aria-hidden="true" />
                  {t.nav.login}
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[#20B89A] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#1a9e84] dark:bg-[#00E5C0] dark:text-[#09251F] dark:hover:bg-[#8FFFD2]"
                >
                  <UserPlus className="size-4" aria-hidden="true" />
                  {t.nav.createAccount}
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}