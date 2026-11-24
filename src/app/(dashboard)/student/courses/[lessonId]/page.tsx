import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { StudentLessonViewerClient } from "@/components/student/student-lesson-viewer-client";
import { getStudentLessonViewerData } from "@/services/student/queries";

export const metadata: Metadata = {
  title: "Lesson Viewer | Learnix Student",
  description: "Watch video lectures, resume from your saved position, download materials, and take timestamped personal notes.",
};

async function LessonViewerLoader({
  paramsPromise,
}: {
  paramsPromise: Promise<{ lessonId: string }>;
}) {
  await connection();
  const { lessonId } = await paramsPromise;
  const res = await getStudentLessonViewerData(lessonId);
  if (!res.ok) {
    return <ErrorState description={res.error} />;
  }
  return <StudentLessonViewerClient data={res.data} />;
}

export default function StudentLessonViewerPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  return (
    <Suspense fallback={<LoadingState />}>
      <LessonViewerLoader paramsPromise={params} />
    </Suspense>
  );
}
