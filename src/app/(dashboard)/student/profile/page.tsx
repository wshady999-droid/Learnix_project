import { Suspense } from "react";
import type { Metadata } from "next";

import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { StudentProfileClient } from "@/components/student/student-profile-client";
import { getStudentPerformanceAndGrowthData } from "@/services/student/queries";

export const metadata: Metadata = {
  title: "Student Profile & Settings | Learnix Student",
  description: "Manage your avatar, personal information, password, language, theme, notifications, certificates, and achievements.",
};

async function StudentProfileLoader() {
  const res = await getStudentPerformanceAndGrowthData();
  if (!res.ok) {
    return <ErrorState description={res.error} />;
  }
  return <StudentProfileClient data={res.data} />;
}

export default function StudentProfilePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <StudentProfileLoader />
    </Suspense>
  );
}
