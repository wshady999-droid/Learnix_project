import type { Metadata } from "next";

import { AdminSettingsClient } from "@/components/admin/admin-settings-client";
import { ErrorState } from "@/components/feedback/error-state";
import { getAdminPlatformSettingsData } from "@/services/admin/queries";

export const metadata: Metadata = {
  title: "Admin Platform Settings",
  description:
    "Configure Learnix global identity, regional defaults, security thresholds, and user policies.",
};

export default async function AdminSettingsPage() {
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
