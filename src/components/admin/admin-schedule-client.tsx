"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, ClipboardList, Plus, Trash2 } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { useLocale } from "@/components/i18n/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input, fieldBase } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAdminDictionary } from "@/i18n/admin-dictionaries";
import { cn } from "@/lib/utils";
import {
  adminCreateClassScheduleSlotAction,
  adminDeleteClassScheduleSlotAction,
} from "@/services/admin/actions";
import type { AdminScheduleAndAttendanceData } from "@/services/admin/queries";

interface AdminScheduleClientProps {
  data: AdminScheduleAndAttendanceData;
}

export function AdminScheduleClient({ data }: AdminScheduleClientProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const adminT = getAdminDictionary(locale);

  const [activeTab, setActiveTab] = useState<"timetable" | "attendance">("timetable");
  const [classId, setClassId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:30");
  const [room, setRoom] = useState("");
  const [saving, setSaving] = useState(false);

  const classesById = new Map(data.classes.map((c) => [c.id, c]));
  const coursesById = new Map(data.courses.map((c) => [c.id, c]));
  const profilesById = new Map(data.profiles.map((p) => [p.id, p]));
  const sessionsById = new Map(data.attendanceSessions.map((s) => [s.id, s]));

  const teachers = data.profiles.filter(
    (p) => p.role === "teacher" || p.role === "admin",
  );

  // Attendance statistics
  const presentCount = data.attendanceRecords.filter((r) => r.status === "present").length;
  const absentCount = data.attendanceRecords.filter((r) => r.status === "absent").length;
  const lateCount = data.attendanceRecords.filter((r) => r.status === "late").length;
  const excusedCount = data.attendanceRecords.filter((r) => r.status === "excused").length;
  const totalRecords = data.attendanceRecords.length;
  const absenceRate =
    totalRecords > 0 ? Number(((absentCount / totalRecords) * 100).toFixed(1)) : 0;

  async function handleCreateSchedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!classId || !courseId || !teacherId) {
      toast.error("Please select a Class, Course, and Teacher.");
      return;
    }

    setSaving(true);
    const res = await adminCreateClassScheduleSlotAction({
      classId,
      courseId,
      teacherId,
      dayOfWeek: Number(dayOfWeek),
      startTime,
      endTime,
      room: room || undefined,
    });
    setSaving(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    toast.success(adminT.departments.savedToast);
    setRoom("");
    router.refresh();
  }

  async function handleDeleteSchedule(id: string) {
    const res = await adminDeleteClassScheduleSlotAction(id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(adminT.departments.deletedToast);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {adminT.schedule.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {adminT.schedule.subtitle}
        </p>
      </div>

      {/* Attendance Summary Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="pt-2">
            <p className="text-xs text-muted-foreground">
              {adminT.schedule.presentCount}
            </p>
            <p className="mt-1 text-2xl font-bold text-success">{presentCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-2">
            <p className="text-xs text-muted-foreground">
              {adminT.schedule.absentCount}
            </p>
            <p className="mt-1 text-2xl font-bold text-destructive">{absentCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-2">
            <p className="text-xs text-muted-foreground">
              {adminT.schedule.lateCount}
            </p>
            <p className="mt-1 text-2xl font-bold text-warning">{lateCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-2">
            <p className="text-xs text-muted-foreground">
              {adminT.schedule.excusedCount}
            </p>
            <p className="mt-1 text-2xl font-bold text-info">{excusedCount}</p>
          </CardContent>
        </Card>
        <Card variant="premium">
          <CardContent className="pt-2">
            <p className="text-xs text-muted-foreground">
              {adminT.schedule.absenceRate}
            </p>
            <p className="mt-1 text-2xl font-bold text-gold-foreground">
              {absenceRate}%
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="inline-flex rounded-lg border border-border bg-muted p-1">
        {(
          [
            {
              id: "timetable",
              label: `${adminT.schedule.tabTimetable} (${data.schedules.length})`,
            },
            {
              id: "attendance",
              label: `${adminT.schedule.tabAttendance} (${data.attendanceRecords.length})`,
            },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "gold-sheen bg-gold-metallic font-semibold text-brand-charcoal shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "timetable" ? (
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.4fr]">
          <Card variant="premium">
            <CardHeader>
              <CardTitle className="text-base">
                {adminT.schedule.addScheduleSlot}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateSchedule} className="space-y-3.5">
                <div className="grid gap-1.5">
                  <Label htmlFor="sch-class">{adminT.departments.classLabel}</Label>
                  <select
                    id="sch-class"
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    className={cn(fieldBase, "h-10 py-2")}
                    required
                  >
                    <option value="">—</option>
                    {data.classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="sch-course">{adminT.courses.courseTitleCol}</Label>
                  <select
                    id="sch-course"
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    className={cn(fieldBase, "h-10 py-2")}
                    required
                  >
                    <option value="">—</option>
                    {data.courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="sch-teacher">{adminT.departments.teacherLabel}</Label>
                  <select
                    id="sch-teacher"
                    value={teacherId}
                    onChange={(e) => setTeacherId(e.target.value)}
                    className={cn(fieldBase, "h-10 py-2")}
                    required
                  >
                    <option value="">—</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name || t.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="sch-day">{adminT.schedule.dayOfWeekLabel}</Label>
                    <select
                      id="sch-day"
                      value={dayOfWeek}
                      onChange={(e) => setDayOfWeek(Number(e.target.value))}
                      className={cn(fieldBase, "h-10 py-2")}
                    >
                      {adminT.schedule.days.map((dayName, idx) => (
                        <option key={dayName} value={idx}>
                          {dayName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="sch-start">{adminT.schedule.startTimeLabel}</Label>
                    <Input
                      id="sch-start"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="sch-end">{adminT.schedule.endTimeLabel}</Label>
                    <Input
                      id="sch-end"
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="sch-room">{adminT.schedule.roomLabel}</Label>
                  <Input
                    id="sch-room"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    placeholder="Hall B-204"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" variant="gold" size="sm" loading={saving}>
                    <Plus className="size-4" aria-hidden="true" />
                    <span>{adminT.common.create}</span>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {adminT.schedule.tabTimetable}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.schedules.length === 0 ? (
                <EmptyState
                  icon={CalendarClock}
                  title={adminT.common.noRecordsTitle}
                  description={adminT.common.noRecordsDescription}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{adminT.schedule.dayOfWeekLabel}</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>{adminT.departments.classLabel}</TableHead>
                      <TableHead>{adminT.courses.courseTitleCol}</TableHead>
                      <TableHead>{adminT.departments.teacherLabel}</TableHead>
                      <TableHead className="text-end">
                        {adminT.common.actions}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.schedules.map((slot) => {
                      const cls = classesById.get(slot.class_id);
                      const crs = coursesById.get(slot.course_id);
                      const tch = profilesById.get(slot.teacher_id);
                      return (
                        <TableRow key={slot.id}>
                          <TableCell>
                            <Badge variant="gold-subtle">
                              {adminT.schedule.days[slot.day_of_week] ?? slot.day_of_week}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                          </TableCell>
                          <TableCell className="font-medium">
                            {cls ? `${cls.name} (${cls.code})` : "—"}
                          </TableCell>
                          <TableCell>{crs?.title ?? "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {tch?.full_name || tch?.email || "—"}
                          </TableCell>
                          <TableCell className="text-end">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleDeleteSchedule(slot.id)}
                            >
                              <Trash2
                                className="size-4 text-destructive"
                                aria-hidden="true"
                              />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {adminT.schedule.tabAttendance}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.attendanceRecords.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title={adminT.common.noRecordsTitle}
                description={adminT.common.noRecordsDescription}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>{adminT.departments.studentLabel}</TableHead>
                    <TableHead>{adminT.courses.courseTitleCol}</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.attendanceRecords.map((rec) => {
                    const session = sessionsById.get(rec.attendance_id);
                    const student = profilesById.get(rec.student_id);
                    const course = session
                      ? coursesById.get(session.course_id)
                      : null;
                    return (
                      <TableRow key={rec.id}>
                        <TableCell className="font-mono text-xs">
                          {session?.session_date ?? rec.recorded_at.slice(0, 10)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {student?.full_name || student?.email || rec.student_id}
                        </TableCell>
                        <TableCell>{course?.title ?? "—"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              rec.status === "present"
                                ? "success"
                                : rec.status === "absent"
                                  ? "destructive"
                                  : rec.status === "late"
                                    ? "warning"
                                    : "info"
                            }
                          >
                            {rec.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {rec.remarks || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
