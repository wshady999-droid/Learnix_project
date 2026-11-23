import type { Metadata } from "next";

import { AdminAnalyticsClient } from "@/components/admin/admin-analytics-client";
import { ErrorState } from "@/components/feedback/error-state";
import { getAdminAnalyticsReportData } from "@/services/admin/queries";

export const metadata: Metadata = {
  title: "Analytics & Reports",
  description:
    "Student performance, subject difficulty, instructor reports, and PDF/Excel exports for Learnix.",
};

export default async function AdminAnalyticsPage() {
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
