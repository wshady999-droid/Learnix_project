import { Suspense } from "react";
import type { Metadata } from "next";

import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { TeacherOverviewClient } from "@/components/teacher/teacher-overview-client";
import { getTeacherOverviewData } from "@/services/teacher/queries";

export const metadata: Metadata = {
  title: "Teacher Command Center | Learnix",
  description: "Overview of your assigned courses, enrolled students, upcoming classes, and grading queue.",
};

async function TeacherOverviewLoader() {
  const res = await getTeacherOverviewData();
  if (!res.ok) {
    return <ErrorState description={res.error} />;
  }
  return <TeacherOverviewClient data={res.data} />;
}

export default function TeacherOverviewPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <TeacherOverviewLoader />
    </Suspense>
  );
}
