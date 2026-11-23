"use client";

import Link from "next/link";
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

export function AuthPageLayout({
  children,
  maxWidthClass = "max-w-md",
}: AuthPageLayoutProps) {
  const { t } = useLocale();

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b border-border/80 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            aria-label={t.brand.fullName}
            className="rounded-md focus-visible:outline-2 focus-visible:outline-ring"
          >
            <BrandLogo />
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      <main
        className={cn(
          "mx-auto flex w-full flex-1 flex-col justify-center px-4 py-10 sm:px-6",
          maxWidthClass,
        )}
      >
        <div className="mb-5">
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
              <span>{t.authEntries.backToLanding}</span>
            </Link>
          </Button>
        </div>

        {children}
      </main>
    </div>
  );
}
