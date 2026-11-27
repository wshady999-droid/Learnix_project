import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { StudentAssignmentsClient } from "@/components/student/student-assignments-client";
import { getStudentAssignmentsData } from "@/services/student/queries";

export const metadata: Metadata = {
  title: "Assignments | Learnix",
  description:
    "View course assignments, upload solutions, save drafts, and check published instructor grades.",
};

async function StudentAssignmentsLoader() {
  await connection();
  const res = await getStudentAssignmentsData();
  if (!res.ok) {
    return <ErrorState description={res.error} />;
  }
  return <StudentAssignmentsClient data={res.data} />;
}

export default function StudentAssignmentsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <StudentAssignmentsLoader />
    </Suspense>
  );
}
