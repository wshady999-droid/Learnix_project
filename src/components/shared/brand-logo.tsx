"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  hideWordmarkInCompact?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function BrandLogo({
  size = "md",
  className,
}: BrandLogoProps) {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // مراقبة كلاس "dark" في وسم <html> لتحديث اللوجو فوراً
  useEffect(() => {
    if (!mounted) return;

    const checkTheme = () => {
      // التحقق من وجود كلاس dark على عنصر html
      setIsDark(document.documentElement.classList.contains("dark"));
    };

    // التحقق الأولي
    checkTheme();

    // إعداد المراقب لاكتشاف أي تغيير في كلاسات html
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "class") {
          checkTheme();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    return () => observer.disconnect();
  }, [mounted]);

  // أثناء التحميل الأول، نعرض صورة اللايت كافتراضي
  if (!mounted) {
    return (
      <span className={cn("inline-flex items-center select-none", className)}>
        <Image
          src="/logo-light.png"
          alt="Learnix Logo"
          width={180}
          height={48}
          className={cn("w-auto object-contain", size === "md" ? "h-10" : "h-8")}
          priority
        />
      </span>
    );
  }

  // اختيار الصورة بناءً على الحالة
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
          size === "md" ? "h-10" : "h-8"
        )}
        priority
      />
    </span>
  );
}