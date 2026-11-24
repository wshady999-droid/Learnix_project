"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, ShieldAlert, ShieldCheck } from "lucide-react";

import { PasswordStrengthChecklist } from "@/components/auth/password-strength-checklist";
import { useLocale } from "@/components/i18n/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuthDictionary } from "@/i18n/auth-dictionaries";
import { evaluatePasswordStrength } from "@/lib/auth/validation";
import { updatePasswordAction } from "@/services/auth/actions";

export function ResetPasswordForm() {
  const router = useRouter();
  const { locale } = useLocale();
  const authT = getAuthDictionary(locale);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const strength = evaluatePasswordStrength(password);
    if (!strength.isValid) {
      setErrorMessage(authT.passwordRules.heading);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage(authT.passwordRules.mismatch);
      return;
    }

    setSubmitting(true);
    const result = await updatePasswordAction({
      password,
      confirmPassword,
    });
    setSubmitting(false);

    if (!result.ok) {
      setErrorMessage(result.error);
      return;
    }

    toast.success(authT.recovery.passwordUpdatedToast);
    router.push("/login");
    router.refresh();
  }

  return (
    <Card
      variant="premium"
      className="rounded-2xl shadow-lg backdrop-blur-md [--gold-fill:color-mix(in_oklab,var(--card)_94%,transparent)]"
    >
        <CardHeader className="space-y-2">
          <Badge variant="gold-subtle">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            <span>{authT.recovery.resetBadge}</span>
          </Badge>
          <CardTitle className="text-xl font-bold">{authT.recovery.resetTitle}</CardTitle>
          <CardDescription>{authT.recovery.resetSubtitle}</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="grid gap-2">
              <Label htmlFor="reset-new-password">{authT.recovery.newPasswordLabel}</Label>
              <Input
                id="reset-new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="reset-confirm-password">
                {authT.recovery.confirmNewPasswordLabel}
              </Label>
              <Input
                id="reset-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <PasswordStrengthChecklist
              password={password}
              labels={authT.passwordRules}
            />

            {errorMessage ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive-subtle p-3 text-xs font-medium text-destructive"
              >
                <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{errorMessage}</span>
              </div>
            ) : null}

            <Button type="submit" variant="gold" fullWidth loading={submitting}>
              <KeyRound className="size-4" aria-hidden="true" />
              <span>
                {submitting
                  ? authT.recovery.updatingPasswordButton
                  : authT.recovery.updatePasswordButton}
              </span>
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center border-t border-border/70 pt-4 text-xs text-muted-foreground">
          <Link href="/login" className="font-semibold text-gold-foreground hover:underline">
            {authT.recovery.backToLogin}
          </Link>
      </CardFooter>
    </Card>
  );
}
