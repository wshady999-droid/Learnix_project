"use client";

import { useLocale } from "@/components/i18n/locale-provider";
import { cn } from "@/lib/utils";

/**
 * Full-area animated background assets per theme and reading direction.
 *
 * Rendered with native HTML `<img>` elements (never `next/image` or CSS
 * optimization) so animated GIF / WebP / APNG files play continuously and loop
 * automatically without frame stripping.
 *
 * Replace these paths with `.gif` or `.webp` once the original animated files
 * are placed in `public/images/auth/`.
 */
export const AUTH_BACKGROUND_ASSETS = {
  light: {
    ltr: "/images/auth/auth-light-ltr.jpg",
    rtl: "/images/auth/auth-light-rtl.jpg",
  },
  dark: {
    ltr: "/images/auth/auth-dark-ltr.jpg",
    rtl: "/images/auth/auth-dark-rtl.jpg",
  },
} as const;

export function AuthAnimatedBackground() {
  const { isRtl } = useLocale();

  return (
    <div
      aria-hidden="true"
      className="animate-auth-bg-fade pointer-events-none fixed inset-x-0 top-16 bottom-0 z-0 overflow-hidden bg-background select-none"
    >
      {/* Light Mode Animated Background Layer */}
      <div className="absolute inset-0 opacity-100 transition-opacity duration-500 dark:opacity-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={AUTH_BACKGROUND_ASSETS.light.ltr}
          alt=""
          decoding="async"
          draggable={false}
          className={cn(
            "absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-500",
            isRtl ? "opacity-0" : "opacity-100",
          )}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={AUTH_BACKGROUND_ASSETS.light.rtl}
          alt=""
          decoding="async"
          draggable={false}
          className={cn(
            "absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-500",
            isRtl ? "opacity-100" : "opacity-0",
          )}
        />
      </div>

      {/* Dark Mode Animated Background Layer */}
      <div className="absolute inset-0 opacity-0 transition-opacity duration-500 dark:opacity-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={AUTH_BACKGROUND_ASSETS.dark.ltr}
          alt=""
          decoding="async"
          draggable={false}
          className={cn(
            "absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-500",
            isRtl ? "opacity-0" : "opacity-100",
          )}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={AUTH_BACKGROUND_ASSETS.dark.rtl}
          alt=""
          decoding="async"
          draggable={false}
          className={cn(
            "absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-500",
            isRtl ? "opacity-100" : "opacity-0",
          )}
        />
      </div>

      {/* Subtle readability veil on small viewports where the dialog sits centered */}
      <div className="absolute inset-0 bg-background/45 backdrop-blur-[1px] transition-opacity duration-500 md:bg-transparent md:backdrop-blur-none" />
    </div>
  );
}
