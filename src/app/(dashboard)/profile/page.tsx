import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { ProfileSettingsClient } from "@/components/auth/profile-settings-client";
import { LoadingState } from "@/components/feedback/loading-state";
import { RoleDashboardShell } from "@/components/navigation/role-dashboard-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Profile & Security",
  description: "Manage your Learnix profile, preferences, and account security.",
};

async function ProfileDataLoader() {
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    redirect("/login?reason=session_expired");
  }

  const [profileRes, teacherReqRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase
      .from("teacher_requests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!profileRes.data) {
    redirect("/login?reason=session_expired");
  }

  if (profileRes.data.status === "suspended") {
    redirect("/login?reason=suspended");
  }

  return (
    <RoleDashboardShell>
      <ProfileSettingsClient
        profile={profileRes.data}
        teacherRequest={teacherReqRes.data ?? null}
        embedded
      />
    </RoleDashboardShell>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ProfileDataLoader />
    </Suspense>
  );
}
