"use client";

import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, KeyRound, LogIn, Sparkles, UserPlus } from "lucide-react";

import { LanguageSelector } from "@/components/i18n/language-selector";
import { useLocale } from "@/components/i18n/locale-provider";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
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

interface AuthEntryShellProps {
  mode: "login" | "signup" | "forgot-password";
}

export function AuthEntryShell({ mode }: AuthEntryShellProps) {
  const { t } = useLocale();

  function handlePart4Pending(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    toast.info(t.authEntries.pendingToastTitle, {
      description: t.authEntries.pendingToastDescription,
    });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b border-border/80 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            aria-label={t.brand.fullName}
            className="rounded-md focus-visible:outline-2 focus-visible:outline-ring"
          >
            <BrandLogo />
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12 sm:px-6">
        <div className="mb-6">
          <Button asChild variant="ghost" size="sm">
            <Link href="/">
              <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
              <span>{t.authEntries.backToLanding}</span>
            </Link>
          </Button>
        </div>

        <Card variant="premium" className="shadow-md">
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant="gold-subtle">
                <Sparkles className="size-3" aria-hidden="true" />
                <span>{t.authEntries.part4Badge}</span>
              </Badge>
            </div>
            <CardTitle className="text-xl font-bold">
              {mode === "login" && t.authEntries.login.title}
              {mode === "signup" && t.authEntries.signup.title}
              {mode === "forgot-password" && t.authEntries.forgotPassword.title}
            </CardTitle>
            <CardDescription>
              {mode === "login" && t.authEntries.login.subtitle}
              {mode === "signup" && t.authEntries.signup.subtitle}
              {mode === "forgot-password" && t.authEntries.forgotPassword.subtitle}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="rounded-xl border border-gold-border/80 bg-gold-subtle/50 p-3 text-xs leading-relaxed text-gold-foreground">
              {t.authEntries.part4Notice}
            </div>

            <form onSubmit={handlePart4Pending} className="space-y-4">
              {mode === "signup" ? (
                <div className="grid gap-2">
                  <Label htmlFor="auth-full-name">{t.authEntries.signup.fullNameLabel}</Label>
                  <Input
                    id="auth-full-name"
                    name="fullName"
                    autoComplete="name"
                    placeholder={t.contact.form.fullNamePlaceholder}
                    required
                  />
                </div>
              ) : null}

              <div className="grid gap-2">
                <Label htmlFor="auth-email">
                  {mode === "login" && t.authEntries.login.emailLabel}
                  {mode === "signup" && t.authEntries.signup.emailLabel}
                  {mode === "forgot-password" && t.authEntries.forgotPassword.emailLabel}
                </Label>
                <Input
                  id="auth-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder={t.contact.form.emailPlaceholder}
                  required
                />
              </div>

              {mode !== "forgot-password" ? (
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auth-password">
                      {mode === "login"
                        ? t.authEntries.login.passwordLabel
                        : t.authEntries.signup.passwordLabel}
                    </Label>
                    {mode === "login" ? (
                      <Link
                        href="/forgot-password"
                        className="text-xs font-medium text-gold-foreground hover:underline"
                      >
                        {t.authEntries.login.forgotPasswordLink}
                      </Link>
                    ) : null}
                  </div>
                  <Input
                    id="auth-password"
                    name="password"
                    type="password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    placeholder="••••••••"
                    required
                  />
                </div>
              ) : null}

              <Button type="submit" variant="gold" fullWidth>
                {mode === "login" && (
                  <>
                    <LogIn className="size-4" aria-hidden="true" />
                    <span>{t.authEntries.login.submitButton}</span>
                  </>
                )}
                {mode === "signup" && (
                  <>
                    <UserPlus className="size-4" aria-hidden="true" />
                    <span>{t.authEntries.signup.submitButton}</span>
                  </>
                )}
                {mode === "forgot-password" && (
                  <>
                    <KeyRound className="size-4" aria-hidden="true" />
                    <span>{t.authEntries.forgotPassword.submitButton}</span>
                  </>
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="justify-center border-t border-border/70 pt-4 text-xs text-muted-foreground">
            {mode === "login" ? (
              <p>
                {t.authEntries.login.noAccountPrompt}{" "}
                <Link href="/signup" className="font-semibold text-gold-foreground hover:underline">
                  {t.authEntries.login.createAccountLink}
                </Link>
              </p>
            ) : null}
            {mode === "signup" ? (
              <p>
                {t.authEntries.signup.hasAccountPrompt}{" "}
                <Link href="/login" className="font-semibold text-gold-foreground hover:underline">
                  {t.authEntries.signup.loginLink}
                </Link>
              </p>
            ) : null}
            {mode === "forgot-password" ? (
              <p>
                {t.authEntries.forgotPassword.rememberedPrompt}{" "}
                <Link href="/login" className="font-semibold text-gold-foreground hover:underline">
                  {t.authEntries.forgotPassword.backToLoginLink}
                </Link>
              </p>
            ) : null}
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
