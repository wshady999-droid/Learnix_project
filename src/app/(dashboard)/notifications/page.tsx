import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { RoleDashboardShell } from "@/components/navigation/role-dashboard-shell";
import { NotificationsCenterClient } from "@/components/shared/notifications-center-client";
import { getMyNotificationsData } from "@/services/shared/queries";

export const metadata: Metadata = {
  title: "Notifications | Learnix",
  description: "Realtime academic notifications and alert preferences.",
};

async function NotificationsLoader() {
  await connection();
  const res = await getMyNotificationsData();
  if (!res.ok) {
    return (
      <RoleDashboardShell>
        <ErrorState description={res.error} />
      </RoleDashboardShell>
    );
  }

  return (
    <RoleDashboardShell>
      <NotificationsCenterClient
        userId={res.data.userId}
        unreadCount={res.data.unreadCount}
        preferences={res.data.preferences}
        items={res.data.items}
      />
    </RoleDashboardShell>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <NotificationsLoader />
    </Suspense>
  );
}
