"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Award,
  BarChart3,
  Download,
  FileText,
  GraduationCap,
  TrendingDown,
  UserCheck,
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
import { getAdminDictionary } from "@/i18n/admin-dictionaries";
import {
  downloadExcelCsv,
  exportPrintablePdfReport,
} from "@/lib/admin/export-and-import";
import { cn } from "@/lib/utils";
import type { AdminAnalyticsReportData } from "@/services/admin/queries";

interface AdminAnalyticsClientProps {
  data: AdminAnalyticsReportData;
}

export function AdminAnalyticsClient({ data }: AdminAnalyticsClientProps) {
  const { locale } = useLocale();
  const adminT = getAdminDictionary(locale);

  const [selectedRoleType, setSelectedRoleType] = useState<
    "student" | "teacher"
  >("student");
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const profilesById = useMemo(
    () => new Map(data.profiles.map((p) => [p.id, p])),
    [data.profiles],
  );
  const coursesById = useMemo(
    () => new Map(data.courses.map((c) => [c.id, c])),
    [data.courses],
  );
  const examsById = useMemo(
    () => new Map(data.exams.map((e) => [e.id, e])),
    [data.exams],
  );
  const assignmentMaxPtsMap = useMemo(
    () =>
      new Map(
        data.assignments.map((a) => [a.id, Number(a.max_points ?? 100)]),
      ),
    [data.assignments],
  );

  const studentsList = useMemo(
    () => data.profiles.filter((p) => p.role === "student"),
    [data.profiles],
  );
  const teachersList = useMemo(
    () => data.profiles.filter((p) => p.role === "teacher"),
    [data.profiles],
  );

  const effectiveSelectedUserId = useMemo(() => {
    const pool =
      selectedRoleType === "student" ? studentsList : teachersList;
    if (selectedUserId && pool.some((u) => u.id === selectedUserId)) {
      return selectedUserId;
    }
    return pool[0]?.id ?? "";
  }, [selectedRoleType, selectedUserId, studentsList, teachersList]);

  // 1. Pass vs Fail Metrics
  const totalResults = data.results.length;
  const passedResults = data.results.filter((r) => r.passed).length;
  const failedResults = totalResults - passedResults;
  const passRate =
    totalResults > 0
      ? Number(((passedResults / totalResults) * 100).toFixed(1))
      : 0;
  const avgExamScore =
    totalResults > 0
      ? Number(
          (
            data.results.reduce((acc, r) => acc + Number(r.score_percent), 0) /
            totalResults
          ).toFixed(1),
        )
      : 0;

  // 2. Student & Teacher Monthly Growth Chart
  const userGrowthChartData = useMemo(() => {
    const buckets = new Map<
      string,
      { month: string; students: number; teachers: number }
    >();
    for (const p of data.profiles) {
      const m = p.created_at.slice(0, 7);
      const curr = buckets.get(m) ?? { month: m, students: 0, teachers: 0 };
      if (p.role === "student") curr.students += 1;
      if (p.role === "teacher") curr.teachers += 1;
      buckets.set(m, curr);
    }
    return Array.from(buckets.values()).sort((a, b) =>
      a.month.localeCompare(b.month),
    );
  }, [data.profiles]);

  // 3. Difficult Subjects / Courses Analysis
  const subjectDifficultyRows = useMemo(() => {
    const agg = new Map<
      string,
      { courseId: string; totalScore: number; count: number; fails: number }
    >();

    for (const r of data.results) {
      const curr = agg.get(r.course_id) ?? {
        courseId: r.course_id,
        totalScore: 0,
        count: 0,
        fails: 0,
      };
      curr.totalScore += Number(r.score_percent);
      curr.count += 1;
      if (!r.passed) curr.fails += 1;
      agg.set(r.course_id, curr);
    }

    return Array.from(agg.values())
      .map((item) => {
        const course = coursesById.get(item.courseId);
        return {
          courseId: item.courseId,
          courseTitle: course?.title ?? "Course",
          courseCode: course?.code ?? "—",
          attempts: item.count,
          avgScore: Number((item.totalScore / item.count).toFixed(1)),
          failRate: Number(((item.fails / item.count) * 100).toFixed(1)),
        };
      })
      .sort((a, b) => a.avgScore - b.avgScore);
  }, [data.results, coursesById]);

  // 4. Course Popularity & Completion Analytics
  const coursePopularityRows = useMemo(() => {
    const byCourse = new Map<
      string,
      { total: number; completed: number; progressSum: number }
    >();

    for (const enr of data.enrollments) {
      const curr = byCourse.get(enr.course_id) ?? {
        total: 0,
        completed: 0,
        progressSum: 0,
      };
      curr.total += 1;
      if (enr.status === "completed") curr.completed += 1;
      curr.progressSum += Number(enr.progress_percent);
      byCourse.set(enr.course_id, curr);
    }

    return data.courses
      .map((course) => {
        const stat = byCourse.get(course.id) ?? {
          total: 0,
          completed: 0,
          progressSum: 0,
        };
        return {
          courseId: course.id,
          title: course.title,
          code: course.code,
          category: course.category,
          enrollments: stat.total,
          completed: stat.completed,
          avgProgress:
            stat.total > 0
              ? Number((stat.progressSum / stat.total).toFixed(1))
              : 0,
        };
      })
      .sort((a, b) => b.enrollments - a.enrollments);
  }, [data.courses, data.enrollments]);

  // 5. Teacher Performance Report
  const teacherPerformanceRows = useMemo(() => {
    return teachersList.map((t) => {
      const authoredCourses = data.courses.filter((c) => c.teacher_id === t.id);
      const authoredIds = new Set(authoredCourses.map((c) => c.id));
      const studentsEnrolled = data.enrollments.filter((e) =>
        authoredIds.has(e.course_id),
      ).length;
      const reviews = data.teacherReviews.filter((r) => r.teacher_id === t.id);
      const avgRating =
        reviews.length > 0
          ? Number(
              (
                reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
              ).toFixed(2),
            )
          : null;

      return {
        teacherId: t.id,
        name: t.full_name || t.email,
        email: t.email,
        coursesCount: authoredCourses.length,
        studentsEnrolled,
        avgRating,
        reviewsCount: reviews.length,
      };
    });
  }, [teachersList, data.courses, data.enrollments, data.teacherReviews]);

  // 6. Enrollment & Assessment Trends
  const monthlyChartData = useMemo(() => {
    const buckets = new Map<
      string,
      { month: string; enrollments: number; exams: number }
    >();

    for (const enr of data.enrollments) {
      const m = enr.enrolled_at.slice(0, 7);
      const curr = buckets.get(m) ?? { month: m, enrollments: 0, exams: 0 };
      curr.enrollments += 1;
      buckets.set(m, curr);
    }

    for (const res of data.results) {
      const m = res.graded_at.slice(0, 7);
      const curr = buckets.get(m) ?? { month: m, enrollments: 0, exams: 0 };
      curr.exams += 1;
      buckets.set(m, curr);
    }

    return Array.from(buckets.values()).sort((a, b) =>
      a.month.localeCompare(b.month),
    );
  }, [data.enrollments, data.results]);

  // 7. Individual Student or Teacher Analytics Drill-Down
  const individualStudentReport = useMemo(() => {
    if (selectedRoleType !== "student" || !effectiveSelectedUserId) return null;
    const profile = profilesById.get(effectiveSelectedUserId);
    if (!profile) return null;

    const enrs = data.enrollments.filter(
      (e) => e.student_id === effectiveSelectedUserId,
    );
    const quizRes = data.results.filter(
      (r) => r.student_id === effectiveSelectedUserId,
    );
    const asgSubs = data.assignmentSubmissions.filter(
      (s) => s.student_id === effectiveSelectedUserId,
    );
    const gradedSubs = asgSubs.filter((s) => s.grade_points !== null);

    const avgCompletion =
      enrs.length > 0
        ? Number(
            (
              enrs.reduce((s, e) => s + Number(e.progress_percent ?? 0), 0) /
              enrs.length
            ).toFixed(1),
          )
        : 0;
    const avgQuiz =
      quizRes.length > 0
        ? Number(
            (
              quizRes.reduce((s, r) => s + Number(r.score_percent ?? 0), 0) /
              quizRes.length
            ).toFixed(1),
          )
        : 0;
    const avgAssignment =
      gradedSubs.length > 0
        ? Number(
            (
              gradedSubs.reduce((sum, sub) => {
                const maxPts = Math.max(
                  1,
                  assignmentMaxPtsMap.get(sub.assignment_id) ?? 100,
                );
                return sum + (Number(sub.grade_points ?? 0) / maxPts) * 100;
              }, 0) / gradedSubs.length
            ).toFixed(1),
          )
        : 0;

    return {
      profile,
      enrolledCount: enrs.length,
      completedCount: enrs.filter((e) => e.status === "completed").length,
      avgCompletion,
      avgQuiz,
      avgAssignment,
      submissionsCount: asgSubs.length + quizRes.length,
      enrollments: enrs.map((e) => ({
        courseTitle: coursesById.get(e.course_id)?.title ?? "Course",
        progress: Number(e.progress_percent ?? 0),
        status: e.status,
      })),
    };
  }, [
    selectedRoleType,
    effectiveSelectedUserId,
    profilesById,
    data.enrollments,
    data.results,
    data.assignmentSubmissions,
    assignmentMaxPtsMap,
    coursesById,
  ]);

  const individualTeacherReport = useMemo(() => {
    if (selectedRoleType !== "teacher" || !effectiveSelectedUserId) return null;
    const profile = profilesById.get(effectiveSelectedUserId);
    if (!profile) return null;

    const authored = data.courses.filter(
      (c) => c.teacher_id === effectiveSelectedUserId,
    );
    const authoredIds = new Set(authored.map((c) => c.id));
    const enrs = data.enrollments.filter((e) => authoredIds.has(e.course_id));
    const tRevs = data.teacherReviews.filter(
      (r) => r.teacher_id === effectiveSelectedUserId,
    );
    const cRevs = data.courseReviews.filter((r) =>
      authoredIds.has(r.course_id),
    );

    const avgTeacherRating =
      tRevs.length > 0
        ? Number(
            (
              tRevs.reduce((s, r) => s + r.rating, 0) / tRevs.length
            ).toFixed(2),
          )
        : null;
    const avgCourseRating =
      cRevs.length > 0
        ? Number(
            (
              cRevs.reduce((s, r) => s + r.rating, 0) / cRevs.length
            ).toFixed(2),
          )
        : null;
    const avgStudentCompletion =
      enrs.length > 0
        ? Number(
            (
              enrs.reduce((s, e) => s + Number(e.progress_percent ?? 0), 0) /
              enrs.length
            ).toFixed(1),
          )
        : 0;

    return {
      profile,
      coursesCount: authored.length,
      publishedCount: authored.filter((c) => c.status === "published").length,
      totalEnrollments: enrs.length,
      avgStudentCompletion,
      avgTeacherRating,
      avgCourseRating,
      totalReviews: tRevs.length + cRevs.length,
      courses: authored,
    };
  }, [
    selectedRoleType,
    effectiveSelectedUserId,
    profilesById,
    data.courses,
    data.enrollments,
    data.teacherReviews,
    data.courseReviews,
  ]);

  function handleExportExcel() {
    downloadExcelCsv(
      "learnix-executive-analytics.csv",
      [
        "Course Code",
        "Course Title",
        "Category",
        "Enrollments",
        "Completed",
        "Avg Progress %",
      ],
      coursePopularityRows.map((r) => [
        r.code,
        r.title,
        r.category,
        r.enrollments,
        r.completed,
        r.avgProgress,
      ]),
    );
  }

  function handleExportPdf() {
    exportPrintablePdfReport({
      title: adminT.analytics.title,
      subtitle: adminT.analytics.subtitle,
      headers: [
        "Course Code",
        "Course Title",
        "Category",
        "Enrollments",
        "Completed",
        "Avg Progress %",
      ],
      rows: coursePopularityRows.map((r) => [
        r.code,
        r.title,
        r.category,
        r.enrollments,
        r.completed,
        `${r.avgProgress}%`,
      ]),
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {adminT.analytics.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Platform growth, enrollment trends, course & teacher performance, and individual user analytics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <Download className="size-4" aria-hidden="true" />
            <span>{adminT.common.exportExcel}</span>
          </Button>
          <Button variant="gold" size="sm" onClick={handleExportPdf}>
            <FileText className="size-4" aria-hidden="true" />
            <span>{adminT.common.exportPdf}</span>
          </Button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-2">
            <p className="text-xs text-muted-foreground">
              {adminT.analytics.passedLabel}
            </p>
            <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {passedResults} ({passRate}%)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-2">
            <p className="text-xs text-muted-foreground">
              {adminT.analytics.failedLabel}
            </p>
            <p className="mt-1 text-2xl font-bold text-destructive">
              {failedResults}
            </p>
          </CardContent>
        </Card>
        <Card variant="premium">
          <CardContent className="pt-2">
            <p className="text-xs text-muted-foreground">
              {adminT.analytics.avgScoreLabel}
            </p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {avgExamScore}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-2">
            <p className="text-xs text-muted-foreground">
              {adminT.analytics.enrollmentsLabel}
            </p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {data.enrollments.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Individual Student / Teacher Analytics Explorer */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCheck className="size-4 text-emerald-500" />
              <span>Individual Student & Teacher Analytics Explorer</span>
            </CardTitle>
            <CardDescription>
              Select any student or teacher to inspect their live platform analytics.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Label className="text-xs">Role:</Label>
            <select
              className={cn(fieldBase, "h-9 w-36 text-xs")}
              value={selectedRoleType}
              onChange={(e) => {
                setSelectedRoleType(e.target.value as "student" | "teacher");
                setSelectedUserId("");
              }}
            >
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
            </select>

            <select
              className={cn(fieldBase, "h-9 w-64 text-xs")}
              value={effectiveSelectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              {(selectedRoleType === "student"
                ? studentsList
                : teachersList
              ).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name || u.email} ({u.email})
                </option>
              ))}
            </select>
          </div>
        </CardHeader>

        <CardContent className="text-xs">
          {selectedRoleType === "student" && individualStudentReport ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-xl border border-border p-3 text-center">
                  <p className="text-lg font-bold text-foreground">
                    {individualStudentReport.enrolledCount}
                  </p>
                  <p className="text-muted-foreground">Enrolled Courses</p>
                </div>
                <div className="rounded-xl border border-border p-3 text-center">
                  <p className="text-lg font-bold text-foreground">
                    {individualStudentReport.completedCount}
                  </p>
                  <p className="text-muted-foreground">Completed Courses</p>
                </div>
                <div className="rounded-xl border border-border p-3 text-center">
                  <p className="text-lg font-bold text-foreground">
                    {individualStudentReport.avgCompletion}%
                  </p>
                  <p className="text-muted-foreground">Avg Completion</p>
                </div>
                <div className="rounded-xl border border-border p-3 text-center">
                  <p className="text-lg font-bold text-foreground">
                    {individualStudentReport.avgAssignment}%
                  </p>
                  <p className="text-muted-foreground">Assignment Avg</p>
                </div>
                <div className="rounded-xl border border-border p-3 text-center">
                  <p className="text-lg font-bold text-foreground">
                    {individualStudentReport.avgQuiz}%
                  </p>
                  <p className="text-muted-foreground">Quiz Avg</p>
                </div>
              </div>

              {individualStudentReport.enrollments.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {individualStudentReport.enrollments.map((ec, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg border border-border/70 p-2.5"
                    >
                      <span className="truncate font-medium text-foreground">
                        {ec.courseTitle}
                      </span>
                      <Badge variant="gold">{ec.progress}%</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : selectedRoleType === "teacher" && individualTeacherReport ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-xl border border-border p-3 text-center">
                  <p className="text-lg font-bold text-foreground">
                    {individualTeacherReport.coursesCount} (
                    {individualTeacherReport.publishedCount} pub)
                  </p>
                  <p className="text-muted-foreground">Authored Courses</p>
                </div>
                <div className="rounded-xl border border-border p-3 text-center">
                  <p className="text-lg font-bold text-foreground">
                    {individualTeacherReport.totalEnrollments}
                  </p>
                  <p className="text-muted-foreground">Total Enrollments</p>
                </div>
                <div className="rounded-xl border border-border p-3 text-center">
                  <p className="text-lg font-bold text-foreground">
                    {individualTeacherReport.avgStudentCompletion}%
                  </p>
                  <p className="text-muted-foreground">Avg Student Progress</p>
                </div>
                <div className="rounded-xl border border-border p-3 text-center">
                  <p className="text-lg font-bold text-foreground">
                    {individualTeacherReport.avgTeacherRating ?? "—"} / 5
                  </p>
                  <p className="text-muted-foreground">Teacher Rating</p>
                </div>
                <div className="rounded-xl border border-border p-3 text-center">
                  <p className="text-lg font-bold text-foreground">
                    {individualTeacherReport.avgCourseRating ?? "—"} / 5
                  </p>
                  <p className="text-muted-foreground">Course Rating</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">
              No accounts available in the selected role.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Growth & Enrollment Trends Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Student & Teacher Growth by Month
            </CardTitle>
            <CardDescription>
              New student and instructor registrations over time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {userGrowthChartData.length === 0 ? (
              <EmptyState
                icon={Users}
                title={adminT.common.noRecordsTitle}
                description={adminT.common.noRecordsDescription}
              />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minWidth={0}
                  minHeight={240}
                >
                  <AreaChart data={userGrowthChartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(115,115,115,0.2)"
                    />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} allowDecimals={false} />
                    <RechartsTooltip />
                    <Area
                      type="monotone"
                      dataKey="students"
                      name="Students"
                      stroke="#10b981"
                      fill="rgba(16, 185, 129, 0.25)"
                    />
                    <Area
                      type="monotone"
                      dataKey="teachers"
                      name="Teachers"
                      stroke="#34d399"
                      fill="rgba(52, 211, 153, 0.2)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Enrollment & Graded Quiz Trends
            </CardTitle>
            <CardDescription>
              Monthly course enrollments and graded assessments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyChartData.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title={adminT.common.noRecordsTitle}
                description={adminT.common.noRecordsDescription}
              />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minWidth={0}
                  minHeight={240}
                >
                  <BarChart data={monthlyChartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(115,115,115,0.2)"
                    />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} allowDecimals={false} />
                    <RechartsTooltip />
                    <Bar
                      dataKey="enrollments"
                      name="Enrollments"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="exams"
                      name="Graded Quizzes"
                      fill="#34d399"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Difficult Subject Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingDown
              className="size-4 text-emerald-500"
              aria-hidden="true"
            />
            <span>{adminT.analytics.difficultSubjectsTitle}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {subjectDifficultyRows.length === 0 ? (
            <EmptyState
              icon={Award}
              title={adminT.common.noRecordsTitle}
              description={adminT.common.noRecordsDescription}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{adminT.courses.courseTitleCol}</TableHead>
                  <TableHead>{adminT.analytics.avgScoreLabel}</TableHead>
                  <TableHead>Fail %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjectDifficultyRows.map((row) => (
                  <TableRow key={row.courseId}>
                    <TableCell>
                      <div className="font-medium text-foreground">
                        {row.courseTitle}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {row.courseCode}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs font-semibold">
                      {row.avgScore}%
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={row.failRate > 40 ? "destructive" : "warning"}
                      >
                        {row.failRate}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Course Popularity Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {adminT.analytics.coursePopularityTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {coursePopularityRows.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title={adminT.common.noRecordsTitle}
              description={adminT.common.noRecordsDescription}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{adminT.courses.courseTitleCol}</TableHead>
                  <TableHead>{adminT.courses.categoryCol}</TableHead>
                  <TableHead>{adminT.analytics.enrollmentsLabel}</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Avg Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coursePopularityRows.map((row) => (
                  <TableRow key={row.courseId}>
                    <TableCell className="font-medium text-foreground">
                      {row.title}{" "}
                      <span className="font-mono text-xs text-muted-foreground">
                        ({row.code})
                      </span>
                    </TableCell>
                    <TableCell>{row.category}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.enrollments}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.completed}
                    </TableCell>
                    <TableCell>
                      <Badge variant="gold-subtle">{row.avgProgress}%</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Teacher Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {adminT.analytics.teacherPerformanceTitle}
          </CardTitle>
          <CardDescription>
            Live instructor course authorship, student reach, and verified student reviews.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {teacherPerformanceRows.length === 0 ? (
            <EmptyState
              icon={Users}
              title={adminT.common.noRecordsTitle}
              description={adminT.common.noRecordsDescription}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{adminT.departments.teacherLabel}</TableHead>
                  <TableHead>Courses</TableHead>
                  <TableHead>{adminT.analytics.enrollmentsLabel}</TableHead>
                  <TableHead>{adminT.courses.ratingCol}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teacherPerformanceRows.map((row) => (
                  <TableRow key={row.teacherId}>
                    <TableCell>
                      <div className="font-medium text-foreground">
                        {row.name}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {row.email}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.coursesCount}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.studentsEnrolled}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.avgRating !== null
                        ? `${row.avgRating} / 5 (${row.reviewsCount})`
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Student Performance Results Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {adminT.analytics.studentPerformanceTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.results.length === 0 ? (
            <EmptyState
              icon={Award}
              title={adminT.common.noRecordsTitle}
              description={adminT.common.noRecordsDescription}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{adminT.departments.studentLabel}</TableHead>
                  <TableHead>Quiz / Exam</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-end">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.results.slice(0, 25).map((res) => {
                  const st = profilesById.get(res.student_id);
                  const ex = examsById.get(res.exam_id);
                  return (
                    <TableRow key={res.id}>
                      <TableCell className="font-medium">
                        {st?.full_name ||
                          st?.email ||
                          res.student_id.slice(0, 8)}
                      </TableCell>
                      <TableCell>{ex?.title ?? "Quiz"}</TableCell>
                      <TableCell className="font-mono text-xs font-semibold">
                        {res.score_percent}% ({res.earned_points}/
                        {res.total_points})
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={res.passed ? "success" : "destructive"}
                        >
                          {res.passed
                            ? adminT.analytics.passedLabel
                            : adminT.analytics.failedLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-end font-mono text-xs text-muted-foreground">
                        {res.graded_at.slice(0, 10)}
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
  );
}
