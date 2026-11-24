import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { AdminSecurityClient } from "@/components/admin/admin-security-client";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { getAdminSecurityControlData } from "@/services/admin/queries";

export const metadata: Metadata = {
  title: "Security & Audit Control",
  description:
    "Monitor Learnix login attempts, active devices, immutable audit logs, role permissions, and backup posture.",
};

async function AdminSecurityLoader() {
  await connection();
  const result = await getAdminSecurityControlData();
  if (!result.ok) {
    return (
      <ErrorState
        title="Unable to load Security & Audit Control"
        description={result.error}
      />
    );
  }

  return <AdminSecurityClient data={result.data} />;
}

export default function AdminSecurityPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AdminSecurityLoader />
    </Suspense>
  );
}
