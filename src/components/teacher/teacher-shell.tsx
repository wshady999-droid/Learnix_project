"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Award,
  BookOpen,
  ClipboardCheck,
  FileCheck2,
  LayoutDashboard,
  LogOut,
  Settings,
  Sparkles,
  Star,
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
import { getAuthDictionary } from "@/i18n/auth-dictionaries";
import { getTeacherDictionary } from "@/i18n/teacher-dictionaries";
import { signOutAction } from "@/services/auth/actions";
import type { NavSection } from "@/types/navigation";

interface TeacherShellProps {
  teacherName: string;
  teacherEmail: string;
  teacherAvatarUrl: string | null;
  children: React.ReactNode;
}

export function TeacherShell({
  teacherName,
  teacherEmail,
  teacherAvatarUrl,
  children,
}: TeacherShellProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const teacherT = getTeacherDictionary(locale);
  const authT = getAuthDictionary(locale);
  const [signingOut, setSigningOut] = useState(false);

  const sections: readonly NavSection[] = useMemo(
    () => [
      {
        id: "teacher-teaching",
        title: teacherT.nav.groupTeaching,
        items: [
          {
            id: "teacher-overview",
            label: teacherT.nav.overview,
            href: "/teacher",
            icon: LayoutDashboard,
            exact: true,
            mobilePrimary: true,
          },
          {
            id: "teacher-courses",
            label: teacherT.nav.courses,
            href: "/teacher/courses",
            icon: BookOpen,
            mobilePrimary: true,
          },
          {
            id: "teacher-students",
            label: teacherT.nav.students,
            href: "/teacher/students",
            icon: Users,
            mobilePrimary: true,
          },
        ],
      },
      {
        id: "teacher-assessment",
        title: teacherT.nav.groupAssessment,
        items: [
          {
            id: "teacher-exams",
            label: teacherT.nav.exams,
            href: "/teacher/exams",
            icon: ClipboardCheck,
            mobilePrimary: true,
          },
          {
            id: "teacher-grading",
            label: teacherT.nav.grading,
            href: "/teacher/grading",
            icon: FileCheck2,
          },
        ],
      },
      {
        id: "teacher-intelligence",
        title: teacherT.nav.groupIntelligence,
        items: [
          {
            id: "teacher-ai-assistant",
            label: teacherT.nav.aiAssistant,
            href: "/teacher/ai-assistant",
            icon: Sparkles,
            badge: "AI",
          },
          {
            id: "teacher-ratings",
            label: teacherT.nav.ratings,
            href: "/teacher/ratings",
            icon: Star,
          },
        ],
      },
    ],
    [teacherT.nav],
  );

  async function handleSignOut() {
    setSigningOut(true);
    await signOutAction();
    toast.success(authT.common.signedOutToast);
    router.push("/login");
    router.refresh();
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-dvh w-full bg-background text-foreground">
        <AppSidebar sections={sections} />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppTopbar
            sections={sections}
            title={teacherT.overview.title}
            subtitle={teacherT.overview.subtitle}
            actions={
              <div className="flex items-center gap-2">
                <GlobalSearchTrigger />
                <NotificationBell />
                <LanguageSelector />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      {teacherAvatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={teacherAvatarUrl}
                          alt={teacherName}
                          className="size-5 rounded-full object-cover"
                        />
                      ) : (
                        <User className="size-4 text-gold-foreground" aria-hidden="true" />
                      )}
                      <span className="hidden max-w-32 truncate sm:inline">
                        {teacherName}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="space-y-0.5">
                      <p className="flex items-center gap-1.5 truncate text-xs font-semibold text-foreground">
                        <Award className="size-3.5 text-gold-foreground" />
                        <span>{teacherName}</span>
                      </p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {teacherEmail}
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
