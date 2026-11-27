"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Award,
  BarChart3,
  BookCheck,
  Clock,
  Eye,
  FileCheck2,
  MessageSquare,
  TrendingUp,
  Users,
} from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
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
import { fieldBase } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type {
  AssignedStudentRow,
  TeacherAnalyticsData,
} from "@/services/teacher/queries";

interface TeacherAnalyticsClientProps {
  data: TeacherAnalyticsData;
}

export function TeacherAnalyticsClient({ data }: TeacherAnalyticsClientProps) {
  const [selectedCourseId, setSelectedCourseId] = useState<string>("all");
  const [inspectedStudent, setInspectedStudent] =
    useState<AssignedStudentRow | null>(null);

  const filteredCourses = useMemo(
    () =>
      selectedCourseId === "all"
        ? data.coursesSummary
        : data.coursesSummary.filter((c) => c.courseId === selectedCourseId),
    [data.coursesSummary, selectedCourseId],
  );

  const scopedStudents = useMemo(() => {
    const base =
      selectedCourseId === "all"
        ? data.students
        : data.students.filter((s) =>
            s.enrolledCourses.some((ec) => ec.courseId === selectedCourseId),
          );

    return base.map((stu) => {
      if (selectedCourseId === "all") {
        return {
          raw: stu,
          completion: stu.averageProgressPercent,
          assignmentAvg: stu.assignmentAveragePercent,
          quizAvg: stu.examAveragePercent,
          overall: stu.overallPerformancePercent,
          needsAttention: stu.isFallingBehind,
        };
      }
      const cm = stu.enrolledCourses.find(
        (ec) => ec.courseId === selectedCourseId,
      );
      const completion = cm?.progressPercent ?? 0;
      const assignmentAvg = cm?.assignmentAveragePercent ?? 0;
      const quizAvg = cm?.quizAveragePercent ?? 0;
      const overall = cm?.overallPerformancePercent ?? 0;
      return {
        raw: stu,
        completion,
        assignmentAvg,
        quizAvg,
        overall,
        needsAttention: completion < 35 || (overall > 0 && overall < 60),
      };
    });
  }, [data.students, selectedCourseId]);

  const topStudents = useMemo(
    () =>
      [...scopedStudents]
        .sort((a, b) => b.overall - a.overall)
        .slice(0, 6),
    [scopedStudents],
  );

  const attentionStudents = useMemo(
    () => scopedStudents.filter((s) => s.needsAttention).slice(0, 6),
    [scopedStudents],
  );

  const summaryMetrics = useMemo(() => {
    if (selectedCourseId === "all") {
      return {
        completion: data.overallCompletionPercent,
        assignmentAvg: data.overallAssignmentAvgPercent,
        quizAvg: data.overallQuizAvgPercent,
        studyMinutes: data.totalStudyMinutes,
        studentCount: data.students.length,
      };
    }
    const cs = data.coursesSummary.find(
      (c) => c.courseId === selectedCourseId,
    );
    return {
      completion: cs?.completionRatePercent ?? 0,
      assignmentAvg: cs?.assignmentAvgPercent ?? 0,
      quizAvg: cs?.quizAvgPercent ?? 0,
      studyMinutes: cs?.studyMinutes ?? 0,
      studentCount: cs?.enrolledCount ?? 0,
    };
  }, [data, selectedCourseId]);

  const courseChartData = filteredCourses.map((c) => ({
    name: c.code || c.title.slice(0, 14),
    completion: c.completionRatePercent,
    assignmentAvg: c.assignmentAvgPercent,
    quizAvg: c.quizAvgPercent,
  }));

  const kpis = [
    {
      label: "Enrolled Students",
      value: summaryMetrics.studentCount,
      icon: Users,
    },
    {
      label: "Course Completion",
      value: `${summaryMetrics.completion}%`,
      icon: BookCheck,
    },
    {
      label: "Assignment Average",
      value: `${summaryMetrics.assignmentAvg}%`,
      icon: FileCheck2,
    },
    {
      label: "Quiz Average",
      value: `${summaryMetrics.quizAvg}%`,
      icon: TrendingUp,
    },
    {
      label: "Student Engagement",
      value: `${summaryMetrics.studyMinutes} min`,
      icon: Clock,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Course & Student Analytics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time analytics across course performance, assignment & quiz averages, completion rates, and individual student telemetry.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-xs">Filter Course:</Label>
          <select
            className={cn(fieldBase, "h-9 w-64")}
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
          >
            <option value="all">All My Courses</option>
            {data.coursesSummary.map((c) => (
              <option key={c.courseId} value={c.courseId}>
                {c.code} — {c.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((item) => {
          const Icon = item.icon;
          return (
            <Card
              key={item.label}
              className="border-border/60 bg-white/30 backdrop-blur-md dark:bg-[#121a19]"
            >
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-1 text-xl font-bold text-foreground">
                    {item.value}
                  </p>
                </div>
                <div className="rounded-full bg-emerald-500/15 p-2.5 text-emerald-500">
                  <Icon className="size-4" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Course Performance & 14-Day Engagement Charts */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="border-border/60 bg-white/30 backdrop-blur-md lg:col-span-7 dark:bg-[#121a19]">
          <CardHeader>
            <CardTitle className="text-base">
              Course Completion, Assignment & Quiz Averages
            </CardTitle>
            <CardDescription>
              Side-by-side comparison across your courses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {courseChartData.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="No Course Data Yet"
                description="Create and publish a course to view performance analytics."
              />
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minWidth={0}
                  minHeight={250}
                >
                  <BarChart data={courseChartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(115,115,115,0.2)"
                    />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} domain={[0, 100]} />
                    <Tooltip />
                    <Bar
                      dataKey="completion"
                      name="Completion %"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="assignmentAvg"
                      name="Assignment Avg %"
                      fill="#34d399"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="quizAvg"
                      name="Quiz Avg %"
                      fill="#059669"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-white/30 backdrop-blur-md lg:col-span-5 dark:bg-[#121a19]">
          <CardHeader>
            <CardTitle className="text-base">
              Student Engagement (Last 14 Days)
            </CardTitle>
            <CardDescription>
              Daily study minutes and assessment submissions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={0}
                minHeight={250}
              >
                <AreaChart data={data.engagementByDay}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(115,115,115,0.2)"
                  />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="studyMinutes"
                    name="Study Minutes"
                    stroke="#10b981"
                    fill="rgba(16, 185, 129, 0.2)"
                  />
                  <Area
                    type="monotone"
                    dataKey="submissions"
                    name="Submissions"
                    stroke="#34d399"
                    fill="rgba(52, 211, 153, 0.15)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Students & Students Needing Attention */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/60 bg-white/30 backdrop-blur-md dark:bg-[#121a19]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Award className="size-4 text-emerald-500" />
              <span>Top Performing Students</span>
            </CardTitle>
            <CardDescription>
              Click any student to open their individual analytics report.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs">
            {topStudents.length === 0 ? (
              <p className="text-muted-foreground">No enrolled students yet.</p>
            ) : (
              topStudents.map((item, idx) => (
                <div
                  key={item.raw.studentId}
                  onClick={() => setInspectedStudent(item.raw)}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-border/70 bg-background/60 p-3 transition-colors hover:border-emerald-500/50"
                >
                  <div>
                    <p className="font-semibold text-foreground">
                      #{idx + 1} {item.raw.fullName}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      Progress {item.completion}% • Assign {item.assignmentAvg}% • Quiz {item.quizAvg}%
                    </p>
                  </div>
                  <Badge variant="gold">{item.overall}%</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-white/30 backdrop-blur-md dark:bg-[#121a19]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-destructive" />
              <span>Students Needing Attention</span>
            </CardTitle>
            <CardDescription>
              Low completion or below-60% average — click to inspect or message.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs">
            {attentionStudents.length === 0 ? (
              <p className="text-muted-foreground">
                All students in this selection are currently on track!
              </p>
            ) : (
              attentionStudents.map((item) => (
                <div
                  key={item.raw.studentId}
                  onClick={() => setInspectedStudent(item.raw)}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 transition-colors hover:border-destructive"
                >
                  <div>
                    <p className="font-semibold text-foreground">
                      {item.raw.fullName}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      Progress {item.completion}% • Overall {item.overall}%
                    </p>
                  </div>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link href={`/messages?userId=${item.raw.studentId}`}>
                      <MessageSquare className="size-3.5" />
                      <span>Chat</span>
                    </Link>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Full Student Performance Table */}
      <Card className="border-border/60 bg-white/30 backdrop-blur-md dark:bg-[#121a19]">
        <CardHeader>
          <CardTitle className="text-base">
            Individual Student Analytics Directory
          </CardTitle>
          <CardDescription>
            Select any student to inspect their detailed per-course breakdown and recent learning activity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {scopedStudents.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No Student Analytics Found"
              description="Students enrolled in your courses appear here automatically."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Completion</TableHead>
                  <TableHead>Assignment Avg</TableHead>
                  <TableHead>Quiz Avg</TableHead>
                  <TableHead>Overall</TableHead>
                  <TableHead>Study Time</TableHead>
                  <TableHead className="text-right">Inspect</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scopedStudents.map((item) => (
                  <TableRow
                    key={item.raw.studentId}
                    className="cursor-pointer"
                    onClick={() => setInspectedStudent(item.raw)}
                  >
                    <TableCell>
                      <p className="font-semibold text-foreground">
                        {item.raw.fullName}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {item.raw.email}
                      </p>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {item.completion}%
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {item.assignmentAvg}%
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {item.quizAvg}%
                    </TableCell>
                    <TableCell className="font-mono text-xs font-semibold">
                      {item.overall}%
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {item.raw.totalStudyMinutes} min
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setInspectedStudent(item.raw)}
                        >
                          <Eye className="size-3.5" />
                          <span>Analytics</span>
                        </Button>
                        <Button asChild variant="gold" size="sm">
                          <Link href={`/messages?userId=${item.raw.studentId}`}>
                            <MessageSquare className="size-3.5" />
                            <span>Chat</span>
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* INDIVIDUAL STUDENT ANALYTICS MODAL */}
      <Dialog
        open={Boolean(inspectedStudent)}
        onOpenChange={(open) => {
          if (!open) setInspectedStudent(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Student Analytics — {inspectedStudent?.fullName}
            </DialogTitle>
            <DialogDescription>{inspectedStudent?.email}</DialogDescription>
          </DialogHeader>

          {inspectedStudent && (
            <div className="space-y-5 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-border p-3 text-center">
                  <p className="text-lg font-bold text-foreground">
                    {inspectedStudent.averageProgressPercent}%
                  </p>
                  <p className="text-muted-foreground">Avg Completion</p>
                </div>
                <div className="rounded-xl border border-border p-3 text-center">
                  <p className="text-lg font-bold text-foreground">
                    {inspectedStudent.assignmentAveragePercent}%
                  </p>
                  <p className="text-muted-foreground">Assignment Avg</p>
                </div>
                <div className="rounded-xl border border-border p-3 text-center">
                  <p className="text-lg font-bold text-foreground">
                    {inspectedStudent.examAveragePercent}%
                  </p>
                  <p className="text-muted-foreground">Quiz Avg</p>
                </div>
                <div className="rounded-xl border border-border p-3 text-center">
                  <p className="text-lg font-bold text-foreground">
                    {inspectedStudent.totalStudyMinutes}m
                  </p>
                  <p className="text-muted-foreground">Focused Study</p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-foreground">
                  Course-by-Course Breakdown
                </h4>
                {inspectedStudent.enrolledCourses.map((ec) => (
                  <div
                    key={ec.courseId}
                    className="rounded-xl border border-border/80 bg-muted/20 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">
                        {ec.courseTitle}
                      </span>
                      <Badge variant="gold">
                        Overall {ec.overallPerformancePercent}%
                      </Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                      <span>Completion: {ec.progressPercent}%</span>
                      <span>Assignments: {ec.assignmentAveragePercent}%</span>
                      <span>Quizzes: {ec.quizAveragePercent}%</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-foreground">
                  Recent Learning Timeline
                </h4>
                {inspectedStudent.recentActivity.length === 0 ? (
                  <p className="text-muted-foreground">
                    No activity events recorded yet.
                  </p>
                ) : (
                  inspectedStudent.recentActivity.map((act) => (
                    <div
                      key={act.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border/70 p-2.5"
                    >
                      <div>
                        <p className="font-medium text-foreground">
                          {act.title}
                        </p>
                        <p className="text-muted-foreground">{act.detail}</p>
                      </div>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {act.timestamp.slice(0, 16).replace("T", " ")}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="flex justify-end">
                <Button asChild variant="gold" size="sm">
                  <Link href={`/messages?userId=${inspectedStudent.studentId}`}>
                    <MessageSquare className="size-3.5" />
                    <span>Message {inspectedStudent.fullName}</span>
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
