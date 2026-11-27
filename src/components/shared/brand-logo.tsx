"use client";

import Image from "next/image";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  hideWordmarkInCompact?: boolean;
  size?: "sm" | "md";
  className?: string;
}

function subscribeToDarkClass(onStoreChange: () => void) {
  if (typeof document === "undefined") {
    return () => {};
  }
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === "class") {
        onStoreChange();
      }
    }
  });
  observer.observe(document.documentElement, { attributes: true });
  return () => observer.disconnect();
}

function getDarkSnapshot(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

function getServerDarkSnapshot(): boolean {
  return false;
}

export function BrandLogo({
  size = "md",
  className,
}: BrandLogoProps) {
  const isDark = useSyncExternalStore(
    subscribeToDarkClass,
    getDarkSnapshot,
    getServerDarkSnapshot,
  );

  const logoSrc = isDark ? "/logo-dark.png" : "/logo-light.png";

  return (
    <span className={cn("inline-flex items-center select-none", className)}>
      <Image
        src={logoSrc}
        alt="Learnix Logo"
        width={180}
        height={48}
        className={cn(
          "w-auto object-contain",
          size === "md" ? "h-10" : "h-8",
        )}
        priority
      />
    </span>
  );
}
