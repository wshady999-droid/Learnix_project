import type { Metadata } from "next";

import { AdminCoursesClient } from "@/components/admin/admin-courses-client";
import { ErrorState } from "@/components/feedback/error-state";
import { getAdminCoursesData } from "@/services/admin/queries";

export const metadata: Metadata = {
  title: "Course Governance",
  description:
    "Approve, publish, archive, and monitor Learnix courses, enrollments, and ratings.",
};

export default async function AdminCoursesPage() {
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
