"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarCheck,
  Clock,
  Eye,
  MessageSquarePlus,
  Search,
  Send,
  Users,
} from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { useLocale } from "@/components/i18n/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, Textarea, fieldBase } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getTeacherDictionary } from "@/i18n/teacher-dictionaries";
import { cn } from "@/lib/utils";
import {
  teacherRecordAttendanceAction,
  teacherSendStudentFeedbackAction,
} from "@/services/teacher/actions";
import type {
  AssignedStudentRow,
  TeacherStudentsData,
} from "@/services/teacher/queries";

interface TeacherStudentsClientProps {
  data: TeacherStudentsData;
}

export function TeacherStudentsClient({ data }: TeacherStudentsClientProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const t = getTeacherDictionary(locale);
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<
    "roster" | "falling-behind" | "attendance" | "feedback"
  >("roster");
  const [search, setSearch] = useState("");
  const [profileStudent, setProfileStudent] =
    useState<AssignedStudentRow | null>(null);

  // Attendance form state
  const [attendanceCourseId, setAttendanceCourseId] = useState<string>(
    data.courses[0]?.id ?? "",
  );
  const [sessionTitle, setSessionTitle] = useState("Weekly Lecture Session");
  const [sessionDate, setSessionDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [attendanceStatuses, setAttendanceStatuses] = useState<
    Record<string, "present" | "absent" | "late" | "excused">
  >({});

  // Feedback / Announcement form state
  const [feedbackMode, setFeedbackMode] = useState<"personal" | "course">(
    "personal",
  );
  const [targetStudentId, setTargetStudentId] = useState<string>(
    data.students[0]?.studentId ?? "",
  );
  const [targetCourseId, setTargetCourseId] = useState<string>(
    data.courses[0]?.id ?? "",
  );
  const [feedbackSubject, setFeedbackSubject] = useState("");
  const [feedbackBody, setFeedbackBody] = useState("");

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.students;
    return data.students.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q),
    );
  }, [data.students, search]);

  const fallingBehindStudents = useMemo(
    () => data.students.filter((s) => s.isFallingBehind),
    [data.students],
  );

  const studentsInAttendanceCourse = useMemo(
    () =>
      data.students.filter((s) =>
        s.enrolledCourses.some((ec) => ec.courseId === attendanceCourseId),
      ),
    [data.students, attendanceCourseId],
  );

  function handleSaveAttendance() {
    if (!attendanceCourseId) {
      toast.error("Select a course first.");
      return;
    }
    const targetList =
      studentsInAttendanceCourse.length > 0
        ? studentsInAttendanceCourse
        : data.students;

    if (targetList.length === 0) {
      toast.error("No assigned students found to record attendance.");
      return;
    }

    startTransition(async () => {
      const res = await teacherRecordAttendanceAction({
        courseId: attendanceCourseId,
        title: sessionTitle,
        sessionDate,
        entries: targetList.map((stu) => ({
          studentId: stu.studentId,
          status: attendanceStatuses[stu.studentId] ?? "present",
        })),
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success(t.students.attendanceSavedToast);
      router.refresh();
    });
  }

  function handleSendFeedback() {
    startTransition(async () => {
      const res = await teacherSendStudentFeedbackAction({
        mode: feedbackMode,
        studentId: feedbackMode === "personal" ? targetStudentId : undefined,
        courseId: feedbackMode === "course" ? targetCourseId : undefined,
        title: feedbackSubject,
        body: feedbackBody,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success(t.students.feedbackSentToast);
      setFeedbackSubject("");
      setFeedbackBody("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t.students.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.students.subtitle}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeTab === "roster" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("roster")}
        >
          {t.students.tabRoster}
        </Button>
        <Button
          variant={activeTab === "falling-behind" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("falling-behind")}
        >
          {t.students.tabFallingBehind} ({fallingBehindStudents.length})
        </Button>
        <Button
          variant={activeTab === "attendance" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("attendance")}
        >
          {t.students.tabAttendance}
        </Button>
        <Button
          variant={activeTab === "feedback" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("feedback")}
        >
          {t.students.tabFeedbackAnnouncements}
        </Button>
      </div>

      {activeTab === "roster" && (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.common.searchPlaceholder}
              className="pl-9"
            />
          </div>

          <Card>
            <CardContent className="pt-6">
              {filteredStudents.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title={t.common.noRecordsTitle}
                  description={t.common.noRecordsDescription}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.students.studentNameLabel}</TableHead>
                      <TableHead>{t.students.enrolledCoursesLabel}</TableHead>
                      <TableHead>{t.students.averageProgressLabel}</TableHead>
                      <TableHead>{t.students.examAverageLabel}</TableHead>
                      <TableHead>{t.students.attendanceRateLabel}</TableHead>
                      <TableHead>{t.students.studyTimeLabel}</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">
                        {t.common.actions}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((stu) => (
                      <TableRow key={stu.studentId}>
                        <TableCell>
                          <p className="font-semibold text-foreground">
                            {stu.fullName}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {stu.email}
                          </p>
                        </TableCell>
                        <TableCell className="text-xs">
                          {stu.enrolledCourses.length > 0
                            ? stu.enrolledCourses
                                .map((c) => c.courseTitle)
                                .join(", ")
                            : "Assigned Direct"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {stu.averageProgressPercent}%
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {stu.examAveragePercent}% ({stu.examsTakenCount})
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {stu.attendanceRatePercent}%
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {stu.totalStudyMinutes} min
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              stu.isFallingBehind ? "destructive" : "gold"
                            }
                          >
                            {stu.isFallingBehind
                              ? t.students.fallingBehindBadge
                              : t.students.onTrackBadge}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setProfileStudent(stu)}
                          >
                            <Eye className="size-3.5" />
                            <span>{t.students.openProfileButton}</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "falling-behind" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t.students.tabFallingBehind}
            </CardTitle>
            <CardDescription>
              Students with course progress below 35%, exam average below 60%, or attendance rate under 70%.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {fallingBehindStudents.length === 0 ? (
              <EmptyState
                icon={AlertTriangle}
                title="All Assigned Students On Track"
                description="No assigned students are currently flagged as falling behind."
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {fallingBehindStudents.map((stu) => (
                  <div
                    key={stu.studentId}
                    className="flex flex-col justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground">
                          {stu.fullName}
                        </p>
                        <Badge variant="destructive">
                          {t.students.fallingBehindBadge}
                        </Badge>
                      </div>
                      <p className="font-mono text-muted-foreground">
                        {stu.email}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-3 pt-1">
                        <span>Progress: {stu.averageProgressPercent}%</span>
                        <span>Exam Avg: {stu.examAveragePercent}%</span>
                        <span>Attendance: {stu.attendanceRatePercent}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setProfileStudent(stu)}
                      >
                        <Eye className="size-3.5" />
                        <span>{t.students.openProfileButton}</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "attendance" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t.students.recordAttendanceTitle}
            </CardTitle>
            <CardDescription>
              {t.students.recordAttendanceDescription}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>{t.students.targetCourseLabel}</Label>
                <select
                  className={cn(fieldBase, "h-9 w-full")}
                  value={attendanceCourseId}
                  onChange={(e) => setAttendanceCourseId(e.target.value)}
                >
                  {data.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>{t.students.sessionTitleLabel}</Label>
                <Input
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t.students.sessionDateLabel}</Label>
                <Input
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                />
              </div>
            </div>

            {(studentsInAttendanceCourse.length > 0
              ? studentsInAttendanceCourse
              : data.students
            ).length === 0 ? (
              <EmptyState
                icon={CalendarCheck}
                title={t.common.noRecordsTitle}
                description="Enroll students in your course to mark their attendance."
              />
            ) : (
              <div className="space-y-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.students.studentNameLabel}</TableHead>
                      <TableHead>Attendance Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(studentsInAttendanceCourse.length > 0
                      ? studentsInAttendanceCourse
                      : data.students
                    ).map((stu) => {
                      const current =
                        attendanceStatuses[stu.studentId] ?? "present";
                      return (
                        <TableRow key={stu.studentId}>
                          <TableCell>
                            <p className="font-semibold text-foreground">
                              {stu.fullName}
                            </p>
                            <p className="font-mono text-xs text-muted-foreground">
                              {stu.email}
                            </p>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1.5">
                              {(
                                [
                                  ["present", t.students.statusPresent],
                                  ["late", t.students.statusLate],
                                  ["excused", t.students.statusExcused],
                                  ["absent", t.students.statusAbsent],
                                ] as const
                              ).map(([statusKey, label]) => (
                                <Button
                                  key={statusKey}
                                  type="button"
                                  size="sm"
                                  variant={
                                    current === statusKey ? "gold" : "outline"
                                  }
                                  onClick={() =>
                                    setAttendanceStatuses((prev) => ({
                                      ...prev,
                                      [stu.studentId]: statusKey,
                                    }))
                                  }
                                >
                                  {label}
                                </Button>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                <Button
                  variant="gold"
                  disabled={isPending}
                  onClick={handleSaveAttendance}
                >
                  <CalendarCheck className="size-4" />
                  <span>{t.students.saveAttendanceButton}</span>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "feedback" && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="text-base">
              {t.students.sendFeedbackTitle}
            </CardTitle>
            <CardDescription>
              {t.students.sendFeedbackDescription}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t.students.recipientModeLabel}</Label>
              <select
                className={cn(fieldBase, "h-9 w-full")}
                value={feedbackMode}
                onChange={(e) =>
                  setFeedbackMode(e.target.value as "personal" | "course")
                }
              >
                <option value="personal">
                  {t.students.modePersonalFeedback}
                </option>
                <option value="course">
                  {t.students.modeCourseAnnouncement}
                </option>
              </select>
            </div>

            {feedbackMode === "personal" ? (
              <div className="space-y-1.5">
                <Label>{t.students.targetStudentLabel}</Label>
                <select
                  className={cn(fieldBase, "h-9 w-full")}
                  value={targetStudentId}
                  onChange={(e) => setTargetStudentId(e.target.value)}
                >
                  {data.students.map((s) => (
                    <option key={s.studentId} value={s.studentId}>
                      {s.fullName} ({s.email})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>{t.students.targetCourseLabel}</Label>
                <select
                  className={cn(fieldBase, "h-9 w-full")}
                  value={targetCourseId}
                  onChange={(e) => setTargetCourseId(e.target.value)}
                >
                  {data.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>{t.students.subjectLabel}</Label>
              <Input
                value={feedbackSubject}
                onChange={(e) => setFeedbackSubject(e.target.value)}
                placeholder="Academic Progress Feedback / Upcoming Midterm Reminder"
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t.students.messageBodyLabel}</Label>
              <Textarea
                rows={4}
                value={feedbackBody}
                onChange={(e) => setFeedbackBody(e.target.value)}
                placeholder="Write constructive guidance or announcement details..."
              />
            </div>

            <Button
              variant="gold"
              disabled={isPending}
              onClick={handleSendFeedback}
            >
              <Send className="size-4" />
              <span>{t.students.sendDispatchButton}</span>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* STUDENT PROFILE & LEARNING ACTIVITY DIALOG */}
      <Dialog
        open={Boolean(profileStudent)}
        onOpenChange={(open) => {
          if (!open) setProfileStudent(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t.students.profileDialogTitle}</DialogTitle>
            <DialogDescription>
              {profileStudent?.fullName} • {profileStudent?.email}
            </DialogDescription>
          </DialogHeader>

          {profileStudent && (
            <div className="space-y-4 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-base font-bold text-foreground">
                    {profileStudent.averageProgressPercent}%
                  </p>
                  <p className="text-muted-foreground">Progress</p>
                </div>
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-base font-bold text-foreground">
                    {profileStudent.examAveragePercent}%
                  </p>
                  <p className="text-muted-foreground">Exam Avg</p>
                </div>
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-base font-bold text-foreground">
                    {profileStudent.attendanceRatePercent}%
                  </p>
                  <p className="text-muted-foreground">Attendance</p>
                </div>
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-base font-bold text-foreground">
                    {profileStudent.totalStudyMinutes}m
                  </p>
                  <p className="text-muted-foreground">Study Time</p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-foreground">
                  {t.students.enrolledCoursesLabel}
                </h4>
                {profileStudent.enrolledCourses.map((ec) => (
                  <div
                    key={ec.courseId}
                    className="flex items-center justify-between rounded-lg border border-border/80 p-2.5"
                  >
                    <span className="font-medium text-foreground">
                      {ec.courseTitle}
                    </span>
                    <Badge variant="outline">{ec.progressPercent}%</Badge>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <h4 className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Clock className="size-3.5 text-gold-foreground" />
                  <span>{t.students.recentActivityTitle}</span>
                </h4>
                {profileStudent.recentActivity.length === 0 ? (
                  <p className="text-muted-foreground">
                    No recent study sessions recorded yet.
                  </p>
                ) : (
                  profileStudent.recentActivity.map((act) => (
                    <div
                      key={act.id}
                      className="rounded-lg border border-border/70 p-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">
                          {act.title}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {act.timestamp.slice(0, 16).replace("T", " ")}
                        </span>
                      </div>
                      <p className="mt-0.5 text-muted-foreground">
                        {act.detail}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFeedbackMode("personal");
                  setTargetStudentId(profileStudent.studentId);
                  setActiveTab("feedback");
                  setProfileStudent(null);
                }}
              >
                <MessageSquarePlus className="size-3.5" />
                <span>Prepare Personal Feedback</span>
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
