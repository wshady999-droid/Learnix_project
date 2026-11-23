"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Award,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  LogOut,
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

  const sections: readonly NavSection[] = [
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
          label: studentT.nav.courses,
          href: "/student/courses",
          icon: BookOpen,
          mobilePrimary: true,
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
      title: studentT.nav.groupIntelligence,
      items: [
        {
          id: "student-ai-assistant",
          label: studentT.nav.aiAssistant,
          href: "/student/ai-assistant",
          icon: Sparkles,
          badge: "AI",
          mobilePrimary: true,
        },
        {
          id: "student-performance",
          label: studentT.nav.performance,
          href: "/student/performance",
          icon: BarChart3,
          mobilePrimary: true,
        },
      ],
    },
    {
      id: "student-growth",
      title: studentT.nav.groupGrowth,
      items: [
        {
          id: "student-motivation",
          label: studentT.nav.motivation,
          href: "/student/motivation",
          icon: Award,
        },
        {
          id: "student-ratings",
          label: studentT.nav.ratings,
          href: "/student/ratings",
          icon: Star,
        },
        {
          id: "student-profile",
          label: studentT.nav.profile,
          href: "/student/profile",
          icon: User,
        },
      ],
    },
  ];

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
            title={`${studentT.overview.welcomePrefix} ${studentName}`}
            subtitle={studentT.overview.subtitle}
            actions={
              <div className="flex items-center gap-2">
                <GlobalSearchTrigger />
                <NotificationBell />
                <LanguageSelector />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      {studentAvatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={studentAvatarUrl}
                          alt={studentName}
                          className="size-5 rounded-full object-cover"
                        />
                      ) : (
                        <GraduationCap
                          className="size-4 text-gold-foreground"
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
