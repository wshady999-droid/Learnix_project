import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { LoadingState } from "@/components/feedback/loading-state";
import { StudentShell } from "@/components/student/student-shell";
import { getCachedCallerProfile } from "@/services/db/utils";

async function StudentLayoutGuard({ children }: { children: React.ReactNode }) {
  await connection();
  const { userId, profile } = await getCachedCallerProfile();

  if (!userId || !profile) {
    redirect("/login?reason=session_expired");
  }

  if (profile.status === "suspended") {
    redirect("/login?reason=suspended");
  }

  return (
    <StudentShell
      studentName={profile.full_name || profile.email}
      studentEmail={profile.email}
      studentAvatarUrl={profile.avatar_url}
    >
      {children}
    </StudentShell>
  );
}

export default function StudentDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<LoadingState />}>
      <StudentLayoutGuard>{children}</StudentLayoutGuard>
    </Suspense>
  );
}
