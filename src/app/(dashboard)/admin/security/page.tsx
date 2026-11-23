import type { Metadata } from "next";

import { AdminSecurityClient } from "@/components/admin/admin-security-client";
import { ErrorState } from "@/components/feedback/error-state";
import { getAdminSecurityControlData } from "@/services/admin/queries";

export const metadata: Metadata = {
  title: "Security & Audit Control",
  description:
    "Monitor Learnix login attempts, active devices, immutable audit logs, role permissions, and backup posture.",
};

export default async function AdminSecurityPage() {
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
