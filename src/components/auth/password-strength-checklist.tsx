"use client";

import { CheckCircle2, Circle } from "lucide-react";

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
      className="rounded-lg border border-border bg-muted/40 p-3 text-xs"
    >
      <p className="mb-2 font-semibold text-foreground">{labels.heading}</p>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {items.map((item) => (
          <li
            key={item.key}
            className={cn(
              "flex items-center gap-1.5 transition-colors",
              item.passed ? "text-success font-medium" : "text-muted-foreground",
            )}
          >
            {item.passed ? (
              <CheckCircle2 className="size-3.5 shrink-0 text-success" aria-hidden="true" />
            ) : (
              <Circle className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
            )}
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
