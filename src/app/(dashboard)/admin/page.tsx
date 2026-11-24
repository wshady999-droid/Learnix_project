import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { AdminOverviewClient } from "@/components/admin/admin-overview-client";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { getAdminOverviewData } from "@/services/admin/queries";

export const metadata: Metadata = {
  title: "Admin Overview",
  description: "Learnix Administrator Control Center Overview.",
};

async function AdminOverviewLoader() {
  await connection();
  const result = await getAdminOverviewData();
  if (!result.ok) {
    return <ErrorState title="Unable to load Admin Overview" description={result.error} />;
  }

  return <AdminOverviewClient data={result.data} />;
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AdminOverviewLoader />
    </Suspense>
  );
}
