import { Suspense } from "react";
import type { Metadata } from "next";

import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { TeacherGradingClient } from "@/components/teacher/teacher-grading-client";
import { getTeacherGradingData } from "@/services/teacher/queries";

export const metadata: Metadata = {
  title: "Grading, AI Essay Review & Results | Learnix Teacher",
  description: "Inspect exam submissions, approve or adjust AI essay scores, publish official results, and export reports.",
};

async function TeacherGradingLoader() {
  const res = await getTeacherGradingData();
  if (!res.ok) {
    return <ErrorState description={res.error} />;
  }
  return <TeacherGradingClient data={res.data} />;
}

export default function TeacherGradingPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <TeacherGradingLoader />
    </Suspense>
  );
}
