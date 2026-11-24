import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { AdminAnalyticsClient } from "@/components/admin/admin-analytics-client";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { getAdminAnalyticsReportData } from "@/services/admin/queries";

export const metadata: Metadata = {
  title: "Analytics & Reports",
  description:
    "Student performance, subject difficulty, instructor reports, and PDF/Excel exports for Learnix.",
};

async function AdminAnalyticsLoader() {
  await connection();
  const result = await getAdminAnalyticsReportData();
  if (!result.ok) {
    return (
      <ErrorState
        title="Unable to load Analytics & Reports"
        description={result.error}
      />
    );
  }

  return <AdminAnalyticsClient data={result.data} />;
}

export default function AdminAnalyticsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AdminAnalyticsLoader />
    </Suspense>
  );
}
