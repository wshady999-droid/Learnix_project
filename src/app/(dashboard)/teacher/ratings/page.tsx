import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { TeacherRatingsClient } from "@/components/teacher/teacher-ratings-client";
import { getTeacherRatingsData } from "@/services/teacher/queries";

export const metadata: Metadata = {
  title: "Course & Teacher Ratings | Learnix Teacher",
  description: "Review verified student ratings and written feedback across your assigned courses.",
};

async function TeacherRatingsLoader() {
  await connection();
  const res = await getTeacherRatingsData();
  if (!res.ok) {
    return <ErrorState description={res.error} />;
  }
  return <TeacherRatingsClient data={res.data} />;
}

export default function TeacherRatingsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <TeacherRatingsLoader />
    </Suspense>
  );
}
