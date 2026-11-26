"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CalendarClock,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldAlert,
  User,
  Users,
} from "lucide-react";

import { LanguageSelector } from "@/components/i18n/language-selector";
import { useLocale } from "@/components/i18n/locale-provider";
import { GlobalSearchTrigger } from "@/components/shared/global-search-trigger";
import { NotificationBell } from "@/components/shared/notification-bell";
import {
  AppSidebar,
  AppTopbar,
  MobileBottomNav,
} from "@/components/navigation/app-navigation";
import { SidebarProvider } from "@/components/navigation/sidebar-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getAdminDictionary } from "@/i18n/admin-dictionaries";
import { getAuthDictionary } from "@/i18n/auth-dictionaries";
import { signOutAction } from "@/services/auth/actions";
import type { NavSection } from "@/types/navigation";

interface AdminShellProps {
  adminName: string;
  adminEmail: string;
  adminAvatarUrl: string | null;
  children: React.ReactNode;
}

export function AdminShell({
  adminName,
  adminEmail,
  adminAvatarUrl,
  children,
}: AdminShellProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const adminT = getAdminDictionary(locale);
  const authT = getAuthDictionary(locale);
  const [signingOut, setSigningOut] = useState(false);

  const sections: readonly NavSection[] = useMemo(
    () => [
      {
        id: "admin-governance",
        title: adminT.nav.groupGovernance,
        items: [
          {
            id: "admin-overview",
            label: adminT.nav.overview,
            href: "/admin",
            icon: LayoutDashboard,
            exact: true,
            mobilePrimary: true,
          },
          {
            id: "admin-users",
            label: adminT.nav.users,
            href: "/admin/users",
            icon: Users,
            mobilePrimary: true,
          },
          {
            id: "admin-departments",
            label: adminT.nav.departments,
            href: "/admin/departments",
            icon: Building2,
          },
        ],
      },
      {
        id: "admin-academic",
        title: adminT.nav.groupAcademic,
        items: [
          {
            id: "admin-courses",
            label: adminT.nav.courses,
            href: "/admin/courses",
            icon: BookOpen,
            mobilePrimary: true,
          },
          {
            id: "admin-schedule",
            label: adminT.nav.schedule,
            href: "/admin/schedule",
            icon: CalendarClock,
          },
          {
            id: "admin-analytics",
            label: adminT.nav.analytics,
            href: "/admin/analytics",
            icon: BarChart3,
            mobilePrimary: true,
          },
        ],
      },
      {
        id: "admin-operations",
        title: adminT.nav.groupOperations,
        items: [
          {
            id: "admin-security",
            label: adminT.nav.security,
            href: "/admin/security",
            icon: ShieldAlert,
          },
          {
            id: "admin-notifications",
            label: adminT.nav.notifications,
            href: "/admin/notifications",
            icon: Bell,
          },
          {
            id: "admin-settings",
            label: adminT.nav.settings,
            href: "/admin/settings",
            icon: Settings,
          },
        ],
      },
    ],
    [adminT.nav],
  );

  async function handleSignOut() {
    setSigningOut(true);
    await signOutAction();
    toast.success(authT.common.signedOutToast);
    router.push("/login");
    router.refresh();
  }

  // دالة الترجمة للـ 5 لغات مع اللقب
  const getWelcomeMessage = (loc: string) => {
    switch (loc) {
      case "ar": return "أهلاً بعودتك، بشمنهدس";
      case "de": return "Willkommen zurück, Ing."; 
      case "it": return "Bentornato, Ing.";        
      case "fr": return "Bon retour, Ing.";        
      case "en":
      default: return "Welcome back, Eng.";        
    }
  };

  return (
    <SidebarProvider>
      <div className="relative flex min-h-dvh w-full bg-transparent text-foreground">
        
        {/* الباكجراوند الثابت */}
        <div className="fixed inset-0 z-[-1] bg-[url('/student-light.png')] bg-cover bg-center bg-no-repeat bg-fixed dark:bg-[url('/student-dark.png')]" />
        
        <AppSidebar sections={sections} />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppTopbar
            sections={sections}
            title={`${getWelcomeMessage(locale)} ${adminName}`}
            actions={
              <div className="flex items-center gap-2">
                <GlobalSearchTrigger />
                <NotificationBell />
                <LanguageSelector />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 bg-white/20 backdrop-blur-md dark:bg-[#121a19]">
                      {adminAvatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={adminAvatarUrl}
                          alt={adminName}
                          className="size-5 rounded-full object-cover"
                        />
                      ) : (
                        <User className="size-4 text-emerald-500" aria-hidden="true" />
                      )}
                      <span className="hidden max-w-32 truncate sm:inline">
                        {adminName}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="space-y-0.5">
                      <p className="truncate text-xs font-semibold text-foreground">
                        {adminName}
                      </p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {adminEmail}
                      </p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
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
            }
          />

          <main
            id="main-content"
            className="mx-auto w-full max-w-[1600px] flex-1 px-4 pt-6 pb-24 sm:px-6 md:pb-12 lg:px-8"
          >
            {children}
          </main>
        </div>
        <MobileBottomNav sections={sections} />
      </div>
    </SidebarProvider>
  );
}