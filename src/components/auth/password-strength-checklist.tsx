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
      className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-[#0f172a]/50"
    >
      {/* العنوان */}
      <p className="mb-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
        {labels.heading}
      </p>
      
      {/* تصميم الشبكة: عمودين */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {items.map((item) => (
          <div key={item.key} className="flex items-center gap-1.5">
            {/* أيقونة الحالة */}
            <div
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-full border transition-all duration-300",
                item.passed
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-slate-300 bg-transparent dark:border-slate-600"
              )}
            >
              {item.passed && (
                <Check className="size-2.5" strokeWidth={4} aria-hidden="true" />
              )}
            </div>
            
            {/* نص الشرط */}
            <span
              className={cn(
                "text-[11px] sm:text-xs leading-snug transition-colors",
                item.passed 
                  ? "text-emerald-600 dark:text-emerald-400 font-medium" 
                  : "text-slate-500 dark:text-slate-400"
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