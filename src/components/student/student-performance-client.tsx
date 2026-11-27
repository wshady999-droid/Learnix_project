"use client";

import { useMemo, useState } from "react";
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
  Award,
  BookOpenCheck,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  TrendingUp,
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
import { Input } from "@/components/ui/input";
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

type DatePreset =
  | "today"
  | "last_2_days"
  | "last_7_days"
  | "last_30_days"
  | "all_time"
  | "custom";

interface StudentPerformanceClientProps {
  data: StudentPerformanceAndGrowthData;
}

export function StudentPerformanceClient({
  data,
}: StudentPerformanceClientProps) {
  const { locale } = useLocale();
  const t = getStudentDictionary(locale);

  const [preset, setPreset] = useState<DatePreset>("all_time");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  const dateBounds = useMemo(() => {
    const now = new Date();
    if (preset === "all_time") {
      return { startMs: 0, endMs: Number.POSITIVE_INFINITY };
    }
    if (preset === "today") {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { startMs: start.getTime(), endMs: Number.POSITIVE_INFINITY };
    }
    if (preset === "last_2_days") {
      return {
        startMs: now.getTime() - 2 * 24 * 60 * 60 * 1000,
        endMs: Number.POSITIVE_INFINITY,
      };
    }
    if (preset === "last_7_days") {
      return {
        startMs: now.getTime() - 7 * 24 * 60 * 60 * 1000,
        endMs: Number.POSITIVE_INFINITY,
      };
    }
    if (preset === "last_30_days") {
      return {
        startMs: now.getTime() - 30 * 24 * 60 * 60 * 1000,
        endMs: Number.POSITIVE_INFINITY,
      };
    }
    const startMs = customStart ? new Date(`${customStart}T00:00:00`).getTime() : 0;
    const endMs = customEnd
      ? new Date(`${customEnd}T23:59:59`).getTime()
      : Number.POSITIVE_INFINITY;
    return { startMs, endMs };
  }, [preset, customStart, customEnd]);

  function inRange(iso: string | null | undefined): boolean {
    if (!iso) return preset === "all_time";
    const ms = new Date(iso).getTime();
    return ms >= dateBounds.startMs && ms <= dateBounds.endMs;
  }

  const filteredResults = useMemo(
    () => data.results.filter((r) => inRange(r.graded_at)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.results, dateBounds],
  );

  const filteredAssignmentGrades = useMemo(
    () => data.assignmentGrades.filter((g) => inRange(g.gradedAt)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.assignmentGrades, dateBounds],
  );

  const filteredStudySessions = useMemo(
    () => data.studySessions.filter((s) => inRange(s.started_at)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.studySessions, dateBounds],
  );

  const filteredCompletedLessons = useMemo(
    () => data.completedLessons.filter((l) => inRange(l.completedAt)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.completedLessons, dateBounds],
  );

  const quizAverage =
    filteredResults.length > 0
      ? Number(
          (
            filteredResults.reduce(
              (sum, r) => sum + Number(r.score_percent ?? 0),
              0,
            ) / filteredResults.length
          ).toFixed(1),
        )
      : 0;

  const assignmentAverage =
    filteredAssignmentGrades.length > 0
      ? Number(
          (
            filteredAssignmentGrades.reduce(
              (sum, g) => sum + g.scorePercent,
              0,
            ) / filteredAssignmentGrades.length
          ).toFixed(1),
        )
      : 0;

  const combinedScores = [
    ...filteredResults.map((r) => Number(r.score_percent ?? 0)),
    ...filteredAssignmentGrades.map((g) => g.scorePercent),
  ];
  const overallAverageGrade =
    combinedScores.length > 0
      ? Number(
          (
            combinedScores.reduce((a, b) => a + b, 0) / combinedScores.length
          ).toFixed(1),
        )
      : 0;

  const overallCourseProgress =
    data.enrolledCourses.length > 0
      ? Number(
          (
            data.enrolledCourses.reduce((s, c) => s + c.progressPercent, 0) /
            data.enrolledCourses.length
          ).toFixed(1),
        )
      : 0;

  const completedCoursesCount = data.enrolledCourses.filter(
    (c) => c.progressPercent >= 100 || c.enrollmentStatus === "completed",
  ).length;

  const studyMinutes = Math.round(
    filteredStudySessions.reduce(
      (sum, s) => sum + Number(s.duration_seconds ?? 0),
      0,
    ) / 60,
  );

  const trendSeries = useMemo(() => {
    const items = [
      ...filteredResults.map((r) => ({
        date: r.graded_at,
        label: `Quiz: ${r.examTitle.slice(0, 14)}`,
        score: Number(r.score_percent ?? 0),
      })),
      ...filteredAssignmentGrades.map((g) => ({
        date: g.gradedAt,
        label: `Asg: ${g.assignmentTitle.slice(0, 14)}`,
        score: g.scorePercent,
      })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return items.map((it, idx) => ({
      name: `${idx + 1}. ${it.label}`,
      score: it.score,
    }));
  }, [filteredResults, filteredAssignmentGrades]);

  const courseComparisonChart = data.enrolledCourses.map((c) => ({
    course: c.code || c.title.slice(0, 14),
    progress: c.progressPercent,
    quizAvg: c.averageExamScore,
    assignmentAvg: c.averageAssignmentScore,
  }));

  const presets: Array<{ id: DatePreset; label: string }> = [
    { id: "today", label: "Today" },
    { id: "last_2_days", label: "Last 2 Days" },
    { id: "last_7_days", label: "Last 7 Days" },
    { id: "last_30_days", label: "Last 30 Days" },
    { id: "all_time", label: "All Time" },
    { id: "custom", label: "Custom Range" },
  ];

  const kpiCards = [
    {
      label: "Overall Progress",
      value: `${overallCourseProgress}%`,
      sub: `${completedCoursesCount}/${data.enrolledCourses.length} courses completed`,
      icon: BookOpenCheck,
      highlight: true,
    },
    {
      label: "Overall Average Grade",
      value: `${overallAverageGrade}%`,
      sub: `Quiz ${quizAverage}% • Asg ${assignmentAverage}%`,
      icon: TrendingUp,
    },
    {
      label: "Completed Lessons",
      value: filteredCompletedLessons.length,
      sub: "In selected period",
      icon: CheckCircle2,
    },
    {
      label: "Learning Activity",
      value: studyMinutes >= 60 ? `${(studyMinutes / 60).toFixed(1)}h` : `${studyMinutes}m`,
      sub: `${filteredStudySessions.length} study sessions`,
      icon: Clock,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t.performance.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time analytics across course completion, quiz scores, assignment grades, and study activity.
          </p>
        </div>

        {/* Date Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {presets.map((p) => (
            <Button
              key={p.id}
              type="button"
              size="sm"
              variant={preset === p.id ? "gold" : "outline"}
              onClick={() => setPreset(p.id)}
              className="text-xs"
            >
              {p.id === "custom" && <Calendar className="mr-1 size-3.5" />}
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {preset === "custom" && (
        <Card className="border-gold-primary/40 bg-gold-primary/5">
          <CardContent className="flex flex-wrap items-center gap-4 py-3 text-xs">
            <span className="font-semibold text-foreground">
              Custom Date Range:
            </span>
            <div className="flex items-center gap-2">
              <span>From</span>
              <Input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="h-8 w-40 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <span>To</span>
              <Input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="h-8 w-40 text-xs"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
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
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {item.sub}
                  </p>
                </div>
                <div className="rounded-lg bg-gold-primary/15 p-2.5 text-gold-foreground">
                  <Icon className="size-4" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts: Performance Trends & Course Completion vs Quiz/Assignment Mastery */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance Trends</CardTitle>
            <CardDescription>
              Chronological quiz & assignment scores in the selected date window.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {trendSeries.length === 0 ? (
              <EmptyState
                icon={Award}
                title="No graded assessments in this range"
                description="Try expanding the date filter above or complete an upcoming quiz or assignment."
              />
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minWidth={0}
                  minHeight={260}
                >
                  <LineChart data={trendSeries}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(115,115,115,0.2)"
                    />
                    <XAxis dataKey="name" fontSize={11} />
                    <YAxis fontSize={12} domain={[0, 100]} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="score"
                      name="Score (%)"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#10b981" }}
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
              Course Completion, Quiz & Assignment Averages
            </CardTitle>
            <CardDescription>
              Per-course breakdown across all enrolled courses.
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
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minWidth={0}
                  minHeight={260}
                >
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
                      fill="#10b981"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="quizAvg"
                      name="Quiz Avg (%)"
                      fill="#34d399"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="assignmentAvg"
                      name="Assignment Avg (%)"
                      fill="#0ea5e9"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quiz Grades & Assignment Grades Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Award className="size-4 text-gold-foreground" />
              <span>Quiz Grades ({filteredResults.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredResults.length === 0 ? (
              <EmptyState
                icon={Award}
                title="No quiz grades in range"
                description="Completed and published quiz scores will appear here."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quiz</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResults.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-semibold text-foreground">
                        {r.examTitle}
                      </TableCell>
                      <TableCell className="text-xs">{r.courseTitle}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {Number(r.score_percent).toFixed(1)}%
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.passed ? "gold" : "destructive"}>
                          {r.passed ? "Passed" : "Needs Retake"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4 text-gold-foreground" />
              <span>
                Assignment Grades ({filteredAssignmentGrades.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredAssignmentGrades.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No assignment grades in range"
                description="Approved and published assignment grades will appear here."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assignment</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Marks</TableHead>
                    <TableHead>Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssignmentGrades.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="font-semibold text-foreground">
                        {g.assignmentTitle}
                      </TableCell>
                      <TableCell className="text-xs">{g.courseTitle}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {g.earnedPoints} / {g.maxPoints}
                      </TableCell>
                      <TableCell>
                        <Badge variant="gold">{g.scorePercent}%</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
