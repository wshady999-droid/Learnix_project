"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Globe, Save, ShieldCheck } from "lucide-react";

import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input, fieldBase } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LOCALE_METADATA, SUPPORTED_LOCALES, type Locale } from "@/i18n";
import { getAdminDictionary } from "@/i18n/admin-dictionaries";
import type { Theme } from "@/lib/preferences";
import { cn } from "@/lib/utils";
import { adminSavePlatformSettingsAction } from "@/services/admin/actions";
import type { TableRow } from "@/services/db/utils";

interface AdminSettingsClientProps {
  settings: Array<TableRow<"platform_settings">>;
}

export function AdminSettingsClient({ settings }: AdminSettingsClientProps) {
  const router = useRouter();
  const { locale, t } = useLocale();
  const adminT = getAdminDictionary(locale);

  const identityRow = settings.find((s) => s.key === "platform_identity");
  const identityVal = (identityRow?.value ?? {}) as Record<string, unknown>;

  const policyRow = settings.find((s) => s.key === "security_policies");
  const policyVal = (policyRow?.value ?? {}) as Record<string, unknown>;

  const [platformName, setPlatformName] = useState(
    typeof identityVal.name === "string" ? identityVal.name : "Learnix",
  );
  const [tagline, setTagline] = useState(
    typeof identityVal.tagline === "string" ? identityVal.tagline : "Learnix",
  );
  const [defaultLocale, setDefaultLocale] = useState<Locale>(
    typeof identityVal.default_locale === "string"
      ? (identityVal.default_locale as Locale)
      : "en",
  );
  const [defaultTheme, setDefaultTheme] = useState<Theme>(
    typeof identityVal.default_theme === "string"
      ? (identityVal.default_theme as Theme)
      : "system",
  );

  const [maxExamViolations, setMaxExamViolations] = useState(
    typeof policyVal.max_exam_violations === "number"
      ? policyVal.max_exam_violations
      : 3,
  );
  const [requireTeacherApproval, setRequireTeacherApproval] = useState(
    typeof policyVal.require_teacher_approval === "boolean"
      ? policyVal.require_teacher_approval
      : true,
  );
  const [allowStudentSelfEnrollment, setAllowStudentSelfEnrollment] = useState(
    typeof policyVal.allow_student_self_enrollment === "boolean"
      ? policyVal.allow_student_self_enrollment
      : true,
  );
  const [maintenanceMode, setMaintenanceMode] = useState(
    typeof policyVal.maintenance_mode === "boolean"
      ? policyVal.maintenance_mode
      : false,
  );

  const [saving, setSaving] = useState(false);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const res = await adminSavePlatformSettingsAction({
      platformName,
      tagline,
      defaultLocale,
      defaultTheme,
      maxExamViolations: Number(maxExamViolations) || 3,
      requireTeacherApproval,
      allowStudentSelfEnrollment,
      maintenanceMode,
    });
    setSaving(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    toast.success(adminT.settings.settingsSavedToast);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {adminT.settings.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {adminT.settings.subtitle}
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Card variant="premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="size-4 text-gold-foreground" aria-hidden="true" />
              <span>{adminT.settings.platformIdentityTitle}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="set-name">
                {adminT.settings.platformNameLabel}
              </Label>
              <Input
                id="set-name"
                value={platformName}
                onChange={(e) => setPlatformName(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="set-tagline">
                {adminT.settings.taglineLabel}
              </Label>
              <Input
                id="set-tagline"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="set-locale">
                {adminT.settings.defaultLocaleLabel}
              </Label>
              <select
                id="set-locale"
                value={defaultLocale}
                onChange={(e) => setDefaultLocale(e.target.value as Locale)}
                className={cn(fieldBase, "h-10 py-2")}
              >
                {SUPPORTED_LOCALES.map((code) => (
                  <option key={code} value={code}>
                    {LOCALE_METADATA[code].nativeName} (
                    {LOCALE_METADATA[code].shortLabel})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="set-theme">
                {adminT.settings.defaultThemeLabel}
              </Label>
              <select
                id="set-theme"
                value={defaultTheme}
                onChange={(e) => setDefaultTheme(e.target.value as Theme)}
                className={cn(fieldBase, "h-10 py-2")}
              >
                <option value="light">{t.theme.light}</option>
                <option value="dark">{t.theme.dark}</option>
                <option value="system">{t.theme.system}</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck
                className="size-4 text-gold-foreground"
                aria-hidden="true"
              />
              <span>{adminT.settings.securityPolicyTitle}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid max-w-xs gap-1.5">
              <Label htmlFor="set-violations">
                {adminT.settings.maxExamViolationsLabel}
              </Label>
              <Input
                id="set-violations"
                type="number"
                min={0}
                max={20}
                value={maxExamViolations}
                onChange={(e) =>
                  setMaxExamViolations(Number(e.target.value) || 0)
                }
                required
              />
            </div>

            <div className="grid gap-2.5">
              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-xs font-medium text-foreground select-none">
                <span>{adminT.settings.requireTeacherApprovalLabel}</span>
                <input
                  type="checkbox"
                  checked={requireTeacherApproval}
                  onChange={(e) => setRequireTeacherApproval(e.target.checked)}
                  className="size-4 rounded border-input accent-brand-gold"
                />
              </label>

              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-xs font-medium text-foreground select-none">
                <span>{adminT.settings.allowStudentSelfEnrollmentLabel}</span>
                <input
                  type="checkbox"
                  checked={allowStudentSelfEnrollment}
                  onChange={(e) =>
                    setAllowStudentSelfEnrollment(e.target.checked)
                  }
                  className="size-4 rounded border-input accent-brand-gold"
                />
              </label>

              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-xs font-medium text-foreground select-none">
                <span>{adminT.settings.maintenanceModeLabel}</span>
                <input
                  type="checkbox"
                  checked={maintenanceMode}
                  onChange={(e) => setMaintenanceMode(e.target.checked)}
                  className="size-4 rounded border-input accent-brand-gold"
                />
              </label>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" variant="gold" loading={saving}>
            <Save className="size-4" aria-hidden="true" />
            <span>{adminT.settings.saveSettingsButton}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
