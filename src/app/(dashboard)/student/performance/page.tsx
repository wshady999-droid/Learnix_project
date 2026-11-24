import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { StudentPerformanceClient } from "@/components/student/student-performance-client";
import { getStudentPerformanceAndGrowthData } from "@/services/student/queries";

export const metadata: Metadata = {
  title: "Performance Dashboard | Learnix Student",
  description: "Track exam grades, course completion progress, strengths, weaknesses, and study hours.",
};

async function StudentPerformanceLoader() {
  await connection();
  const res = await getStudentPerformanceAndGrowthData();
  if (!res.ok) {
    return <ErrorState description={res.error} />;
  }
  return <StudentPerformanceClient data={res.data} />;
}

export default function StudentPerformancePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <StudentPerformanceLoader />
    </Suspense>
  );
}
