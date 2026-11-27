import { redirect } from "next/navigation";
import { connection } from "next/server";

import { AdminShell } from "@/components/admin/admin-shell";
import { StudentShell } from "@/components/student/student-shell";
import { TeacherShell } from "@/components/teacher/teacher-shell";
import { getCachedCallerProfile } from "@/services/db/utils";

/**
 * Wraps shared dashboard routes (`/messages`, `/calendar`, `/profile`, `/notifications`)
 * in the logged-in user's exact role shell (`StudentShell`, `TeacherShell`, or `AdminShell`)
 * so navigation and theme chrome stay 100% consistent across pages.
 */
export async function RoleDashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  const { userId, profile } = await getCachedCallerProfile();

  if (!userId || !profile) {
    redirect("/login?reason=session_expired");
  }

  if (profile.status === "suspended") {
    redirect("/login?reason=suspended");
  }

  const displayName =
    profile.full_name?.trim() || profile.email || "Learnix User";

  if (profile.role === "admin") {
    return (
      <AdminShell
        adminName={displayName}
        adminEmail={profile.email}
        adminAvatarUrl={profile.avatar_url}
      >
        {children}
      </AdminShell>
    );
  }

  if (profile.role === "teacher") {
    return (
      <TeacherShell
        teacherName={displayName}
        teacherEmail={profile.email}
        teacherAvatarUrl={profile.avatar_url}
      >
        {children}
      </TeacherShell>
    );
  }

  return (
    <StudentShell
      studentName={displayName}
      studentEmail={profile.email}
      studentAvatarUrl={profile.avatar_url}
    >
      {children}
    </StudentShell>
  );
}
