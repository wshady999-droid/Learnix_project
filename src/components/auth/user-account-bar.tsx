"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LayoutDashboard, LogOut, Settings, ShieldCheck, User } from "lucide-react";

import { LanguageSelector } from "@/components/i18n/language-selector";
import { useLocale } from "@/components/i18n/locale-provider";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getAuthDictionary } from "@/i18n/auth-dictionaries";
import { getDashboardPathForRole } from "@/lib/auth/validation";
import { signOutAction } from "@/services/auth/actions";
import type { UserRole } from "@/types";

interface UserAccountBarProps {
  fullName: string | null;
  email: string;
  role: UserRole;
  avatarUrl: string | null;
}

export function UserAccountBar({
  fullName,
  email,
  role,
  avatarUrl,
}: UserAccountBarProps) {
  const router = useRouter();
  const { locale, t } = useLocale();
  const authT = getAuthDictionary(locale);
  const [signingOut, setSigningOut] = useState(false);

  const dashboardHref = getDashboardPathForRole(role);
  const roleLabel = t.roles[role];

  async function handleSignOut() {
    setSigningOut(true);
    await signOutAction();
    toast.success(authT.common.signedOutToast);
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Link
            href={dashboardHref}
            aria-label={t.brand.fullName}
            className="rounded-md focus-visible:outline-2 focus-visible:outline-ring"
          >
            <BrandLogo />
          </Link>
          <Badge variant="gold-subtle" className="hidden sm:inline-flex">
            <ShieldCheck className="size-3" aria-hidden="true" />
            <span>{roleLabel}</span>
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <LanguageSelector />
          <ThemeSwitcher />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt={fullName ?? email}
                    className="size-5 rounded-full object-cover"
                  />
                ) : (
                  <User className="size-4 text-gold-foreground" aria-hidden="true" />
                )}
                <span className="hidden max-w-36 truncate sm:inline">
                  {fullName || email}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="space-y-0.5">
                <p className="truncate text-xs font-semibold text-foreground">
                  {fullName || email}
                </p>
                <p className="truncate font-mono text-[11px] text-muted-foreground">
                  {email}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={dashboardHref}>
                  <LayoutDashboard className="size-4" aria-hidden="true" />
                  <span>{authT.common.dashboardLink}</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/profile">
                  <Settings className="size-4" aria-hidden="true" />
                  <span>{authT.common.profileSettingsLink}</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={signingOut}
                onClick={handleSignOut}
              >
                <LogOut className="size-4" aria-hidden="true" />
                <span>
                  {signingOut ? authT.common.signingOut : authT.common.signOut}
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
