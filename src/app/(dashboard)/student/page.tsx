import { Suspense } from "react";
import type { Metadata } from "next";

import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { StudentOverviewClient } from "@/components/student/student-overview-client";
import { getStudentOverviewData } from "@/services/student/queries";

export const metadata: Metadata = {
  title: "Student Dashboard | Learnix",
  description: "Your enrolled courses, progress, upcoming exams, assignments, grades, and notifications.",
};

async function StudentOverviewLoader() {
  const res = await getStudentOverviewData();
  if (!res.ok) {
    return <ErrorState description={res.error} />;
  }
  return <StudentOverviewClient data={res.data} />;
}

export default function StudentOverviewPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <StudentOverviewLoader />
    </Suspense>
  );
}
