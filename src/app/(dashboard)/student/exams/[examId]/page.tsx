import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { StudentExamRunnerClient } from "@/components/student/student-exam-runner-client";
import { getStudentExamRunnerData } from "@/services/student/queries";

export const metadata: Metadata = {
  title: "Examination Session | Learnix Student",
  description: "Secure online examination runner with countdown timer, auto-save, dynamic watermark, camera consent, and instant grading.",
};

async function StudentExamRunnerLoader({
  paramsPromise,
}: {
  paramsPromise: Promise<{ examId: string }>;
}) {
  await connection();
  const { examId } = await paramsPromise;
  const res = await getStudentExamRunnerData(examId);
  if (!res.ok) {
    return <ErrorState description={res.error} />;
  }
  return <StudentExamRunnerClient data={res.data} />;
}

export default function StudentExamRunnerPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  return (
    <Suspense fallback={<LoadingState />}>
      <StudentExamRunnerLoader paramsPromise={params} />
    </Suspense>
  );
}
