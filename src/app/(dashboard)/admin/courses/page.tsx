import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { AdminCoursesClient } from "@/components/admin/admin-courses-client";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { getAdminCoursesData } from "@/services/admin/queries";

export const metadata: Metadata = {
  title: "Course Governance",
  description:
    "Approve, publish, archive, and monitor Learnix courses, enrollments, and ratings.",
};

async function AdminCoursesLoader() {
  await connection();
  const result = await getAdminCoursesData();
  if (!result.ok) {
    return (
      <ErrorState
        title="Unable to load Course Governance"
        description={result.error}
      />
    );
  }

  return <AdminCoursesClient data={result.data} />;
}

export default function AdminCoursesPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AdminCoursesLoader />
    </Suspense>
  );
}
