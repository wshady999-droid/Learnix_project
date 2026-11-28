"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  Clock,
  Eye,
  MessageSquare,
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
  teacherSendStudentFeedbackAction,
} from "@/services/teacher/actions";
import type {
  AssignedStudentRow,
  TeacherStudentsData,
} from "@/services/teacher/queries";

interface TeacherStudentsClientProps {
  data: TeacherStudentsData;
}

type RosterFilterPreset =
  | "all"
  | "top10"
  | "lowest10"
  | "highest_grades"
  | "lowest_grades"
  | "attention";

export function TeacherStudentsClient({ data }: TeacherStudentsClientProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const t = getTeacherDictionary(locale);
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<
    "roster" | "falling-behind" | "feedback"
  >("roster");
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>(
    data.courses[0]?.id ?? "all",
  );
  const [rosterPreset, setRosterPreset] = useState<RosterFilterPreset>("all");
  const [search, setSearch] = useState("");
  const [profileStudent, setProfileStudent] =
    useState<AssignedStudentRow | null>(null);

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

  // Compute course-scoped student metrics when a specific course is selected
  const courseScopedStudents = useMemo(() => {
    const base =
      selectedCourseFilter === "all"
        ? data.students
        : data.students.filter((s) =>
            s.enrolledCourses.some((ec) => ec.courseId === selectedCourseFilter),
          );

    return base.map((stu) => {
      if (selectedCourseFilter === "all") {
        return {
          raw: stu,
          progressPercent: stu.averageProgressPercent,
          assignmentAvgPercent: stu.assignmentAveragePercent,
          quizAvgPercent: stu.examAveragePercent,
          overallPercent: stu.overallPerformancePercent,
          lastActivityAt: stu.lastActivityAt,
          needsAttention: stu.isFallingBehind,
        };
      }
      const cm = stu.enrolledCourses.find(
        (ec) => ec.courseId === selectedCourseFilter,
      );
      const progressPercent = cm?.progressPercent ?? 0;
      const assignmentAvgPercent = cm?.assignmentAveragePercent ?? 0;
      const quizAvgPercent = cm?.quizAveragePercent ?? 0;
      const overallPercent = cm?.overallPerformancePercent ?? 0;
      const needsAttention =
        progressPercent < 35 ||
        (overallPercent > 0 && overallPercent < 60);
      return {
        raw: stu,
        progressPercent,
        assignmentAvgPercent,
        quizAvgPercent,
        overallPercent,
        lastActivityAt: cm?.lastActivityAt ?? stu.lastActivityAt,
        needsAttention,
      };
    });
  }, [data.students, selectedCourseFilter]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = courseScopedStudents.filter(
      (item) =>
        !q ||
        item.raw.fullName.toLowerCase().includes(q) ||
        item.raw.email.toLowerCase().includes(q),
    );

    if (rosterPreset === "attention") {
      list = list.filter((item) => item.needsAttention);
    } else if (rosterPreset === "top10") {
      list = [...list]
        .sort((a, b) => b.overallPercent - a.overallPercent)
        .slice(0, 10);
    } else if (rosterPreset === "lowest10") {
      list = [...list]
        .sort((a, b) => a.overallPercent - b.overallPercent)
        .slice(0, 10);
    } else if (rosterPreset === "highest_grades") {
      list = [...list].sort((a, b) => b.overallPercent - a.overallPercent);
    } else if (rosterPreset === "lowest_grades") {
      list = [...list].sort((a, b) => a.overallPercent - b.overallPercent);
    }

    return list;
  }, [courseScopedStudents, search, rosterPreset]);

  const fallingBehindStudents = useMemo(
    () => data.students.filter((s) => s.isFallingBehind),
    [data.students],
  );

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

  const chatQuerySuffix =
    selectedCourseFilter !== "all" ? `&courseId=${selectedCourseFilter}` : "";

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
          variant={activeTab === "feedback" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("feedback")}
        >
          {t.students.tabFeedbackAnnouncements}
        </Button>
      </div>

      {activeTab === "roster" && (
        <div className="space-y-4">
          {/* Course Filter + Search */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">Course:</Label>
              <select
                className={cn(fieldBase, "h-9 w-64")}
                value={selectedCourseFilter}
                onChange={(e) => setSelectedCourseFilter(e.target.value)}
              >
                <option value="all">All My Courses</option>
                {data.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative min-w-[240px] flex-1 max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search student by name or email..."
                className="pl-9"
              />
            </div>
          </div>

          {/* Performance Filter Presets */}
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["all", "All Enrolled"],
                ["top10", "Top 10 Students"],
                ["lowest10", "Lowest 10 Students"],
                ["highest_grades", "Highest Grades"],
                ["lowest_grades", "Lowest Grades"],
                ["attention", "Students Needing Attention"],
              ] as const
            ).map(([presetKey, label]) => (
              <Button
                key={presetKey}
                size="sm"
                variant={rosterPreset === presetKey ? "gold" : "outline"}
                onClick={() => setRosterPreset(presetKey)}
              >
                {label}
              </Button>
            ))}
          </div>

          <Card>
            <CardContent className="pt-6">
              {filteredStudents.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title={t.common.noRecordsTitle}
                  description="No enrolled students match the selected course and filter."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Course Progress</TableHead>
                      <TableHead>Assignment Avg</TableHead>
                      <TableHead>Quiz Avg</TableHead>
                      <TableHead>Overall Performance</TableHead>
                      <TableHead>Last Activity</TableHead>
                      <TableHead className="text-right">
                        {t.common.actions}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((item) => {
                      const stu = item.raw;
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
                          <TableCell className="font-mono text-xs">
                            {item.progressPercent}%
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {item.assignmentAvgPercent}%
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {item.quizAvgPercent}%
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-foreground">
                                {item.overallPercent}%
                              </span>
                              <Badge
                                variant={
                                  item.needsAttention ? "destructive" : "gold"
                                }
                              >
                                {item.needsAttention
                                  ? "Needs Attention"
                                  : "On Track"}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {item.lastActivityAt
                              ? item.lastActivityAt
                                  .slice(0, 16)
                                  .replace("T", " ")
                              : "No activity"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1.5">
                              <Button asChild variant="gold" size="sm">
                                <Link
                                  href={`/messages?userId=${stu.studentId}${chatQuerySuffix}`}
                                >
                                  <MessageSquare className="size-3.5" />
                                  <span>Chat</span>
                                </Link>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setProfileStudent(stu)}
                              >
                                <Eye className="size-3.5" />
                                <span>Details</span>
                              </Button>
                            </div>
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
      )}

      {activeTab === "falling-behind" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t.students.tabFallingBehind}
            </CardTitle>
            <CardDescription>
              Students with course progress below 35% or quiz/assignment average below 60%.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {fallingBehindStudents.length === 0 ? (
              <EmptyState
                icon={AlertTriangle}
                title="All Assigned Students On Track"
                description="No assigned students are currently flagged as needing attention."
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
                        <Badge variant="destructive">Needs Attention</Badge>
                      </div>
                      <p className="font-mono text-muted-foreground">
                        {stu.email}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-3 pt-1">
                        <span>Progress: {stu.averageProgressPercent}%</span>
                        <span>Assign Avg: {stu.assignmentAveragePercent}%</span>
                        <span>Quiz Avg: {stu.examAveragePercent}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button asChild variant="gold" size="sm">
                        <Link href={`/messages?userId=${stu.studentId}`}>
                          <MessageSquare className="size-3.5" />
                          <span>Chat</span>
                        </Link>
                      </Button>
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
                      {c.title}
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
                placeholder="Academic Progress Feedback / Upcoming Quiz Reminder"
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
                    {profileStudent.assignmentAveragePercent}%
                  </p>
                  <p className="text-muted-foreground">Assignment Avg</p>
                </div>
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-base font-bold text-foreground">
                    {profileStudent.examAveragePercent}%
                  </p>
                  <p className="text-muted-foreground">Quiz Avg</p>
                </div>
                <div className="rounded-lg border border-border p-3 text-center">
                  <p className="text-base font-bold text-foreground">
                    {profileStudent.overallPerformancePercent}%
                  </p>
                  <p className="text-muted-foreground">Overall</p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-foreground">
                  {t.students.enrolledCoursesLabel}
                </h4>
                {profileStudent.enrolledCourses.map((ec) => (
                  <div
                    key={ec.courseId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 p-2.5"
                  >
                    <span className="font-medium text-foreground">
                      {ec.courseTitle}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline">
                        Progress {ec.progressPercent}%
                      </Badge>
                      <Badge variant="gold">
                        Overall {ec.overallPerformancePercent}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <h4 className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Clock className="size-3.5 text-emerald-500" />
                  <span>{t.students.recentActivityTitle}</span>
                </h4>
                {profileStudent.recentActivity.length === 0 ? (
                  <p className="text-muted-foreground">
                    No recent study activity recorded yet.
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

              <div className="flex flex-wrap gap-2">
                <Button asChild variant="gold" size="sm">
                  <Link href={`/messages?userId=${profileStudent.studentId}`}>
                    <MessageSquare className="size-3.5" />
                    <span>Open Direct Chat</span>
                  </Link>
                </Button>
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
                  <span>Send Feedback Alert</span>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
