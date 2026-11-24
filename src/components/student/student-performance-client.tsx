"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Award,
  BookOpenCheck,
  CheckCircle2,
  Clock,
  TrendingUp,
} from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { useLocale } from "@/components/i18n/locale-provider";
import { Badge } from "@/components/ui/badge";
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
import { getStudentDictionary } from "@/i18n/student-dictionaries";
import type { StudentPerformanceAndGrowthData } from "@/services/student/queries";

interface StudentPerformanceClientProps {
  data: StudentPerformanceAndGrowthData;
}

export function StudentPerformanceClient({
  data,
}: StudentPerformanceClientProps) {
  const { locale } = useLocale();
  const t = getStudentDictionary(locale);

  const overallExamAverage =
    data.results.length > 0
      ? Number(
          (
            data.results.reduce(
              (sum, r) => sum + Number(r.score_percent ?? 0),
              0,
            ) / data.results.length
          ).toFixed(1),
        )
      : 0;

  const completedCoursesCount = data.enrolledCourses.filter(
    (c) => c.progressPercent >= 100 || c.enrollmentStatus === "completed",
  ).length;

  const totalStudyHours = Number(
    (
      data.studySessions.reduce(
        (sum, s) => sum + Number(s.duration_seconds ?? 0),
        0,
      ) / 3600
    ).toFixed(1),
  );

  const examsPassedCount = data.results.filter((r) => r.passed).length;

  const kpiCards = [
    {
      label: t.performance.overallExamAverage,
      value: `${overallExamAverage}%`,
      icon: TrendingUp,
      highlight: true,
    },
    {
      label: t.performance.completedCoursesCount,
      value: completedCoursesCount,
      icon: BookOpenCheck,
    },
    {
      label: t.performance.totalStudyHours,
      value: `${totalStudyHours}h`,
      icon: Clock,
    },
    {
      label: t.performance.examsPassedCount,
      value: `${examsPassedCount} / ${data.results.length}`,
      icon: Award,
    },
  ];

  const examHistoryChart = [...data.results]
    .reverse()
    .map((r, idx) => ({
      exam: `${idx + 1}. ${r.examTitle.slice(0, 14)}`,
      score: Number(r.score_percent ?? 0),
    }));

  const courseComparisonChart = data.enrolledCourses.map((c) => ({
    course: c.code || c.title.slice(0, 14),
    progress: c.progressPercent,
    examAverage: c.averageExamScore,
  }));

  const strengths = data.enrolledCourses.filter(
    (c) => c.averageExamScore >= 75 || c.progressPercent >= 75,
  );
  const subjectsNeedingRevision = data.enrolledCourses.filter(
    (c) =>
      (c.averageExamScore > 0 && c.averageExamScore < 75) ||
      c.progressPercent < 50,
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t.performance.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.performance.subtitle}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((item) => {
          const Icon = item.icon;
          return (
            <Card
              key={item.label}
              className={
                item.highlight
                  ? "border-gold-primary/50 bg-gold-primary/5"
                  : "border-border/80"
              }
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
                <div className="rounded-lg bg-gold-primary/15 p-2 text-gold-foreground">
                  <Icon className="size-4" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts: Exam Score History & Course Completion vs Exam Mastery */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t.performance.gradesChartTitle}
            </CardTitle>
            <CardDescription>
              {t.performance.gradesChartDescription}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {examHistoryChart.length === 0 ? (
              <EmptyState
                icon={Award}
                title={t.common.noRecordsTitle}
                description={t.common.noRecordsDescription}
              />
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
                  <LineChart data={examHistoryChart}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(115,115,115,0.2)"
                    />
                    <XAxis dataKey="exam" fontSize={12} />
                    <YAxis fontSize={12} domain={[0, 100]} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#A88945"
                      strokeWidth={2.5}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t.performance.progressComparisonTitle}
            </CardTitle>
            <CardDescription>
              {t.performance.progressComparisonDescription}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {courseComparisonChart.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title={t.common.noRecordsTitle}
                description={t.common.noRecordsDescription}
              />
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
                  <BarChart data={courseComparisonChart}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(115,115,115,0.2)"
                    />
                    <XAxis dataKey="course" fontSize={12} />
                    <YAxis fontSize={12} domain={[0, 100]} />
                    <Tooltip />
                    <Bar
                      dataKey="progress"
                      name="Completion (%)"
                      fill="#202124"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="examAverage"
                      name="Exam Average (%)"
                      fill="#A88945"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Strengths & Subjects Needing Revision */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-4 text-emerald-500" />
              <span>{t.performance.strengthsTitle}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs">
            {strengths.length === 0 ? (
              <p className="text-muted-foreground">
                Complete lessons and exams with 75% or higher to highlight your academic strengths.
              </p>
            ) : (
              strengths.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-border/80 p-3"
                >
                  <div>
                    <p className="font-semibold text-foreground">{c.title}</p>
                    <p className="text-muted-foreground">
                      Progress: {c.progressPercent}% • Exam Avg:{" "}
                      {c.averageExamScore}%
                    </p>
                  </div>
                  <Badge variant="gold">Strong</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-gold-foreground" />
              <span>{t.performance.weaknessesRevisionTitle}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs">
            {subjectsNeedingRevision.length === 0 ? (
              <p className="text-muted-foreground">
                All enrolled subjects are progressing above the revision threshold.
              </p>
            ) : (
              subjectsNeedingRevision.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-border/80 p-3"
                >
                  <div>
                    <p className="font-semibold text-foreground">{c.title}</p>
                    <p className="text-muted-foreground">
                      Progress: {c.progressPercent}% • Exam Avg:{" "}
                      {c.averageExamScore}%
                    </p>
                  </div>
                  <Badge variant="outline">Review Recommended</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Official Examination Grades Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t.performance.examGradesTableTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.results.length === 0 ? (
            <EmptyState
              icon={Award}
              title={t.common.noRecordsTitle}
              description={t.common.noRecordsDescription}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Examination</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Marks</TableHead>
                  <TableHead>Score (%)</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Teacher Feedback</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.results.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-semibold text-foreground">
                      {r.examTitle}
                    </TableCell>
                    <TableCell>{r.courseTitle}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {Number(r.earned_points)} / {Number(r.total_points)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {Number(r.score_percent).toFixed(1)}%
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.passed ? "gold" : "destructive"}>
                        {r.passed ? "Passed" : "Needs Retake"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-sm text-xs text-muted-foreground">
                      {r.feedback || "—"}
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
