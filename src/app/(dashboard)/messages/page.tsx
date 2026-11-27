import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { RoleDashboardShell } from "@/components/navigation/role-dashboard-shell";
import { MessagingClient } from "@/components/shared/messaging-client";
import { getMessagingData } from "@/services/shared/queries";

export const metadata: Metadata = {
  title: "Messages | Learnix",
  description:
    "Realtime student-teacher conversations with read status, attachments, and notification alerts.",
};

async function MessagingLoader() {
  await connection();
  const res = await getMessagingData();
  if (!res.ok) {
    return (
      <RoleDashboardShell>
        <ErrorState description={res.error} />
      </RoleDashboardShell>
    );
  }
  return (
    <RoleDashboardShell>
      <MessagingClient data={res.data} />
    </RoleDashboardShell>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <MessagingLoader />
    </Suspense>
  );
}
