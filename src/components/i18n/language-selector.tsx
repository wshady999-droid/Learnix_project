"use client";

import { Check, Languages } from "lucide-react";

import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LOCALE_METADATA, SUPPORTED_LOCALES } from "@/i18n";

export function LanguageSelector() {
  const { locale, metadata, t, setLocale } = useLocale();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={t.language.selectAria}
          className="h-8 gap-1.5 px-2.5 text-xs font-semibold"
        >
          <Languages className="size-3.5 text-gold-foreground" aria-hidden="true" />
          <span>{metadata.shortLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>{t.language.label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SUPPORTED_LOCALES.map((code) => {
          const item = LOCALE_METADATA[code];
          const isActive = locale === code;
          return (
            <DropdownMenuItem
              key={code}
              onClick={() => setLocale(code)}
              className="justify-between"
            >
              <span className="flex items-center gap-2">
                <span className="inline-flex w-6 font-mono text-[11px] font-semibold text-gold-foreground">
                  {item.shortLabel}
                </span>
                <span>{item.nativeName}</span>
              </span>
              {isActive ? (
                <Check className="size-4 !text-gold-foreground" aria-hidden="true" />
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
