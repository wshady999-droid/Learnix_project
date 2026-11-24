import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { AdminUsersClient } from "@/components/admin/admin-users-client";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { getAdminUsersManagementData } from "@/services/admin/queries";

export const metadata: Metadata = {
  title: "User & Role Management",
  description:
    "Manage Learnix users, teacher requests, custom permissions, and Excel/CSV bulk imports.",
};

async function AdminUsersLoader() {
  await connection();
  const result = await getAdminUsersManagementData();
  if (!result.ok) {
    return <ErrorState title="Unable to load User Management" description={result.error} />;
  }

  return <AdminUsersClient data={result.data} />;
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AdminUsersLoader />
    </Suspense>
  );
}
