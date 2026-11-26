"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, LogIn, ShieldAlert, GraduationCap, Mail, Lock } from "lucide-react";

import { useLocale } from "@/components/i18n/locale-provider";
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
    <Card className="relative rounded-[2rem] border border-emerald-500/30 bg-white/95 dark:bg-[#0a1f1d]/95 backdrop-blur-xl shadow-2xl p-6 sm:p-8 text-slate-900 dark:text-white transition-colors duration-300">
      
      <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex size-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/50 ring-4 ring-white dark:ring-[#0a1f1d]">
        <GraduationCap className="size-7" />
      </div>

      <CardHeader className="space-y-1.5 text-center mt-4">
        <CardTitle className="text-2xl font-bold text-slate-900 dark:text-white">
          {authT.login.title}
        </CardTitle>
        <CardDescription className="text-sm text-slate-600 dark:text-slate-300">
          {authT.login.subtitle}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5 mt-4">
        <form onSubmit={handlePasswordSignIn} className="space-y-4" noValidate>
          
          <div className="grid gap-1.5">
            <Label htmlFor="login-email" className="font-medium text-sm text-slate-700 dark:text-slate-200">
              {authT.login.emailLabel}
            </Label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
              <Input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={authT.login.emailPlaceholder}
                required
                className="rounded-xl px-12 py-5 text-sm transition-all focus-visible:ring-2 focus-visible:ring-emerald-500 border-slate-300 bg-slate-50 text-slate-900 placeholder:text-slate-500 dark:border-slate-600/50 dark:bg-[#0f172a]/60 dark:text-white dark:placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="login-password" className="font-medium text-sm text-slate-700 dark:text-slate-200">
                {authT.login.passwordLabel}
              </Label>
              <Link href="/forgot-password" className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 hover:underline">
                {authT.login.forgotPasswordLink}
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400" />
              <Input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="rounded-xl px-12 py-5 text-sm transition-all focus-visible:ring-2 focus-visible:ring-emerald-500 border-slate-300 bg-slate-50 text-slate-900 placeholder:text-slate-500 dark:border-slate-600/50 dark:bg-[#0f172a]/60 dark:text-white dark:placeholder:text-slate-400"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? authT.common.hidePassword : authT.common.showPassword}
                className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-white focus-visible:outline-none"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm select-none text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="size-4 rounded border-slate-400 text-emerald-500 accent-emerald-500 focus:ring-emerald-500 bg-transparent"
            />
            <span>{authT.common.rememberSession}</span>
          </label>

          {errorMessage && (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-xs font-medium text-red-600 dark:text-red-400">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold h-12 text-base transition-all shadow-lg shadow-emerald-500/30"
            loading={submitting}
          >
            <LogIn className="size-5 me-2" aria-hidden="true" />
            <span>
              {submitting ? authT.login.submittingPasswordButton : authT.login.submitPasswordButton}
            </span>
          </Button>
        </form>
      </CardContent>

      <CardFooter className="justify-center pt-4 text-sm text-slate-600 dark:text-slate-400">
        <p>
          {authT.login.noAccountPrompt}{" "}
          <Link href="/signup" className="font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 hover:underline">
            {authT.login.createAccountLink}
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}