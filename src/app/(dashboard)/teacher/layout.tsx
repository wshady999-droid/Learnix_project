import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { LoadingState } from "@/components/feedback/loading-state";
import { TeacherShell } from "@/components/teacher/teacher-shell";
import { getDashboardPathForRole } from "@/lib/auth/validation";
import { getCachedCallerProfile } from "@/services/db/utils";

async function TeacherLayoutGuard({ children }: { children: React.ReactNode }) {
  await connection();
  const { userId, profile } = await getCachedCallerProfile();

  if (!userId || !profile) {
    redirect("/login?reason=session_expired");
  }

  if (profile.status === "suspended") {
    redirect("/login?reason=suspended");
  }

  if (profile.role !== "teacher" && profile.role !== "admin") {
    redirect(getDashboardPathForRole(profile.role));
  }

  return (
    <TeacherShell
      teacherName={profile.full_name || profile.email}
      teacherEmail={profile.email}
      teacherAvatarUrl={profile.avatar_url}
    >
      {children}
    </TeacherShell>
  );
}

export default function TeacherDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<LoadingState />}>
      <TeacherLayoutGuard>{children}</TeacherLayoutGuard>
    </Suspense>
  );
}
