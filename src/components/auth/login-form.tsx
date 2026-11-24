"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, LogIn, ShieldAlert, Sparkles } from "lucide-react";

import { GoogleOAuthButton } from "@/components/auth/google-oauth-button";
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
import { Separator } from "@/components/ui/separator";
import { getAuthDictionary } from "@/i18n/auth-dictionaries";
import { signInWithPasswordAction } from "@/services/auth/actions";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const authT = getAuthDictionary(locale);

  const reason = searchParams.get("reason");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handlePasswordSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setErrorMessage(null);

    const result = await signInWithPasswordAction({
      email,
      password,
      rememberMe,
    });

    setSubmitting(false);

    if (!result.ok) {
      if (result.error === "INVALID_CREDENTIALS") {
        setErrorMessage(authT.login.invalidCredentialsError);
      } else if (result.error === "ACCOUNT_SUSPENDED") {
        setErrorMessage(authT.login.accountSuspendedError);
      } else {
        setErrorMessage(result.error);
      }
      return;
    }

    toast.success(authT.login.loginSuccessToast);
    router.push(result.data.redirectTo);
    router.refresh();
  }

  return (
    <Card className="rounded-2xl border border-[#C99A22]/30 !bg-[#C99A22]/5 backdrop-blur-sm shadow-2xl p-2 sm:p-4">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <Badge variant="gold-subtle">
            <Sparkles className="size-3.5" aria-hidden="true" />
            <span>{authT.login.badge}</span>
          </Badge>
        </div>
        <CardTitle className="text-xl font-bold">{authT.login.title}</CardTitle>
        <CardDescription>{authT.login.subtitle}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {reason === "session_expired" ? (
          <div
            role="status"
            className="rounded-lg border border-gold-border bg-gold-subtle/60 p-3 text-xs font-medium text-gold-foreground"
          >
            {authT.login.sessionExpiredNotice}
          </div>
        ) : null}

        {reason === "suspended" ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive-subtle p-3 text-xs font-medium text-destructive"
          >
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{authT.login.accountSuspendedError}</span>
          </div>
        ) : null}

        <form onSubmit={handlePasswordSignIn} className="space-y-4" noValidate>
          <div className="grid gap-2">
            <Label htmlFor="login-email">{authT.login.emailLabel}</Label>
            <Input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={authT.login.emailPlaceholder}
              required
            />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="login-password">{authT.login.passwordLabel}</Label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-gold-foreground hover:underline"
              >
                {authT.login.forgotPasswordLink}
              </Link>
            </div>
            <div className="relative">
              <Input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pe-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={
                  showPassword ? authT.common.hidePassword : authT.common.showPassword
                }
                className="absolute inset-y-0 end-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                {showPassword ? (
                  <EyeOff className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="size-4 rounded border-input accent-brand-gold"
            />
            <span>{authT.common.rememberSession}</span>
          </label>

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
            <LogIn className="size-4" aria-hidden="true" />
            <span>
              {submitting
                ? authT.login.submittingPasswordButton
                : authT.login.submitPasswordButton}
            </span>
          </Button>
        </form>

        <div className="relative py-1">
          <Separator />
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2.5 text-[11px] text-muted-foreground">
            {authT.common.orContinueWith}
          </span>
        </div>

        <GoogleOAuthButton label={authT.common.googleButton} />
      </CardContent>

      <CardFooter className="justify-center border-t border-border/70 pt-4 text-xs text-muted-foreground">
        <p>
          {authT.login.noAccountPrompt}{" "}
          <Link href="/signup" className="font-semibold text-gold-foreground hover:underline">
            {authT.login.createAccountLink}
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}