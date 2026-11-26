"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { LanguageSelector } from "@/components/i18n/language-selector";
import { useLocale } from "@/components/i18n/locale-provider";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { cn } from "@/lib/utils";

interface AuthPageLayoutProps {
  children: React.ReactNode;
  maxWidthClass?: string;
}

type TextContent = { welcome: string; welcomeHighlight: string; sub: string };

const TEXTS: Record<string, TextContent> = {
  ar: { welcome: "مرحباً", welcomeHighlight: "بعودتك!", sub: "استمر في التعلم واكتشف المزيد من المعرفة." },
  en: { welcome: "Welcome", welcomeHighlight: "Back!", sub: "Keep learning and explore more knowledge." },
  de: { welcome: "Willkommen", welcomeHighlight: "zurück!", sub: "Lerne weiter und entdecke mehr Wissen." },
  fr: { welcome: "Bon", welcomeHighlight: "retour !", sub: "Continuez à apprendre et à explorer." },
  it: { welcome: "Bentornato", welcomeHighlight: "", sub: "Continua a imparare ed esplora." },
};

export function AuthPageLayout({ children, maxWidthClass }: AuthPageLayoutProps) {
  const { t, dir, isRtl, locale } = useLocale();
  const pathname = usePathname();

  // كبرنا العرض لـ 520px عشان الحقول تبقى أعرض
const resolvedMaxWidth =
    maxWidthClass ?? (pathname?.startsWith("/signup") ? "max-w-[550px]" : "max-w-[440px]");
  const cardMotionStyle = {
    "--auth-slide-x": isRtl ? "-14px" : "14px",
  } as CSSProperties;

  const imageLang = locale === "ar" ? "ar" : "en";
  const text = (TEXTS[locale] ?? TEXTS["en"]) as TextContent;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip text-foreground bg-[#F8F8F7] dark:bg-[#000000]">
      
      <div className="fixed inset-0 z-0 h-full w-full overflow-hidden">
        <div className="absolute inset-0 h-full w-full">
          <Image
            src={`/images/auth/${imageLang}-light-login.png`}
            alt="Learnix Auth Light Background"
            fill
            priority
            sizes="100vw"
            quality={90}
            className="object-cover object-center block dark:hidden"
          />
          <Image
            src={`/images/auth/${imageLang}-dark-login.png`}
            alt="Learnix Auth Dark Background"
            fill
            priority
            sizes="100vw"
            quality={90}
            className="object-cover object-center hidden dark:block"
          />
        </div>
      </div>

      <header className="absolute top-0 z-30 w-full bg-transparent" dir="ltr">
        <div className="flex h-16 w-full items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="hidden h-6 w-1 rounded-full bg-emerald-500 sm:inline-block" />
            <Link
              href="/"
              aria-label={t.brand.fullName}
              className="flex items-center gap-3 rounded-md focus-visible:outline-none"
            >
              <BrandLogo />
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-xl border border-slate-300/50 bg-white/50 backdrop-blur-md shadow-sm transition-all hover:bg-white dark:border-white/10 dark:bg-black/20 dark:hover:bg-black/40 [&_button]:border-none [&_button]:bg-transparent [&_button]:text-slate-800 dark:[&_button]:text-white [&_button]:px-3 [&_button]:h-9 [&_svg]:!text-slate-800 dark:[&_svg]:!text-white">
              <LanguageSelector />
            </div>
            <div className="rounded-xl border border-slate-300/50 bg-white/50 backdrop-blur-md shadow-sm transition-all hover:bg-white dark:border-white/10 dark:bg-black/20 dark:hover:bg-black/40 [&_button]:border-none [&_button]:bg-transparent [&_button]:text-slate-800 dark:[&_button]:text-white [&_button]:px-3 [&_button]:h-9 [&_svg]:!text-slate-800 dark:[&_svg]:!text-white">
              <ThemeSwitcher />
            </div>
          </div>
        </div>
      </header>

      {/* 
        هنا التعديل: شيلنا pt-16 وخلينا pt-4، وضفنا max-h-[calc(100vh-4rem)] و overflow-y-auto
        عشان لو الشاشة صغيرة، اليوزر يقدر يعمل سكرول جوه الفورم نفسه.
      */}
      <main
        dir="ltr"
        className="relative z-10 mx-auto flex w-full max-w-[95rem] flex-1 items-center px-4 pt-16 pb-4 sm:px-6 lg:px-12"
      >
        <div className="w-full flex flex-col md:flex-row items-center justify-between gap-8 min-h-[calc(100dvh-5rem)]">
          
          <div 
            dir={dir}
            className={cn(
              "hidden md:flex flex-col justify-center flex-1 max-w-xl",
              isRtl ? "order-2 items-end text-right pe-12" : "order-1 items-start text-left ps-12"
            )}
          >
            <h1 className="text-5xl lg:text-7xl font-bold leading-tight drop-shadow-sm w-full text-slate-900 dark:text-white">
              {text.welcome}{" "}
              {text.welcomeHighlight && (
                <span className="text-emerald-500 dark:text-emerald-400 drop-shadow-sm">
                  {text.welcomeHighlight}
                </span>
              )}
            </h1>
            <p className="mt-5 text-lg lg:text-xl font-medium drop-shadow-sm w-full text-slate-700 dark:text-slate-200">
              {text.sub}
            </p>
          </div>

          <div 
            dir={dir}
            className={cn(
              "w-full flex justify-center",
              isRtl ? "order-1 md:justify-start" : "order-2 md:justify-end",
              resolvedMaxWidth
            )}
          >
            <div
              key={pathname}
              style={cardMotionStyle}
              className="animate-auth-card-enter relative group w-full"
            >
              <div className="absolute -inset-1 rounded-[2rem] bg-gradient-to-r from-emerald-500 to-teal-500 opacity-20 dark:opacity-30 blur-2xl transition duration-1000 group-hover:opacity-40"></div>
              <div className="relative">
                {children}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}