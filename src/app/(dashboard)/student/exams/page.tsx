import { Suspense } from "react";
import type { Metadata } from "next";

import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { StudentExamsClient } from "@/components/student/student-exams-client";
import { getStudentExamsCenterData } from "@/services/student/queries";

export const metadata: Metadata = {
  title: "Online Examinations | Learnix Student",
  description: "Take assigned online examinations with proctoring, auto-save protection, and instant results.",
};

async function StudentExamsLoader() {
  const res = await getStudentExamsCenterData();
  if (!res.ok) {
    return <ErrorState description={res.error} />;
  }
  return <StudentExamsClient data={res.data} />;
}

export default function StudentExamsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <StudentExamsLoader />
    </Suspense>
  );
}
