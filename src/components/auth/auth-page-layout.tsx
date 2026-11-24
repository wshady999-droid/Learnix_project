"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { LanguageSelector } from "@/components/i18n/language-selector";
import { useLocale } from "@/components/i18n/locale-provider";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { useTheme } from "@/components/theme/theme-provider";
import { cn } from "@/lib/utils";

interface AuthPageLayoutProps {
  children: React.ReactNode;
  maxWidthClass?: string;
}

export function AuthPageLayout({ children, maxWidthClass }: AuthPageLayoutProps) {
  const { t, dir, isRtl, locale } = useLocale();
  const { resolvedTheme } = useTheme();
  const pathname = usePathname();

  const resolvedMaxWidth =
    maxWidthClass ?? (pathname?.startsWith("/signup") ? "max-w-6xl" : "max-w-md");

  const cardMotionStyle = {
    "--auth-slide-x": isRtl ? "-14px" : "14px",
  } as CSSProperties;

  const isArabic = locale === "ar";
  const imagePrefix = isArabic ? "A" : "E";
  const activeBgImage = `/images/auth/${imagePrefix}-${resolvedTheme === "dark" ? "dark" : "light"}.jpeg`;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip text-foreground bg-[#F8F8F7] dark:bg-[#000000]">
      <div className="fixed inset-0 z-0 h-full w-full overflow-hidden">
        <div className="animate-auth-bg-float absolute inset-0 h-full w-full">
          <Image
            key={activeBgImage}
            src={activeBgImage}
            alt="Learnix Auth Background"
            fill
            priority
            sizes="100vw"
            quality={80}
            className="object-cover object-center"
          />
        </div>
      </div>

      <header className="sticky top-0 z-30 w-full border-b border-black/10 dark:border-white/10">
        <div className="flex h-20 w-full items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="hidden h-7 w-1 rounded-full bg-[#C99A22] sm:inline-block" />
            <Link
              href="/"
              aria-label={t.brand.fullName}
              className="flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-[#C99A22] [&_span]:!text-[#202124] dark:[&_span]:!text-[#F5F5F5]"
            >
              <BrandLogo />
            </Link>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="[&_button]:border-[#E5E3DF] [&_button]:bg-white/85 [&_button]:text-[#202124] [&_button:hover]:border-[#C99A22] [&_button:hover]:bg-white [&_svg]:!text-[#C99A22] dark:[&_button]:border-[#252630] dark:[&_button]:bg-[#11131F]/80 dark:[&_button]:text-[#F5F5F5] dark:[&_button:hover]:border-[#C99A22] dark:[&_button:hover]:bg-[#252630] [&_button]:px-6 [&_button]:h-10">
              <LanguageSelector />
            </div>
            <div className="[&_button]:border-[#E5E3DF] [&_button]:bg-white/85 [&_button]:text-[#202124] [&_button:hover]:border-[#C99A22] [&_button:hover]:bg-white [&_svg]:!text-[#C99A22] dark:[&_button]:border-[#252630] dark:[&_button]:bg-[#11131F]/80 dark:[&_button]:text-[#F5F5F5] dark:[&_button:hover]:border-[#C99A22] dark:[&_button:hover]:bg-[#252630] [&_button]:px-6 [&_button]:h-10">
              <ThemeSwitcher />
            </div>
          </div>
        </div>
      </header>

      <main
        dir="ltr"
        className="relative z-10 mx-auto flex w-full max-w-[90rem] flex-1 items-center px-4 py-4 sm:px-6 sm:py-6 lg:px-10"
      >
        <div
          dir={dir}
          className={cn(
            "auth-dialog-position w-full md:w-[58%] lg:w-1/2",
            isRtl ? "md:translate-x-0 lg:translate-x-0" : "md:translate-x-[100%] lg:translate-x-[120%]",
          )}
        >
          <div className={cn("mx-auto w-full", resolvedMaxWidth)}>
            <div
              key={pathname}
              style={cardMotionStyle}
              className="animate-auth-card-enter rounded-2xl bg-white/80 backdrop-blur-md p-4 shadow-2xl border border-black/5 dark:bg-[#11131F] dark:border-[#252630] sm:p-6"
            >
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}