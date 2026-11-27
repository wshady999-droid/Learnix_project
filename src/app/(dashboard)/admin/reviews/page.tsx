import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { AdminReviewsClient } from "@/components/admin/admin-reviews-client";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { getAdminReviewsModerationData } from "@/services/admin/queries";

export const metadata: Metadata = {
  title: "Reviews Moderation | Learnix Admin",
  description:
    "Moderate student course and teacher reviews with audited reasons while preserving rating integrity.",
};

async function AdminReviewsLoader() {
  await connection();
  const result = await getAdminReviewsModerationData();
  if (!result.ok) {
    return (
      <ErrorState
        title="Unable to load Reviews Moderation"
        description={result.error}
      />
    );
  }

  return <AdminReviewsClient data={result.data} />;
}

export default function AdminReviewsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AdminReviewsLoader />
    </Suspense>
  );
}
