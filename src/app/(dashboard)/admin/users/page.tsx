import type { Metadata } from "next";

import { AdminUsersClient } from "@/components/admin/admin-users-client";
import { ErrorState } from "@/components/feedback/error-state";
import { getAdminUsersManagementData } from "@/services/admin/queries";

export const metadata: Metadata = {
  title: "User & Role Management",
  description:
    "Manage Learnix users, teacher requests, custom permissions, and Excel/CSV bulk imports.",
};

export default async function AdminUsersPage() {
  const result = await getAdminUsersManagementData();
  if (!result.ok) {
    return <ErrorState title="Unable to load User Management" description={result.error} />;
  }

  return <AdminUsersClient data={result.data} />;
}
