import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { AdminNotificationsClient } from "@/components/admin/admin-notifications-client";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { getAdminNotificationsData } from "@/services/admin/queries";

export const metadata: Metadata = {
  title: "Notifications & Announcements",
  description:
    "Broadcast targeted notifications and scheduled announcements across Learnix.",
};

async function AdminNotificationsLoader() {
  await connection();
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

export default function AdminNotificationsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AdminNotificationsLoader />
    </Suspense>
  );
}
