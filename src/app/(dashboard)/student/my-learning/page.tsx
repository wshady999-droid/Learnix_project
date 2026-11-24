import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { MyLearningOrbitClient } from "@/components/student/my-learning-orbit-client";
import { getStudentCoursesData } from "@/services/student/queries";

export const metadata: Metadata = {
  title: "My Learning Orbit | Learnix Student",
  description:
    "Interactive planetary orbit of your enrolled courses, progress tracking, and direct access to your active lessons.",
};

async function MyLearningOrbitLoader() {
  await connection();
  const res = await getStudentCoursesData();
  if (!res.ok) {
    return <ErrorState description={res.error} />;
  }
  return <MyLearningOrbitClient data={res.data} />;
}

export default function MyLearningOrbitPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <MyLearningOrbitLoader />
    </Suspense>
  );
}
