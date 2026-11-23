import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { LoadingState } from "@/components/feedback/loading-state";
import { StudentShell } from "@/components/student/student-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function StudentLayoutGuard({ children }: { children: React.ReactNode }) {
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    redirect("/login?reason=session_expired");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, avatar_url, role, status")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
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
