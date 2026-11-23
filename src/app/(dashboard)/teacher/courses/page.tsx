import { Suspense } from "react";
import type { Metadata } from "next";

import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { TeacherCoursesClient } from "@/components/teacher/teacher-courses-client";
import { getTeacherCoursesData } from "@/services/teacher/queries";

export const metadata: Metadata = {
  title: "Course & Curriculum Management | Learnix Teacher",
  description: "Create courses, organize chapters, upload videos/PDFs/PowerPoints, schedule lessons, and set post-lesson quizzes.",
};

async function TeacherCoursesLoader() {
  const res = await getTeacherCoursesData();
  if (!res.ok) {
    return <ErrorState description={res.error} />;
  }
  return <TeacherCoursesClient data={res.data} />;
}

export default function TeacherCoursesPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <TeacherCoursesLoader />
    </Suspense>
  );
}
