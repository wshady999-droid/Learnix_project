import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { AdminSettingsClient } from "@/components/admin/admin-settings-client";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { getAdminPlatformSettingsData } from "@/services/admin/queries";

export const metadata: Metadata = {
  title: "Admin Platform Settings",
  description:
    "Configure Learnix global identity, regional defaults, security thresholds, and user policies.",
};

async function AdminSettingsLoader() {
  await connection();
  const result = await getAdminPlatformSettingsData();
  if (!result.ok) {
    return (
      <ErrorState
        title="Unable to load Platform Settings"
        description={result.error}
      />
    );
  }

  return <AdminSettingsClient settings={result.data} />;
}

export default function AdminSettingsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AdminSettingsLoader />
    </Suspense>
  );
}
