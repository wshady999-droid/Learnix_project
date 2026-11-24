import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { StudentAiAssistantClient } from "@/components/student/student-ai-assistant-client";
import { getAiWorkspaceHistoryData } from "@/services/ai/queries";
import { getStudentCoursesData } from "@/services/student/queries";

export const metadata: Metadata = {
  title: "AI Study Assistant | Learnix Student",
  description: "Course Q&A, PDF discussions, summaries, flashcards, practice quizzes, scientific terminology translation, and study plans.",
};

async function StudentAiAssistantLoader() {
  await connection();
  const [coursesRes, historyRes] = await Promise.all([
    getStudentCoursesData(),
    getAiWorkspaceHistoryData("student"),
  ]);

  if (!coursesRes.ok) {
    return <ErrorState description={coursesRes.error} />;
  }
  if (!historyRes.ok) {
    return <ErrorState description={historyRes.error} />;
  }

  return (
    <StudentAiAssistantClient
      data={coursesRes.data}
      history={historyRes.data}
    />
  );
}

export default function StudentAiAssistantPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <StudentAiAssistantLoader />
    </Suspense>
  );
}
