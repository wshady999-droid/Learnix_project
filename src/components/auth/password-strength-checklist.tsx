"use client";

import { Check } from "lucide-react";

import type { AuthDictionary } from "@/i18n/auth-dictionaries";
import { evaluatePasswordStrength } from "@/lib/auth/validation";
import { cn } from "@/lib/utils";

interface PasswordStrengthChecklistProps {
  password: string;
  labels: AuthDictionary["passwordRules"];
}

export function PasswordStrengthChecklist({
  password,
  labels,
}: PasswordStrengthChecklistProps) {
  const checks = evaluatePasswordStrength(password);

  const items = [
    { key: "minLength", label: labels.minLength, passed: checks.minLength },
    { key: "uppercase", label: labels.uppercase, passed: checks.uppercase },
    { key: "lowercase", label: labels.lowercase, passed: checks.lowercase },
    { key: "number", label: labels.number, passed: checks.number },
    { key: "special", label: labels.special, passed: checks.special },
  ] as const;

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-lg border border-border/50 bg-muted/20 p-3 text-xs"
    >
      <p className="mb-3 text-[11px] font-semibold text-foreground/80">
        {labels.heading}
      </p>
      
      <div className="relative flex items-center justify-between px-1">
        <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-border/60" />

        {items.map((item) => (
          <div key={item.key} className="relative z-10 flex flex-col items-center gap-1.5">
            <div
              className={cn(
                "flex size-5 items-center justify-center rounded-full border-2 transition-all duration-300",
                item.passed
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-muted-foreground/30 bg-background text-transparent",
              )}
            >
              {item.passed ? (
                <Check className="size-3" strokeWidth={3} aria-hidden="true" />
              ) : (
                <span className="size-1.5 rounded-full bg-muted-foreground/30" />
              )}
            </div>
            <span
              className={cn(
                "text-[9px] sm:text-[10px] leading-tight text-center transition-colors",
                item.passed ? "font-medium text-emerald-500" : "text-muted-foreground/60",
              )}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}