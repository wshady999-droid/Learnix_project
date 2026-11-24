"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, MailCheck, ShieldAlert } from "lucide-react";

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
import { requestPasswordRecoveryAction } from "@/services/auth/actions";

export function ForgotPasswordForm() {
  const { locale, t } = useLocale();
  const authT = getAuthDictionary(locale);

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setErrorMessage(null);

    const result = await requestPasswordRecoveryAction(email);
    setSubmitting(false);

    if (!result.ok) {
      setErrorMessage(result.error);
      return;
    }

    setSubmittedEmail(email.trim());
  }

  return submittedEmail ? (
    <Card
      variant="premium"
      className="rounded-2xl shadow-lg backdrop-blur-md [--gold-fill:color-mix(in_oklab,var(--card)_94%,transparent)]"
    >
          <CardHeader className="space-y-2">
            <Badge variant="gold-subtle">
              <MailCheck className="size-3.5" aria-hidden="true" />
              <span>{authT.recovery.forgotBadge}</span>
            </Badge>
            <CardTitle className="text-xl font-bold">
              {authT.recovery.neutralConfirmationTitle}
            </CardTitle>
            <CardDescription className="leading-relaxed">
              {authT.recovery.neutralConfirmationDescription}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <Button asChild variant="gold" fullWidth>
              <Link href="/login">{authT.recovery.backToLogin}</Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              fullWidth
              onClick={() => setSubmittedEmail(null)}
            >
              {authT.signup.useDifferentEmail}
            </Button>
          </CardContent>
        </Card>
  ) : (
    <Card
      variant="premium"
      className="rounded-2xl shadow-lg backdrop-blur-md [--gold-fill:color-mix(in_oklab,var(--card)_94%,transparent)]"
    >
          <CardHeader className="space-y-2">
            <Badge variant="gold-subtle">
              <KeyRound className="size-3.5" aria-hidden="true" />
              <span>{authT.recovery.forgotBadge}</span>
            </Badge>
            <CardTitle className="text-xl font-bold">{authT.recovery.forgotTitle}</CardTitle>
            <CardDescription>{authT.recovery.forgotSubtitle}</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="grid gap-2">
                <Label htmlFor="recovery-email">{authT.login.emailLabel}</Label>
                <Input
                  id="recovery-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={authT.login.emailPlaceholder}
                  required
                />
              </div>

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
                    ? authT.recovery.sendingLinkButton
                    : authT.recovery.sendLinkButton}
                </span>
              </Button>
            </form>
          </CardContent>

          <CardFooter className="justify-center border-t border-border/70 pt-4 text-xs text-muted-foreground">
            <p>
              {t.authEntries.forgotPassword.rememberedPrompt}{" "}
              <Link href="/login" className="font-semibold text-gold-foreground hover:underline">
                {authT.recovery.backToLogin}
              </Link>
            </p>
        </CardFooter>
    </Card>
  );
}
