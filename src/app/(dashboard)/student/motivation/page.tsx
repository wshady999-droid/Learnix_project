import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { StudentMotivationClient } from "@/components/student/student-motivation-client";
import { getStudentPerformanceAndGrowthData } from "@/services/student/queries";

export const metadata: Metadata = {
  title: "Motivation, Achievements & Certificates | Learnix Student",
  description: "Complete weekly learning challenges, unlock academic badges, and claim verified completion certificates.",
};

async function StudentMotivationLoader() {
  await connection();
  const res = await getStudentPerformanceAndGrowthData();
  if (!res.ok) {
    return <ErrorState description={res.error} />;
  }
  return <StudentMotivationClient data={res.data} />;
}

export default function StudentMotivationPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <StudentMotivationLoader />
    </Suspense>
  );
}
