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

  return (
    <header
      className={cn(
        "z-40 w-full transition-all duration-300",
        overlayHero ? "fixed top-0 inset-x-0" : "sticky top-0",
        overlayHero
          ? scrolled
            ? "border-b border-[#E5E3DF] bg-[#F8F8F7]/95 backdrop-blur-md shadow-lg dark:border-[#252630] dark:bg-[#17181A]/95"
            : "border-b border-black/10 bg-transparent backdrop-blur-none dark:border-white/10 dark:bg-transparent"
          : "border-b border-[#E5E3DF] bg-[#F8F8F7]/95 backdrop-blur-md dark:border-[#252630] dark:bg-[#17181A]/95",
      )}
    >
      <div className="flex h-20 w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="hidden h-7 w-1 rounded-full bg-[#C99A22] sm:inline-block"
          />
          <Link
            href="/#home"
            onClick={(e) => handleNavClick(e, "home")}
            aria-label={t.brand.fullName}
            className="flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-[#C99A22] [&_span]:!text-[#202124] dark:[&_span]:!text-[#F5F5F5]"
          >
            <BrandLogo />
          </Link>
          <span
            aria-hidden="true"
            className="hidden h-6 w-px bg-black/15 dark:bg-white/15 lg:inline-block"
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
                    ? "font-semibold text-[#202124] dark:text-[#F5F5F5]"
                    : "text-[#52525B] hover:text-[#202124] dark:text-[#A1A1AA] dark:hover:text-[#F5F5F5]",
                )}
              >
                <span>{item.label}</span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-x-6 -bottom-0.5 h-0.5 rounded-full bg-[#C99A22] transition-all duration-200",
                    isActive ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0",
                  )}
                />
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5">
          <div className="[&_button]:border-[#E5E3DF] [&_button]:bg-white/85 [&_button]:text-[#202124] [&_button:hover]:border-[#C99A22] [&_button:hover]:bg-white [&_svg]:!text-[#C99A22] dark:[&_button]:border-[#252630] dark:[&_button]:bg-[#11131F]/80 dark:[&_button]:text-[#F5F5F5] dark:[&_button:hover]:border-[#C99A22] dark:[&_button:hover]:bg-[#252630]">
            <LanguageSelector />
          </div>
          <div className="[&_button]:border-[#E5E3DF] [&_button]:bg-white/85 [&_button]:text-[#202124] [&_button:hover]:border-[#C99A22] [&_button:hover]:bg-white [&_svg]:!text-[#C99A22] dark:[&_button]:border-[#252630] dark:[&_button]:bg-[#11131F]/80 dark:[&_button]:text-[#F5F5F5] dark:[&_button:hover]:border-[#C99A22] dark:[&_button:hover]:bg-[#252630]">
            <ThemeSwitcher />
          </div>

          <div className="hidden items-center gap-2.5 sm:flex">
            <Link
              href="/login"
              className="inline-flex h-10 items-center justify-center rounded-full border border-[#C99A22]/70 bg-white/85 px-6 text-xs font-semibold text-[#202124] transition-all duration-200 hover:border-[#C99A22] hover:bg-[#C99A22]/15 hover:text-[#202124] dark:bg-[#11131F]/70 dark:text-[#F5F5F5] dark:hover:text-[#F5F5F5]"
            >
              {t.nav.login}
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-10 items-center justify-center rounded-full bg-[#C99A22] px-6 text-xs font-semibold text-[#11131F] shadow-[0_4px_14px_rgba(201,154,34,0.35)] transition-all duration-200 hover:bg-[#d8a92b] hover:shadow-[0_6px_20px_rgba(201,154,34,0.5)]"
            >
              {t.nav.createAccount}
            </Link>
          </div>

          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                className="border-[#E5E3DF] bg-white/85 text-[#202124] hover:border-[#C99A22] hover:bg-white md:hidden dark:border-[#252630] dark:bg-[#11131F]/80 dark:text-[#F5F5F5] dark:hover:bg-[#252630]"
                aria-label={t.nav.openMenuAria}
              >
                <Menu className="size-4 text-[#C99A22]" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side={isRtl ? "right" : "left"}
              className="w-80 border-[#E5E3DF] bg-[#F8F8F7] p-0 text-[#202124] dark:border-[#252630] dark:bg-[#17181A] dark:text-[#F5F5F5]"
            >
              <SheetHeader className="border-b border-[#E5E3DF] px-5 py-4 text-start dark:border-[#252630]">
                <SheetTitle asChild>
                  <div className="[&_span]:!text-[#202124] dark:[&_span]:!text-[#F5F5F5]">
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
                          ? "bg-[#C99A22] font-semibold text-[#11131F]"
                          : "text-[#737373] hover:bg-[#EFEEEB] hover:text-[#202124] dark:text-[#A1A1AA] dark:hover:bg-[#252630] dark:hover:text-[#F5F5F5]",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="flex flex-col gap-2.5 border-t border-[#E5E3DF] p-4 dark:border-[#252630]">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-[#C99A22]/70 bg-white px-4 text-sm font-semibold text-[#202124] transition-colors hover:bg-[#EFEEEB] dark:bg-[#11131F] dark:text-[#F5F5F5] dark:hover:bg-[#252630]"
                >
                  <LogIn className="size-4 text-[#C99A22]" aria-hidden="true" />
                  {t.nav.login}
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[#C99A22] px-4 text-sm font-semibold text-[#11131F] transition-colors hover:bg-[#d8a92b]"
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