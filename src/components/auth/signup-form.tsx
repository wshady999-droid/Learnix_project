"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BookOpen,
  Eye,
  EyeOff,
  GraduationCap,
  ImagePlus,
  ShieldAlert,
  UserPlus,
} from "lucide-react";

import { PasswordStrengthChecklist } from "@/components/auth/password-strength-checklist";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAuthDictionary } from "@/i18n/auth-dictionaries";
import {
  COUNTRY_CALLING_CODES,
  DEFAULT_COUNTRY_ISO2,
} from "@/lib/auth/countries";
import { evaluatePasswordStrength } from "@/lib/auth/validation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { registerAccountAction } from "@/services/auth/actions";

const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export function SignupForm() {
  const router = useRouter();
  const { locale } = useLocale();
  const authT = getAuthDictionary(locale);

  const [accountType, setAccountType] = useState<"student" | "teacher">("student");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [countryIso2, setCountryIso2] = useState<string>(DEFAULT_COUNTRY_ISO2);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [specialization, setSpecialization] = useState("");
  const [qualifications, setQualifications] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    setErrorMessage(null);
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setAvatarFile(null);
      return;
    }

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setErrorMessage(authT.signup.validation.avatarTypeError);
      event.target.value = "";
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      setErrorMessage(authT.signup.validation.avatarSizeError);
      event.target.value = "";
      return;
    }

    setAvatarFile(file);
  }

  async function uploadOptionalAvatar(userId: string, file: File) {
    try {
      const supabase = createSupabaseBrowserClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${userId}/avatar-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-pictures")
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (!uploadError) {
        const {
          data: { publicUrl },
        } = supabase.storage.from("profile-pictures").getPublicUrl(filePath);
        await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", userId);
      }
    } catch {
      // Non-blocking avatar upload
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setErrorMessage(null);

    if (fullName.trim().length < 2) {
      setErrorMessage(authT.signup.validation.fullNameMin);
      return;
    }

    const cleanedPhone = phone.replace(/[\s()-]/g, "");
    if (!/^\d{6,15}$/.test(cleanedPhone)) {
      setErrorMessage(authT.signup.validation.phoneInvalid);
      return;
    }

    const strength = evaluatePasswordStrength(password);
    if (!strength.isValid) {
      setErrorMessage(authT.passwordRules.heading);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage(authT.passwordRules.mismatch);
      return;
    }

    if (accountType === "teacher") {
      if (specialization.trim().length < 3) {
        setErrorMessage(authT.signup.validation.specializationMin);
        return;
      }
      if (qualifications.trim().length < 20) {
        setErrorMessage(authT.signup.validation.qualificationsMin);
        return;
      }
    }

    setSubmitting(true);

    const normalizedEmail = email.trim().toLowerCase();

    const payload =
      accountType === "student"
        ? {
            accountType: "student" as const,
            fullName: fullName.trim(),
            email: normalizedEmail,
            countryIso2,
            phone: cleanedPhone,
            password,
            confirmPassword,
            locale,
          }
        : {
            accountType: "teacher" as const,
            fullName: fullName.trim(),
            email: normalizedEmail,
            countryIso2,
            phone: cleanedPhone,
            specialization: specialization.trim(),
            qualifications: qualifications.trim(),
            password,
            confirmPassword,
            locale,
          };

    const result = await registerAccountAction(payload);

    if (!result.ok) {
      setSubmitting(false);
      setErrorMessage(
        result.error === "EMAIL_ALREADY_EXISTS"
          ? authT.signup.emailAlreadyExistsError
          : result.error,
      );
      return;
    }

    if (avatarFile && result.data.userId) {
      await uploadOptionalAvatar(result.data.userId, avatarFile);
    }

    setSubmitting(false);
    toast.success(
      result.data.accountType === "teacher"
        ? authT.signup.teacherRegistrationSuccessToast
        : authT.signup.registrationSuccessToast,
    );
    router.push(result.data.redirectTo);
    router.refresh();
  }

  return (
    // تصغير الـ padding الداخلي لـ p-4
    <Card className="relative rounded-[1.5rem] border border-emerald-500/30 bg-white/95 dark:bg-[#0a1f1d]/95 backdrop-blur-xl shadow-2xl p-4 sm:p-5 text-slate-900 dark:text-white transition-colors duration-300">
      
      <CardHeader className="space-y-1 pb-2">
        <CardTitle className="text-lg font-bold">{authT.signup.title}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-2.5">
        
        <div className="grid grid-cols-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-[#0f172a]/50 p-1">
          <button
            type="button"
            onClick={() => {
              setAccountType("student");
              setErrorMessage(null);
            }}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all",
              accountType === "student"
                ? "bg-emerald-500 text-white shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
            )}
          >
            <GraduationCap className="size-3.5" aria-hidden="true" />
            <span>{authT.signup.studentTab}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAccountType("teacher");
              setErrorMessage(null);
            }}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all",
              accountType === "teacher"
                ? "bg-emerald-500 text-white shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
            )}
          >
            <BookOpen className="size-3.5" aria-hidden="true" />
            <span>{authT.signup.teacherTab}</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5" noValidate>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label htmlFor="signup-full-name" className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
                {authT.signup.fullNameLabel}
              </Label>
              <Input
                id="signup-full-name"
                name="fullName"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={authT.signup.fullNamePlaceholder}
                required
                className="rounded-lg border-slate-300 bg-slate-50 px-3 py-1.5 text-xs transition-all focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-600/50 dark:bg-[#0f172a]/60 dark:text-white"
              />
            </div>

            <div className="grid gap-1">
              <Label htmlFor="signup-email" className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
                {authT.signup.emailLabel}
              </Label>
              <Input
                id="signup-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={authT.signup.emailPlaceholder}
                required
                className="rounded-lg border-slate-300 bg-slate-50 px-3 py-1.5 text-xs transition-all focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-600/50 dark:bg-[#0f172a]/60 dark:text-white"
              />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-[8rem_1fr]">
            <div className="grid gap-1">
              <Label htmlFor="signup-country" className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
                {authT.signup.countryCodeLabel}
              </Label>
              <select
                id="signup-country"
                value={countryIso2}
                onChange={(e) => setCountryIso2(e.target.value)}
                className="rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 text-xs transition-all focus:ring-2 focus:ring-emerald-500 focus:outline-none dark:border-slate-600/50 dark:bg-[#0f172a]/60 dark:text-white"
              >
                {COUNTRY_CALLING_CODES.map((c) => (
                  <option key={c.iso2} value={c.iso2}>
                    {/* شيلنا c.flag من هنا */}
                    {c.iso2} ({c.dialCode})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-1">
              <Label htmlFor="signup-phone" className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
                {authT.signup.phoneLabel}
              </Label>
              <Input
                id="signup-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={authT.signup.phonePlaceholder}
                required
                className="rounded-lg border-slate-300 bg-slate-50 px-3 py-1.5 text-xs transition-all focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-600/50 dark:bg-[#0f172a]/60 dark:text-white"
              />
            </div>
          </div>

          {accountType === "teacher" ? (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-2 dark:border-slate-700 dark:bg-[#0f172a]/30">
              <div className="grid gap-1">
                <Label htmlFor="signup-specialization" className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
                  {authT.signup.specializationLabel}
                </Label>
                <Input
                  id="signup-specialization"
                  name="specialization"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  placeholder={authT.signup.specializationPlaceholder}
                  required
                  className="rounded-lg border-slate-300 bg-white px-3 py-1.5 text-xs transition-all dark:border-slate-600/50 dark:bg-[#0f172a]/60 dark:text-white"
                />
              </div>

              <div className="grid gap-1">
                <Label htmlFor="signup-qualifications" className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
                  {authT.signup.qualificationsLabel}
                </Label>
                <Textarea
                  id="signup-qualifications"
                  name="qualifications"
                  rows={2}
                  value={qualifications}
                  onChange={(e) => setQualifications(e.target.value)}
                  placeholder={authT.signup.qualificationsPlaceholder}
                  required
                  className="rounded-lg border-slate-300 bg-white px-3 py-1.5 text-xs transition-all dark:border-slate-600/50 dark:bg-[#0f172a]/60 dark:text-white"
                />
              </div>
            </div>
          ) : null}

          <div className="grid gap-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="signup-avatar" className="flex items-center gap-1 text-[11px] font-medium text-slate-700 dark:text-slate-200">
                <ImagePlus className="size-3 text-emerald-500" aria-hidden="true" />
                <span>{authT.signup.avatarLabel}</span>
              </Label>
              <span className="text-[9px] text-slate-400">
                {authT.common.optionalTag}
              </span>
            </div>
            <Input
              id="signup-avatar"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={handleAvatarChange}
              className="rounded-lg border-slate-300 bg-slate-50 px-2 py-1 text-[10px] dark:border-slate-600/50 dark:bg-[#0f172a]/60 dark:text-white"
            />
            <p className="text-[9px] text-slate-500 dark:text-slate-400">{authT.signup.avatarHelp}</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label htmlFor="signup-password" className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
                {authT.signup.passwordLabel}
              </Label>
              <div className="relative">
                <Input
                  id="signup-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value.replace(/\s/g, ""))}
                  placeholder="••••••••"
                  className="rounded-lg border-slate-300 bg-slate-50 px-3 py-1.5 pe-8 text-xs transition-all focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-600/50 dark:bg-[#0f172a]/60 dark:text-white"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? authT.common.hidePassword : authT.common.showPassword}
                  className="absolute inset-y-0 end-0 flex items-center px-2 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-white"
                >
                  {showPassword ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                </button>
              </div>
            </div>

            <div className="grid gap-1">
              <Label htmlFor="signup-confirm-password" className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
                {authT.signup.confirmPasswordLabel}
              </Label>
              <div className="relative">
                <Input
                  id="signup-confirm-password"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value.replace(/\s/g, ""))}
                  placeholder="••••••••"
                  className="rounded-lg border-slate-300 bg-slate-50 px-3 py-1.5 pe-8 text-xs transition-all focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-600/50 dark:bg-[#0f172a]/60 dark:text-white"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? authT.common.hidePassword : authT.common.showPassword}
                  className="absolute inset-y-0 end-0 flex items-center px-2 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-white"
                >
                  {showConfirmPassword ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                </button>
              </div>
            </div>
          </div>

          <PasswordStrengthChecklist password={password} labels={authT.passwordRules} />

          {errorMessage ? (
            <div role="alert" className="flex items-start gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-[10px] font-medium text-red-600 dark:text-red-400">
              <ShieldAlert className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          ) : null}

          <Button 
            type="submit" 
            className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold h-10 text-xs transition-all shadow-lg shadow-emerald-500/30"
            loading={submitting}
          >
            <UserPlus className="size-3.5 me-1.5" aria-hidden="true" />
            <span>
              {submitting
                ? authT.signup.submittingButton
                : accountType === "student"
                  ? authT.signup.submitStudentButton
                  : authT.signup.submitTeacherButton}
            </span>
          </Button>
        </form>
      </CardContent>

      <CardFooter className="justify-center pt-3 text-sm text-slate-600 dark:text-slate-400">
        <p>
          {authT.signup.hasAccountPrompt}{" "}
          <Link href="/login" className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline">
            {authT.signup.loginLink}
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}