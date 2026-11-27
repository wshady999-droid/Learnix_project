import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { TeacherAnalyticsClient } from "@/components/teacher/teacher-analytics-client";
import { getTeacherAnalyticsData } from "@/services/teacher/queries";

export const metadata: Metadata = {
  title: "Course & Student Analytics | Learnix Teacher",
  description:
    "Analyze course completion, assignment and quiz averages, student engagement, and individual student performance.",
};

async function TeacherAnalyticsLoader() {
  await connection();
  const res = await getTeacherAnalyticsData();
  if (!res.ok) {
    return <ErrorState description={res.error} />;
  }
  return <TeacherAnalyticsClient data={res.data} />;
}

export default function TeacherAnalyticsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <TeacherAnalyticsLoader />
    </Suspense>
  );
}
