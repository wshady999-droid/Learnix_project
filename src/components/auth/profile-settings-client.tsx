"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Bell,
  Camera,
  Clock,
  Globe,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

import { PasswordStrengthChecklist } from "@/components/auth/password-strength-checklist";
import { UserAccountBar } from "@/components/auth/user-account-bar";
import { useLocale } from "@/components/i18n/locale-provider";
import { useTheme } from "@/components/theme/theme-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input, Textarea, fieldBase } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LOCALE_METADATA, SUPPORTED_LOCALES, type Locale } from "@/i18n";
import { getAuthDictionary } from "@/i18n/auth-dictionaries";
import {
  COUNTRY_CALLING_CODES,
  DEFAULT_COUNTRY_ISO2,
  findCountryByIso2,
} from "@/lib/auth/countries";
import { evaluatePasswordStrength } from "@/lib/auth/validation";
import type { Theme } from "@/lib/preferences";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  updatePasswordAction,
  updatePersonalProfileAction,
  updateProfilePreferencesAction,
} from "@/services/auth/actions";
import type { ProfileRow, TeacherRequestRow } from "@/services/db/users";

export interface NotificationPreferencesShape {
  email_updates: boolean;
  course_alerts: boolean;
  exam_reminders: boolean;
  grade_notifications: boolean;
  security_alerts: boolean;
}

interface ProfileSettingsClientProps {
  profile: ProfileRow;
  teacherRequest: TeacherRequestRow | null;
}

const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

function extractNationalDigits(phone: string | null, countryIso2: string | null): string {
  if (!phone) return "";
  const country = findCountryByIso2(countryIso2 || DEFAULT_COUNTRY_ISO2);
  if (phone.startsWith(country.dialCode)) {
    return phone.slice(country.dialCode.length);
  }
  return phone.replace(/^\+\d{1,3}/, "");
}

function parseNotificationPrefs(raw: unknown): NotificationPreferencesShape {
  const defaults: NotificationPreferencesShape = {
    email_updates: true,
    course_alerts: true,
    exam_reminders: true,
    grade_notifications: true,
    security_alerts: true,
  };
  if (!raw || typeof raw !== "object") return defaults;
  const obj = raw as Record<string, unknown>;
  return {
    email_updates: typeof obj.email_updates === "boolean" ? obj.email_updates : true,
    course_alerts: typeof obj.course_alerts === "boolean" ? obj.course_alerts : true,
    exam_reminders: typeof obj.exam_reminders === "boolean" ? obj.exam_reminders : true,
    grade_notifications:
      typeof obj.grade_notifications === "boolean" ? obj.grade_notifications : true,
    security_alerts: typeof obj.security_alerts === "boolean" ? obj.security_alerts : true,
  };
}

export function ProfileSettingsClient({
  profile,
  teacherRequest,
}: ProfileSettingsClientProps) {
  const router = useRouter();
  const { locale, setLocale, t } = useLocale();
  const { theme, setTheme } = useTheme();
  const authT = getAuthDictionary(locale);

  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [countryIso2, setCountryIso2] = useState(
    profile.country_code || DEFAULT_COUNTRY_ISO2,
  );
  const [phone, setPhone] = useState(
    extractNationalDigits(profile.phone, profile.country_code),
  );
  const [bio, setBio] = useState(profile.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [preferredLocale, setPreferredLocale] = useState<Locale>(
    (profile.preferred_locale as Locale) || locale,
  );
  const [preferredTheme, setPreferredTheme] = useState<Theme>(
    (profile.preferred_theme as Theme) || theme,
  );
  const [notifications, setNotifications] = useState<NotificationPreferencesShape>(() =>
    parseNotificationPrefs(profile.notification_preferences),
  );
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      toast.error(authT.signup.validation.avatarTypeError);
      event.target.value = "";
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      toast.error(authT.signup.validation.avatarSizeError);
      event.target.value = "";
      return;
    }

    setUploadingAvatar(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const filePath = `${profile.id}/avatar-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-pictures")
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) {
        toast.error(uploadError.message);
        setUploadingAvatar(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("profile-pictures")
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;
      setAvatarUrl(publicUrl);

      const updateRes = await updatePersonalProfileAction({
        fullName: fullName.trim() || profile.email,
        countryIso2,
        phone,
        bio,
        avatarUrl: publicUrl,
      });

      setUploadingAvatar(false);
      if (!updateRes.ok) {
        toast.error(updateRes.error);
        return;
      }

      toast.success(authT.profile.avatarUpdatedToast);
      router.refresh();
    } catch (err) {
      setUploadingAvatar(false);
      toast.error(err instanceof Error ? err.message : "Failed to upload avatar.");
    }
  }

  async function handleSavePersonalInfo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);

    const result = await updatePersonalProfileAction({
      fullName,
      countryIso2,
      phone,
      bio,
      avatarUrl,
    });

    setSavingProfile(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(authT.profile.profileSavedToast);
    router.refresh();
  }

  async function handleSavePreferences(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingPrefs(true);

    const result = await updateProfilePreferencesAction({
      preferredLocale,
      preferredTheme,
      notifications,
    });

    setSavingPrefs(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setLocale(preferredLocale);
    setTheme(preferredTheme);
    toast.success(authT.profile.preferencesSavedToast);
    router.refresh();
  }

  async function handleChangePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);

    const strength = evaluatePasswordStrength(newPassword);
    if (!strength.isValid) {
      setPasswordError(authT.passwordRules.heading);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError(authT.passwordRules.mismatch);
      return;
    }

    setSavingPassword(true);
    const result = await updatePasswordAction({
      password: newPassword,
      confirmPassword: confirmNewPassword,
    });
    setSavingPassword(false);

    if (!result.ok) {
      setPasswordError(result.error);
      return;
    }

    setNewPassword("");
    setConfirmNewPassword("");
    toast.success(authT.recovery.passwordUpdatedToast);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <UserAccountBar
        fullName={fullName || profile.full_name}
        email={profile.email}
        role={profile.role}
        avatarUrl={avatarUrl}
      />

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {authT.profile.pageTitle}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {authT.profile.pageSubtitle}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="gold">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              <span>
                {authT.profile.roleBadgeLabel}: {t.roles[profile.role]}
              </span>
            </Badge>
            {teacherRequest ? (
              <Badge
                variant={
                  teacherRequest.status === "approved"
                    ? "success"
                    : teacherRequest.status === "rejected"
                      ? "destructive"
                      : "warning"
                }
              >
                <Clock className="size-3" aria-hidden="true" />
                <span>
                  {teacherRequest.status === "approved"
                    ? authT.profile.teacherRequestApproved
                    : teacherRequest.status === "rejected"
                      ? authT.profile.teacherRequestRejected
                      : authT.profile.teacherRequestPending}
                </span>
              </Badge>
            ) : null}
          </div>
        </div>

        {/* 1. Personal Information & Avatar */}
        <Card variant="premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserCheck className="size-5 text-gold-foreground" aria-hidden="true" />
              <span>{authT.profile.personalInfoTitle}</span>
            </CardTitle>
            <CardDescription>{authT.profile.personalInfoDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-gold-border bg-gold-subtle text-xl font-bold text-gold-foreground">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt={fullName || profile.email}
                    className="size-full object-cover"
                  />
                ) : (
                  <span>{(fullName || profile.email).charAt(0).toUpperCase()}</span>
                )}
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="profile-avatar-upload"
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs transition-colors hover:border-gold-border hover:bg-accent"
                >
                  <Camera className="size-4 text-gold-foreground" aria-hidden="true" />
                  <span>
                    {uploadingAvatar
                      ? authT.profile.uploadingAvatarButton
                      : authT.profile.uploadAvatarButton}
                  </span>
                </Label>
                <input
                  id="profile-avatar-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  disabled={uploadingAvatar}
                  onChange={handleAvatarUpload}
                  className="sr-only"
                />
                <p className="text-xs text-muted-foreground">{authT.signup.avatarHelp}</p>
              </div>
            </div>

            <form onSubmit={handleSavePersonalInfo} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="profile-full-name">{authT.signup.fullNameLabel}</Label>
                  <Input
                    id="profile-full-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="profile-email">{authT.signup.emailLabel}</Label>
                  <Input id="profile-email" value={profile.email} disabled />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
                <div className="grid gap-2">
                  <Label htmlFor="profile-country">{authT.signup.countryCodeLabel}</Label>
                  <select
                    id="profile-country"
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
                  <Label htmlFor="profile-phone">{authT.signup.phoneLabel}</Label>
                  <Input
                    id="profile-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={authT.signup.phonePlaceholder}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="profile-bio">{authT.profile.bioLabel}</Label>
                <Textarea
                  id="profile-bio"
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder={authT.profile.bioPlaceholder}
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" variant="gold" loading={savingProfile}>
                  {savingProfile
                    ? authT.profile.savingProfileButton
                    : authT.profile.saveProfileButton}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* 2. Language, Theme & Notification Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="size-5 text-gold-foreground" aria-hidden="true" />
              <span>{authT.profile.preferencesTitle}</span>
            </CardTitle>
            <CardDescription>{authT.profile.preferencesDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSavePreferences} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="pref-locale">
                    {authT.profile.languagePreferenceLabel}
                  </Label>
                  <select
                    id="pref-locale"
                    value={preferredLocale}
                    onChange={(e) => setPreferredLocale(e.target.value as Locale)}
                    className={cn(fieldBase, "h-10 py-2")}
                  >
                    {SUPPORTED_LOCALES.map((code) => (
                      <option key={code} value={code}>
                        {LOCALE_METADATA[code].nativeName} ({LOCALE_METADATA[code].shortLabel})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="pref-theme">{authT.profile.themePreferenceLabel}</Label>
                  <select
                    id="pref-theme"
                    value={preferredTheme}
                    onChange={(e) => setPreferredTheme(e.target.value as Theme)}
                    className={cn(fieldBase, "h-10 py-2")}
                  >
                    <option value="light">{t.theme.light}</option>
                    <option value="dark">{t.theme.dark}</option>
                    <option value="system">{t.theme.system}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Bell className="size-4 text-gold-foreground" aria-hidden="true" />
                  <span>{authT.profile.notificationsTitle}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {authT.profile.notificationsDescription}
                </p>

                <div className="grid gap-2.5 pt-2">
                  {(
                    [
                      { key: "email_updates", label: authT.profile.notifEmailUpdates },
                      { key: "course_alerts", label: authT.profile.notifCourseAlerts },
                      { key: "exam_reminders", label: authT.profile.notifExamReminders },
                      {
                        key: "grade_notifications",
                        label: authT.profile.notifGradeNotifications,
                      },
                      { key: "security_alerts", label: authT.profile.notifSecurityAlerts },
                    ] as const
                  ).map((item) => (
                    <label
                      key={item.key}
                      className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-card px-3.5 py-2.5 text-xs font-medium text-foreground select-none"
                    >
                      <span>{item.label}</span>
                      <input
                        type="checkbox"
                        checked={notifications[item.key]}
                        onChange={(e) =>
                          setNotifications((prev) => ({
                            ...prev,
                            [item.key]: e.target.checked,
                          }))
                        }
                        className="size-4 rounded border-input accent-brand-gold"
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" variant="gold" loading={savingPrefs}>
                  {authT.profile.savePreferencesButton}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* 3. Password & Session Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <KeyRound className="size-5 text-gold-foreground" aria-hidden="true" />
              <span>{authT.profile.securityTitle}</span>
            </CardTitle>
            <CardDescription>{authT.profile.securityDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="profile-new-password">
                    {authT.recovery.newPasswordLabel}
                  </Label>
                  <Input
                    id="profile-new-password"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="profile-confirm-password">
                    {authT.recovery.confirmNewPasswordLabel}
                  </Label>
                  <Input
                    id="profile-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <PasswordStrengthChecklist
                password={newPassword}
                labels={authT.passwordRules}
              />

              {passwordError ? (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive-subtle p-3 text-xs font-medium text-destructive"
                >
                  <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{passwordError}</span>
                </div>
              ) : null}

              <div className="flex justify-end">
                <Button type="submit" variant="gold-outline" loading={savingPassword}>
                  {authT.profile.changePasswordButton}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
