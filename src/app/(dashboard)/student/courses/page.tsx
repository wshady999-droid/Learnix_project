import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { StudentCoursesClient } from "@/components/student/student-courses-client";
import { getStudentCoursesData } from "@/services/student/queries";

export const metadata: Metadata = {
  title: "My Courses & Lessons | Learnix Student",
  description: "Explore your enrolled courses, chapters, lessons, video resume positions, and favorite lessons.",
};

async function StudentCoursesLoader() {
  await connection();
  const res = await getStudentCoursesData();
  if (!res.ok) {
    return <ErrorState description={res.error} />;
  }
  return <StudentCoursesClient data={res.data} />;
}

export default function StudentCoursesPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <StudentCoursesLoader />
    </Suspense>
  );
}
