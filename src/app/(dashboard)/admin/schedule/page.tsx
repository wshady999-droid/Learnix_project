import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { AdminScheduleClient } from "@/components/admin/admin-schedule-client";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { getAdminScheduleAndAttendanceData } from "@/services/admin/queries";

export const metadata: Metadata = {
  title: "Schedules & Attendance",
  description:
    "Manage Learnix class schedules, teacher timetables, and attendance analytics.",
};

async function AdminScheduleLoader() {
  await connection();
  const result = await getAdminScheduleAndAttendanceData();
  if (!result.ok) {
    return (
      <ErrorState
        title="Unable to load Schedules & Attendance"
        description={result.error}
      />
    );
  }

  return <AdminScheduleClient data={result.data} />;
}

export default function AdminSchedulePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AdminScheduleLoader />
    </Suspense>
  );
}
