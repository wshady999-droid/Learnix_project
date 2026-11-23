import { Suspense } from "react";
import type { Metadata } from "next";

import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { StudentRatingsClient } from "@/components/student/student-ratings-client";
import { getStudentPerformanceAndGrowthData } from "@/services/student/queries";

export const metadata: Metadata = {
  title: "Course & Teacher Ratings | Learnix Student",
  description: "Rate your enrolled courses and teachers from 1 to 5 stars and manage your reviews.",
};

async function StudentRatingsLoader() {
  const res = await getStudentPerformanceAndGrowthData();
  if (!res.ok) {
    return <ErrorState description={res.error} />;
  }
  return <StudentRatingsClient data={res.data} />;
}

export default function StudentRatingsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <StudentRatingsLoader />
    </Suspense>
  );
}
