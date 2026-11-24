import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { AdminDepartmentsClient } from "@/components/admin/admin-departments-client";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { getAdminDepartmentsData } from "@/services/admin/queries";

export const metadata: Metadata = {
  title: "Department & Class Management",
  description:
    "Manage Learnix academic departments, educational levels, classes, and teacher-student assignments.",
};

async function AdminDepartmentsLoader() {
  await connection();
  const result = await getAdminDepartmentsData();
  if (!result.ok) {
    return (
      <ErrorState
        title="Unable to load Department Management"
        description={result.error}
      />
    );
  }

  return <AdminDepartmentsClient data={result.data} />;
}

export default function AdminDepartmentsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AdminDepartmentsLoader />
    </Suspense>
  );
}
