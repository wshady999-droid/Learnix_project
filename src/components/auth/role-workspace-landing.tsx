"use client";

import Link from "next/link";
import {
  GraduationCap,
  Layers,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { UserAccountBar } from "@/components/auth/user-account-bar";
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
import { getAuthDictionary } from "@/i18n/auth-dictionaries";
import type { ProfileRow } from "@/services/db/users";
import type { UserRole } from "@/types";

interface RoleWorkspaceLandingProps {
  workspaceRole: UserRole;
  profile: ProfileRow;
}

export function RoleWorkspaceLanding({
  workspaceRole,
  profile,
}: RoleWorkspaceLandingProps) {
  const { locale, t } = useLocale();
  const authT = getAuthDictionary(locale);
  const roleLabel = t.roles[workspaceRole];

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <UserAccountBar
        fullName={profile.full_name}
        email={profile.email}
        role={profile.role}
        avatarUrl={profile.avatar_url}
      />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-10 sm:px-6 lg:px-8">
        <Card variant="premium">
          <CardHeader className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="gold">
                <Sparkles className="size-3.5" aria-hidden="true" />
                <span>{roleLabel}</span>
              </Badge>
              <Badge variant="gold-subtle">
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                <span>
                  {authT.profile.roleBadgeLabel}: {t.roles[profile.role]}
                </span>
              </Badge>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              {profile.full_name || profile.email}
            </CardTitle>
            <CardDescription className="font-mono text-xs">
              {profile.email}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <p className="text-xs text-muted-foreground">
                  {authT.profile.roleBadgeLabel}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <GraduationCap
                    className="size-4 text-gold-foreground"
                    aria-hidden="true"
                  />
                  <span>{t.roles[profile.role]}</span>
                </p>
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <p className="text-xs text-muted-foreground">{t.language.label}</p>
                <p className="mt-1 text-sm font-semibold text-foreground uppercase">
                  {profile.preferred_locale}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <p className="text-xs text-muted-foreground">{t.theme.label}</p>
                <p className="mt-1 text-sm font-semibold text-foreground capitalize">
                  {profile.preferred_theme}
                </p>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-wrap gap-3 border-t border-border/70 pt-4">
            <Button asChild variant="gold" size="sm">
              <Link href="/profile">
                <Settings className="size-4" aria-hidden="true" />
                <span>{authT.common.profileSettingsLink}</span>
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/">
                <Layers className="size-4" aria-hidden="true" />
                <span>{t.common.backToHome}</span>
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
