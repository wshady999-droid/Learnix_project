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
  Sparkles,
  UserPlus,
} from "lucide-react";

import { AuthPageLayout } from "@/components/auth/auth-page-layout";
import { GoogleOAuthButton } from "@/components/auth/google-oauth-button";
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
import { Input, Textarea, fieldBase } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
    <AuthPageLayout maxWidthClass="max-w-xl">
      <Card variant="premium" className="shadow-md">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <Badge variant="gold-subtle">
              <Sparkles className="size-3.5" aria-hidden="true" />
              <span>{authT.signup.badge}</span>
            </Badge>
          </div>
          <CardTitle className="text-xl font-bold">{authT.signup.title}</CardTitle>
          <CardDescription>{authT.signup.subtitle}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Student vs Teacher Registration Tabs (No Admin public signup allowed) */}
          <div className="grid grid-cols-2 rounded-lg border border-border bg-muted p-1">
            <button
              type="button"
              onClick={() => {
                setAccountType("student");
                setErrorMessage(null);
              }}
              className={`flex items-center justify-center gap-2 rounded-md py-2 text-xs font-medium transition-colors ${
                accountType === "student"
                  ? "gold-sheen bg-gold-metallic font-semibold text-brand-charcoal shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <GraduationCap className="size-4" aria-hidden="true" />
              <span>{authT.signup.studentTab}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAccountType("teacher");
                setErrorMessage(null);
              }}
              className={`flex items-center justify-center gap-2 rounded-md py-2 text-xs font-medium transition-colors ${
                accountType === "teacher"
                  ? "gold-sheen bg-gold-metallic font-semibold text-brand-charcoal shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BookOpen className="size-4" aria-hidden="true" />
              <span>{authT.signup.teacherTab}</span>
            </button>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            {accountType === "student"
              ? authT.signup.studentDescription
              : authT.signup.teacherDescription}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="signup-full-name">{authT.signup.fullNameLabel}</Label>
                <Input
                  id="signup-full-name"
                  name="fullName"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={authT.signup.fullNamePlaceholder}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="signup-email">{authT.signup.emailLabel}</Label>
                <Input
                  id="signup-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={authT.signup.emailPlaceholder}
                  required
                />
              </div>
            </div>

            {/* Country Code Selector with Flags + Phone Number */}
            <div className="grid gap-3 sm:grid-cols-[11.5rem_1fr]">
              <div className="grid gap-2">
                <Label htmlFor="signup-country">{authT.signup.countryCodeLabel}</Label>
                <select
                  id="signup-country"
                  value={countryIso2}
                  onChange={(e) => setCountryIso2(e.target.value)}
                  className={cn(fieldBase, "h-10 py-2")}
                >
                  {COUNTRY_CALLING_CODES.map((c) => (
                    <option key={c.iso2} value={c.iso2}>
                      {c.flag} {c.iso2} ({c.dialCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="signup-phone">{authT.signup.phoneLabel}</Label>
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
                />
              </div>
            </div>

            {/* Teacher-specific professional & educational fields */}
            {accountType === "teacher" ? (
              <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4">
                <div className="grid gap-2">
                  <Label htmlFor="signup-specialization">
                    {authT.signup.specializationLabel}
                  </Label>
                  <Input
                    id="signup-specialization"
                    name="specialization"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    placeholder={authT.signup.specializationPlaceholder}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="signup-qualifications">
                    {authT.signup.qualificationsLabel}
                  </Label>
                  <Textarea
                    id="signup-qualifications"
                    name="qualifications"
                    rows={3}
                    value={qualifications}
                    onChange={(e) => setQualifications(e.target.value)}
                    placeholder={authT.signup.qualificationsPlaceholder}
                    required
                  />
                </div>
              </div>
            ) : null}

            {/* Optional Profile Picture Upload */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="signup-avatar" className="flex items-center gap-1.5">
                  <ImagePlus className="size-4 text-gold-foreground" aria-hidden="true" />
                  <span>{authT.signup.avatarLabel}</span>
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  {authT.common.optionalTag}
                </span>
              </div>
              <Input
                id="signup-avatar"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={handleAvatarChange}
              />
              <p className="text-[11px] text-muted-foreground">{authT.signup.avatarHelp}</p>
            </div>

            {/* Password & Confirm Password with Visibility Toggles */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="signup-password">{authT.signup.passwordLabel}</Label>
                <div className="relative">
                  <Input
                    id="signup-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
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

              <div className="grid gap-2">
                <Label htmlFor="signup-confirm-password">
                  {authT.signup.confirmPasswordLabel}
                </Label>
                <div className="relative">
                  <Input
                    id="signup-confirm-password"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pe-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={
                      showConfirmPassword
                        ? authT.common.hidePassword
                        : authT.common.showPassword
                    }
                    className="absolute inset-y-0 end-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="size-4" aria-hidden="true" />
                    ) : (
                      <Eye className="size-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
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
              <UserPlus className="size-4" aria-hidden="true" />
              <span>
                {submitting
                  ? authT.signup.submittingButton
                  : accountType === "student"
                    ? authT.signup.submitStudentButton
                    : authT.signup.submitTeacherButton}
              </span>
            </Button>
          </form>

          {accountType === "student" ? (
            <>
              <div className="relative py-1">
                <Separator />
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2.5 text-[11px] text-muted-foreground">
                  {authT.common.orContinueWith}
                </span>
              </div>
              <GoogleOAuthButton label={authT.common.googleButton} />
            </>
          ) : null}
        </CardContent>

        <CardFooter className="justify-center border-t border-border/70 pt-4 text-xs text-muted-foreground">
          <p>
            {authT.signup.hasAccountPrompt}{" "}
            <Link href="/login" className="font-semibold text-gold-foreground hover:underline">
              {authT.signup.loginLink}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </AuthPageLayout>
  );
}
