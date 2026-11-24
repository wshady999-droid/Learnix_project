"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { LanguageSelector } from "@/components/i18n/language-selector";
import { useLocale } from "@/components/i18n/locale-provider";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AuthPageLayoutProps {
  children: React.ReactNode;
  maxWidthClass?: string;
}

export function AuthPageLayout({ children, maxWidthClass }: AuthPageLayoutProps) {
  const { t, dir, isRtl, locale } = useLocale();
  const pathname = usePathname();

  const resolvedMaxWidth =
    maxWidthClass ?? (pathname?.startsWith("/signup") ? "max-w-3xl" : "max-w-md");

  const cardMotionStyle = {
    "--auth-slide-x": isRtl ? "-14px" : "14px",
  } as CSSProperties;

  const isArabic = locale === "ar";
  const imagePrefix = isArabic ? "A" : "E";

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip text-foreground bg-[#F8F8F7] dark:bg-[#17181A]">
      
      <div className="fixed inset-0 z-0 h-full w-full">
        <img
          src={`/images/auth/${imagePrefix}-light.jpeg`}
          alt="Learnix Auth Background Light"
          className="absolute inset-0 h-full w-full object-cover object-center dark:hidden"
        />

        <img
          src={`/images/auth/${imagePrefix}-dark.jpeg`}
          alt="Learnix Auth Background Dark"
          className="absolute inset-0 hidden h-full w-full object-cover object-center dark:block"
        />
      </div>

      <header className="sticky top-0 z-30 w-full border-b border-transparent">
        <div className="flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-8">
          
          <div className="flex items-center gap-2">
            <Link
              href="/"
              aria-label={t.brand.fullName}
              className="rounded-md focus-visible:outline-2 focus-visible:outline-ring flex items-center gap-2"
            >
              <div className="drop-shadow-md">
                <BrandLogo />
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2 drop-shadow-md">
            <LanguageSelector />
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      <main
        dir="ltr"
        className="relative z-10 mx-auto flex w-full max-w-[90rem] flex-1 items-center px-4 py-8 sm:px-6 sm:py-10 lg:px-10"
      >
        <div
          dir={dir}
          className={cn(
            "auth-dialog-position w-full md:w-[58%] lg:w-1/2",
            isRtl
              ? "md:translate-x-0 lg:translate-x-0"
              : "md:translate-x-[72.4138%] lg:translate-x-full",
          )}
        >
          <div className={cn("mx-auto w-full", resolvedMaxWidth)}>
            <div className="mb-4">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="bg-background/65 backdrop-blur-sm hover:bg-background/85"
              >
                <Link href="/">
                  <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
                  <span>{t.authEntries.backToLanding}</span>
                </Link>
              </Button>
            </div>

            <div
              key={pathname}
              style={cardMotionStyle}
              className="animate-auth-card-enter rounded-2xl bg-background p-6 shadow-2xl border border-border/50 sm:p-8"
            >
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}