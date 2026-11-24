"use client";

import { useMemo } from "react";
import {
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
import type { AdminAnalyticsReportData } from "@/services/admin/queries";

interface AdminAnalyticsClientProps {
  data: AdminAnalyticsReportData;
}

export function AdminAnalyticsClient({ data }: AdminAnalyticsClientProps) {
  const { locale } = useLocale();
  const adminT = getAdminDictionary(locale);

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

  // 1. Pass vs Fail Metrics
  const totalResults = data.results.length;
  const passedResults = data.results.filter((r) => r.passed).length;
  const failedResults = totalResults - passedResults;
  const passRate =
    totalResults > 0 ? Number(((passedResults / totalResults) * 100).toFixed(1)) : 0;
  const avgExamScore =
    totalResults > 0
      ? Number(
          (
            data.results.reduce((acc, r) => acc + Number(r.score_percent), 0) /
            totalResults
          ).toFixed(1),
        )
      : 0;

  // 2. Difficult Subjects / Courses Analysis (ordered by lowest average exam score)
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

  // 3. Course Popularity & Completion Analytics
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

  // 4. Teacher / Employee Performance Report
  const teacherPerformanceRows = useMemo(() => {
    const teachers = data.profiles.filter((p) => p.role === "teacher");
    return teachers.map((t) => {
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
  }, [data.profiles, data.courses, data.enrollments, data.teacherReviews]);

  // 5. Monthly Performance Chart Data
  const monthlyChartData = useMemo(() => {
    const buckets = new Map<string, { month: string; enrollments: number; exams: number }>();

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

  function handleExportExcel() {
    downloadExcelCsv(
      "learnix-executive-analytics.csv",
      ["Course Code", "Course Title", "Category", "Enrollments", "Completed", "Avg Progress %"],
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
            {adminT.analytics.subtitle}
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

      {/* Pass / Fail & Average Score Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-2">
            <p className="text-xs text-muted-foreground">
              {adminT.analytics.passedLabel}
            </p>
            <p className="mt-1 text-2xl font-bold text-success">
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
            <p className="mt-1 text-2xl font-bold text-gold-foreground">
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

      {/* Monthly Performance & Course Popularity Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {adminT.analytics.monthlyPerformanceTitle}
            </CardTitle>
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
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
                  <BarChart data={monthlyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="month"
                      stroke="var(--muted-foreground)"
                      fontSize={12}
                    />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={12}
                      allowDecimals={false}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "var(--popover)",
                        borderColor: "var(--border)",
                        borderRadius: "0.625rem",
                      }}
                    />
                    <Bar
                      dataKey="enrollments"
                      name="Enrollments"
                      fill="var(--chart-1)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="exams"
                      name="Graded Exams"
                      fill="var(--chart-3)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Difficult Subject Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown
                className="size-4 text-gold-foreground"
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
      </div>

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

      {/* Teacher / Employee Performance Table */}
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
                      <div className="font-medium text-foreground">{row.name}</div>
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
                  <TableHead>Exam</TableHead>
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
                        {st?.full_name || st?.email || res.student_id.slice(0, 8)}
                      </TableCell>
                      <TableCell>{ex?.title ?? "Exam"}</TableCell>
                      <TableCell className="font-mono text-xs font-semibold">
                        {res.score_percent}% ({res.earned_points}/{res.total_points})
                      </TableCell>
                      <TableCell>
                        <Badge variant={res.passed ? "success" : "destructive"}>
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
