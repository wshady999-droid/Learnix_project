import type { Metadata } from "next";

import { AdminScheduleClient } from "@/components/admin/admin-schedule-client";
import { ErrorState } from "@/components/feedback/error-state";
import { getAdminScheduleAndAttendanceData } from "@/services/admin/queries";

export const metadata: Metadata = {
  title: "Schedules & Attendance",
  description:
    "Manage Learnix class schedules, teacher timetables, and attendance analytics.",
};

export default async function AdminSchedulePage() {
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
