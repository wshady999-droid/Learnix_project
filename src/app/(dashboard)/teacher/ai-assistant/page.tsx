import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { TeacherAiAssistantClient } from "@/components/teacher/teacher-ai-assistant-client";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAiWorkspaceHistoryData } from "@/services/ai/queries";
import { getTeacherCoursesData } from "@/services/teacher/queries";

export const metadata: Metadata = {
  title: "AI Teacher Assistant | Learnix Teacher",
  description: "AI exam generation, PDF/lesson question extraction, teaching plan suggestions, and weakness analysis.",
};

async function TeacherAiAssistantLoader() {
  await connection();
  const [coursesRes, historyRes] = await Promise.all([
    getTeacherCoursesData(),
    getAiWorkspaceHistoryData("teacher"),
  ]);

  if (!coursesRes.ok) {
    return <ErrorState description={coursesRes.error} />;
  }
  if (!historyRes.ok) {
    return <ErrorState description={historyRes.error} />;
  }

  const courseIds = coursesRes.data.courses.map((c) => c.id);
  const supabase = await createSupabaseServerClient();
  const examsRes =
    courseIds.length > 0
      ? await supabase
          .from("exams")
          .select("*")
          .in("course_id", courseIds)
          .order("created_at", { ascending: false })
      : { data: [] };

  return (
    <TeacherAiAssistantClient
      coursesData={coursesRes.data}
      gradingData={{ exams: examsRes.data ?? [] }}
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
