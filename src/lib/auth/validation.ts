import { z } from "zod";

import type { AuthDictionary } from "@/i18n/auth-dictionaries";
import type { UserRole } from "@/types";

export interface PasswordRuleCheck {
  minLength: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  special: boolean;
  isValid: boolean;
}

/**
 * Evaluates all 5 required password security rules:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export function evaluatePasswordStrength(password: string): PasswordRuleCheck {
  const minLength = password.length >= 8;
  const uppercase = /[A-Z]/.test(password);
  const lowercase = /[a-z]/.test(password);
  const number = /[0-9]/.test(password);
  const special = /[^A-Za-z0-9]/.test(password);

  return {
    minLength,
    uppercase,
    lowercase,
    number,
    special,
    isValid: minLength && uppercase && lowercase && number && special,
  };
}

export function buildStrongPasswordSchema(rules: AuthDictionary["passwordRules"]) {
  return z
    .string()
    .min(8, rules.minLength)
    .regex(/[A-Z]/, rules.uppercase)
    .regex(/[a-z]/, rules.lowercase)
    .regex(/[0-9]/, rules.number)
    .regex(/[^A-Za-z0-9]/, rules.special);
}

/** Server-side canonical password schema (English fallback messages). */
export const serverStrongPasswordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter.")
  .regex(/[0-9]/, "Password must contain at least one number.")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character.");

export const serverPhoneDigitsSchema = z
  .string()
  .trim()
  .transform((val) => val.replace(/[\s()-]/g, ""))
  .refine((val) => /^\d{6,15}$/.test(val), {
    message: "Phone number must contain 6 to 15 digits.",
  });

/** Trusted role-to-dashboard route mapping. */
export function getDashboardPathForRole(role: UserRole): "/admin" | "/teacher" | "/student" {
  switch (role) {
    case "admin":
      return "/admin";
    case "teacher":
      return "/teacher";
    case "student":
    default:
      return "/student";
  }
}
