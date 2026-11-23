import { Suspense } from "react";
import type { Metadata } from "next";
import { CalendarCheck } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getStudentAttendanceViewData } from "@/services/shared/queries";

export const metadata: Metadata = {
  title: "My Attendance History | Learnix Student",
  description: "View your recorded class attendance history, present/absent status, and attendance rate.",
};

async function StudentAttendanceLoader() {
  const res = await getStudentAttendanceViewData();
  if (!res.ok) {
    return <ErrorState description={res.error} />;
  }

  const data = res.data;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          My Attendance History
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track your class attendance rate, present/late/excused sessions, and teacher remarks.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="border-gold-primary/50 bg-gold-primary/5">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Attendance Rate</p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {data.attendanceRatePercent}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Sessions</p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {data.totalSessions}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Present</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {data.presentCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Late / Excused</p>
            <p className="mt-1 text-2xl font-bold text-gold-foreground">
              {data.lateCount + data.excusedCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Absent</p>
            <p className="mt-1 text-2xl font-bold text-destructive">
              {data.absentCount}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          {data.records.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title="No attendance records yet"
              description="Attendance records marked by your instructors will appear here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Session Topic</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.records.map((rec) => (
                  <TableRow key={rec.id}>
                    <TableCell className="font-semibold text-foreground">
                      {rec.courseTitle}
                    </TableCell>
                    <TableCell>{rec.topic}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {rec.sessionDate}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          rec.status === "absent"
                            ? "destructive"
                            : rec.status === "present"
                              ? "gold"
                              : "outline"
                        }
                        className="uppercase"
                      >
                        {rec.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {rec.remarks || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function StudentAttendancePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <StudentAttendanceLoader />
    </Suspense>
  );
}
