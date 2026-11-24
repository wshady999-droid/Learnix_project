import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { AdminShell } from "@/components/admin/admin-shell";
import { LoadingState } from "@/components/feedback/loading-state";
import { getDashboardPathForRole } from "@/lib/auth/validation";
import { getCachedCallerProfile } from "@/services/db/utils";

async function AdminLayoutGuard({ children }: { children: React.ReactNode }) {
  await connection();
  const { userId, profile } = await getCachedCallerProfile();

  if (!userId || !profile) {
    redirect("/login?reason=session_expired");
  }

  if (profile.status === "suspended") {
    redirect("/login?reason=suspended");
  }

  if (profile.role !== "admin") {
    redirect(getDashboardPathForRole(profile.role));
  }

  return (
    <AdminShell
      adminName={profile.full_name || profile.email}
      adminEmail={profile.email}
      adminAvatarUrl={profile.avatar_url}
    >
      {children}
    </AdminShell>
  );
}

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<LoadingState />}>
      <AdminLayoutGuard>{children}</AdminLayoutGuard>
    </Suspense>
  );
}
