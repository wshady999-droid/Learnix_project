import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { TeacherStudentsClient } from "@/components/teacher/teacher-students-client";
import { getTeacherStudentsData } from "@/services/teacher/queries";

export const metadata: Metadata = {
  title: "Assigned Student Management | Learnix Teacher",
  description: "Monitor progress, identify at-risk learners, and send personal feedback or announcements.",
};

async function TeacherStudentsLoader() {
  await connection();
  const res = await getTeacherStudentsData();
  if (!res.ok) {
    return <ErrorState description={res.error} />;
  }
  return <TeacherStudentsClient data={res.data} />;
}

export default function TeacherStudentsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <TeacherStudentsLoader />
    </Suspense>
  );
}
