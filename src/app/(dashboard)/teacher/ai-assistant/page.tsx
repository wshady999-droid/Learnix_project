import { Suspense } from "react";
import type { Metadata } from "next";

import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { TeacherAiAssistantClient } from "@/components/teacher/teacher-ai-assistant-client";
import { getAiWorkspaceHistoryData } from "@/services/ai/queries";
import {
  getTeacherCoursesData,
  getTeacherGradingData,
} from "@/services/teacher/queries";

export const metadata: Metadata = {
  title: "AI Teacher Assistant | Learnix Teacher",
  description: "AI exam generation, PDF/lesson question extraction, teaching plan suggestions, and weakness analysis.",
};

async function TeacherAiAssistantLoader() {
  const [coursesRes, gradingRes, historyRes] = await Promise.all([
    getTeacherCoursesData(),
    getTeacherGradingData(),
    getAiWorkspaceHistoryData("teacher"),
  ]);

  if (!coursesRes.ok) {
    return <ErrorState description={coursesRes.error} />;
  }
  if (!gradingRes.ok) {
    return <ErrorState description={gradingRes.error} />;
  }
  if (!historyRes.ok) {
    return <ErrorState description={historyRes.error} />;
  }

  return (
    <TeacherAiAssistantClient
      coursesData={coursesRes.data}
      gradingData={gradingRes.data}
      history={historyRes.data}
    />
  );
}

export default function TeacherAiAssistantPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <TeacherAiAssistantLoader />
    </Suspense>
  );
}
