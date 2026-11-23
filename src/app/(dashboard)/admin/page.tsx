import type { Metadata } from "next";

import { AdminOverviewClient } from "@/components/admin/admin-overview-client";
import { ErrorState } from "@/components/feedback/error-state";
import { getAdminOverviewData } from "@/services/admin/queries";

export const metadata: Metadata = {
  title: "Admin Overview",
  description: "Learnix Administrator Control Center Overview.",
};

export default async function AdminDashboardPage() {
  const result = await getAdminOverviewData();
  if (!result.ok) {
    return <ErrorState title="Unable to load Admin Overview" description={result.error} />;
  }

  return <AdminOverviewClient data={result.data} />;
}
