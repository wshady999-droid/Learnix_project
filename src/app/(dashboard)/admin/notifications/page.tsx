import type { Metadata } from "next";

import { AdminNotificationsClient } from "@/components/admin/admin-notifications-client";
import { ErrorState } from "@/components/feedback/error-state";
import { getAdminNotificationsData } from "@/services/admin/queries";

export const metadata: Metadata = {
  title: "Notifications & Announcements",
  description:
    "Broadcast targeted notifications and scheduled announcements across Learnix.",
};

export default async function AdminNotificationsPage() {
  const result = await getAdminNotificationsData();
  if (!result.ok) {
    return (
      <ErrorState
        title="Unable to load Notification Center"
        description={result.error}
      />
    );
  }

  return <AdminNotificationsClient data={result.data} />;
}
