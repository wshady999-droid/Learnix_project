import { Suspense } from "react";
import type { Metadata } from "next";

import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { TeacherExamsClient } from "@/components/teacher/teacher-exams-client";
import { getTeacherExamBuilderData } from "@/services/teacher/queries";

export const metadata: Metadata = {
  title: "Smart Examination Builder | Learnix Teacher",
  description: "Author multi-version examinations with MCQ, True/False, and Essay items, diagrams, and random bank selection.",
};

async function TeacherExamsLoader() {
  const res = await getTeacherExamBuilderData();
  if (!res.ok) {
    return <ErrorState description={res.error} />;
  }
  return <TeacherExamsClient data={res.data} />;
}

export default function TeacherExamsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <TeacherExamsLoader />
    </Suspense>
  );
}
