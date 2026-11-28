import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { TeacherAssignmentsClient } from "@/components/teacher/teacher-assignments-client";
import { getTeacherGradingData } from "@/services/teacher/queries";

export const metadata: Metadata = {
  title: "Assignments & Grading | Learnix Teacher",
  description:
    "Manage assignment submissions, review AI-suggested grades, approve or adjust grades, and publish results.",
};

async function TeacherAssignmentsLoader() {
  await connection();
  const res = await getTeacherGradingData();
  if (!res.ok) {
    return <ErrorState description={res.error} />;
  }
  return <TeacherAssignmentsClient data={res.data} />;
}

export default function TeacherAssignmentsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <TeacherAssignmentsLoader />
    </Suspense>
  );
}
