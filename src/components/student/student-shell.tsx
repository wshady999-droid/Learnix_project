"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BarChart3,
  Bell,
  BookOpen,
  ClipboardCheck,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Orbit,
  Settings,
  Sparkles,
  Star,
  User,
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
import { getStudentDictionary } from "@/i18n/student-dictionaries";
import { signOutAction } from "@/services/auth/actions";
import type { NavSection } from "@/types/navigation";

interface StudentShellProps {
  studentName: string;
  studentEmail: string;
  studentAvatarUrl: string | null;
  children: React.ReactNode;
}

export function StudentShell({
  studentName,
  studentEmail,
  studentAvatarUrl,
  children,
}: StudentShellProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const studentT = getStudentDictionary(locale);
  const authT = getAuthDictionary(locale);
  const [signingOut, setSigningOut] = useState(false);

  const sections: readonly NavSection[] = useMemo(
    () => [
      {
        id: "student-learning",
        title: studentT.nav.groupLearning,
        items: [
          {
            id: "student-overview",
            label: studentT.nav.overview,
            href: "/student",
            icon: LayoutDashboard,
            exact: true,
            mobilePrimary: true,
          },
          {
            id: "student-courses",
            label: "Explore Courses",
            href: "/student/courses",
            icon: BookOpen,
            mobilePrimary: true,
          },
          {
            id: "student-my-learning",
            label: studentT.nav.courses,
            href: "/student/my-learning",
            icon: Orbit,
            mobilePrimary: true,
          },
          {
            id: "student-assignments",
            label: "Assignments",
            href: "/student/assignments",
            icon: FileText,
          },
          {
            id: "student-exams",
            label: studentT.nav.exams,
            href: "/student/exams",
            icon: ClipboardCheck,
            mobilePrimary: true,
          },
        ],
      },
      {
        id: "student-intelligence",
        title: studentT.nav.groupGrowth,
        items: [
          {
            id: "student-messages",
            label: "Messages",
            href: "/messages",
            icon: MessageSquare,
          },
          {
            id: "student-ai-assistant",
            label: studentT.nav.aiAssistant,
            href: "/student/ai-assistant",
            icon: Sparkles,
            badge: "AI",
          },
          {
            id: "student-ratings",
            label: studentT.nav.ratings,
            href: "/student/ratings",
            icon: Star,
          },
          {
            id: "student-performance",
            label: studentT.nav.performance,
            href: "/student/performance",
            icon: BarChart3,
          },
        ],
      },
      {
        id: "student-account",
        title: "ACCOUNT",
        items: [
          {
            id: "student-notifications",
            label: "Notifications",
            href: "/notifications",
            icon: Bell,
          },
          {
            id: "student-profile",
            label: studentT.nav.profile,
            href: "/student/profile",
            icon: User,
          },
        ],
      },
    ],
    [studentT.nav],
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
      {/* الحاوية الرئيسية: شفافة عشان الصورة تبان */}
      <div className="relative flex min-h-dvh w-full bg-transparent text-foreground">
        
        {/* الباكجراوند الثابت */}
        <div className="fixed inset-0 z-[-1] bg-[url('/student-light.png')] bg-cover bg-center bg-no-repeat bg-fixed dark:bg-[url('/student-dark.png')]" />
        
        <AppSidebar sections={sections} />
        
        <div className="flex min-w-0 flex-1 flex-col">
          <AppTopbar
            sections={sections}
            title={`${studentT.overview.welcomePrefix} ${studentName}`}
            actions={
              <div className="flex items-center gap-2">
                <GlobalSearchTrigger />
                <NotificationBell />
                <LanguageSelector />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 bg-white/60 backdrop-blur-md dark:bg-black/40">
                      {studentAvatarUrl ? (
                        <img
                          src={studentAvatarUrl}
                          alt={studentName}
                          className="size-5 rounded-full object-cover"
                        />
                      ) : (
                        <GraduationCap
                          className="size-4 text-emerald-600 dark:text-emerald-400"
                          aria-hidden="true"
                        />
                      )}
                      <span className="hidden max-w-32 truncate sm:inline">
                        {studentName}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="space-y-0.5">
                      <p className="truncate text-xs font-semibold text-foreground">
                        {studentName}
                      </p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {studentEmail}
                      </p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/student/profile">
                        <User className="size-4" aria-hidden="true" />
                        <span>{studentT.nav.profile}</span>
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
                        {signingOut
                          ? authT.common.signingOut
                          : authT.common.signOut}
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