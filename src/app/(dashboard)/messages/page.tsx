import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { MessagingClient } from "@/components/shared/messaging-client";
import { getMessagingData } from "@/services/shared/queries";

export const metadata: Metadata = {
  title: "Internal Messaging | Learnix",
  description: "Secure student-teacher conversations with file attachments and notification alerts.",
};

async function MessagingLoader() {
  await connection();
  const res = await getMessagingData();
  if (!res.ok) {
    return <ErrorState description={res.error} />;
  }
  return <MessagingClient data={res.data} />;
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <MessagingLoader />
    </Suspense>
  );
}
