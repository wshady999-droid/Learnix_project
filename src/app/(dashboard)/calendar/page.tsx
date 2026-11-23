import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";

import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { SmartCalendarClient } from "@/components/shared/smart-calendar-client";
import { getSmartCalendarData } from "@/services/shared/queries";

export const metadata: Metadata = {
  title: "Smart Academic Calendar | Learnix",
  description: "Class schedules, examination windows, assignment deadlines, and study sessions.",
};

async function SmartCalendarLoader() {
  await connection();
  const res = await getSmartCalendarData();
  if (!res.ok) {
    return <ErrorState description={res.error} />;
  }
  return <SmartCalendarClient role={res.data.role} events={res.data.events} />;
}

export default function SmartCalendarPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SmartCalendarLoader />
    </Suspense>
  );
}
