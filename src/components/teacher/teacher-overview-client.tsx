"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Bell,
  BookOpen,
  CalendarClock,
  ClipboardCheck,
  FileCheck2,
  GraduationCap,
  TrendingUp,
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
import { getTeacherDictionary } from "@/i18n/teacher-dictionaries";
import { cn } from "@/lib/utils";
import type { TeacherOverviewData } from "@/services/teacher/queries";

const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

interface TeacherOverviewClientProps {
  data: TeacherOverviewData;
}

export function TeacherOverviewClient({ data }: TeacherOverviewClientProps) {
  const { locale } = useLocale();
  const t = getTeacherDictionary(locale);

  const kpiCards = [
    {
      label: t.overview.assignedCourses,
      value: data.assignedCoursesCount,
      icon: BookOpen,
      highlight: true,
    },
    {
      label: t.overview.enrolledStudents,
      value: data.enrolledStudentsCount,
      icon: Users,
    },
    {
      label: t.overview.upcomingClasses,
      value: data.upcomingClassesCount,
      icon: CalendarClock,
    },
    {
      label: t.overview.upcomingExams,
      value: data.upcomingExamsCount,
      icon: ClipboardCheck,
    },
    {
      label: t.overview.recentSubmissions,
      value: data.recentSubmissionsCount,
      icon: FileCheck2,
    },
    {
      label: t.overview.averagePerformance,
      value: `${data.averageStudentPerformance}%`,
      icon: TrendingUp,
    },
    {
      label: t.overview.unreadNotifications,
      value: data.unreadNotificationsCount,
      icon: Bell,
    },
  ];

  const chartData = data.courses.map((course) => ({
    name: course.code || course.title.slice(0, 16),
    students: course.enrolledCount,
    avgScore: course.averageExamScore,
  }));

  return (
    <div className="space-y-8">
      {/* شيلنا العنوان والوصف وسيبنا الزراير بس */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button asChild variant="gold" size="sm">
          <Link href="/teacher/courses">{t.courses.createCourse}</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="bg-white/20 backdrop-blur-md dark:bg-[#121a19]">
          <Link href="/teacher/exams">{t.exams.createExam}</Link>
        </Button>
      </div>

      {/* 7 KPI Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {kpiCards.map((item) => {
          const Icon = item.icon;
          return (
            <Card
              key={item.label}
              className={cn(
                "group relative overflow-hidden bg-white/30 backdrop-blur-md transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-lg dark:bg-[#121a19] dark:backdrop-blur-none",
                item.highlight
                  ? "border-emerald-500/50 shadow-sm shadow-emerald-500/10"
                  : "border-border/50"
              )}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                    {item.label}
                  </p>
                  <p className="mt-1 text-xl font-bold text-foreground">
                    {item.value}
                  </p>
                </div>
                <div className="rounded-full bg-emerald-100 p-2.5 text-emerald-600 transition-all duration-300 group-hover:scale-110 dark:bg-emerald-900/30 dark:text-emerald-400">
                  <Icon className="size-4" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Course Performance Chart + Notifications */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-8 border-border/50 bg-white/30 backdrop-blur-md dark:bg-[#121a19] dark:backdrop-blur-none">
          <CardHeader>
            <CardTitle className="text-base">
              {t.overview.performanceChartTitle}
            </CardTitle>
            <CardDescription>
              {t.overview.performanceChartDescription}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <EmptyState
                icon={GraduationCap}
                title={t.common.noRecordsTitle}
                description={t.common.noRecordsDescription}
              />
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
                  <BarChart data={chartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(115,115,115,0.2)"
                    />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip cursor={{fill: 'rgba(16, 185, 129, 0.1)'}} />
                    <Bar
                      dataKey="students"
                      name={t.overview.enrolledStudents}
                      fill="#10b981"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="avgScore"
                      name={t.overview.averagePerformance}
                      fill="#334155"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-4 border-border/50 bg-white/30 backdrop-blur-md dark:bg-[#121a19] dark:backdrop-blur-none">
          <CardHeader>
            <CardTitle className="text-base">
              {t.overview.notificationsSectionTitle}
            </CardTitle>
            <CardDescription>
              {t.overview.notificationsSectionDescription}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.notifications.length === 0 ? (
              <EmptyState
                icon={Bell}
                title={t.common.noRecordsTitle}
                description={t.common.noRecordsDescription}
              />
            ) : (
              <div className="space-y-3">
                {data.notifications.slice(0, 5).map((notif) => (
                  <div
                    key={notif.recipientId}
                    className="rounded-lg border border-border/50 bg-white/20 p-3 text-xs backdrop-blur-md dark:bg-[#1a2624] dark:backdrop-blur-none"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">
                        {notif.title}
                      </span>
                      <Badge 
                        className={cn(
                          "px-2 py-0.5",
                          notif.isRead 
                            ? "bg-transparent text-foreground border-border" 
                            : "bg-emerald-500 text-white border-transparent dark:text-white"
                        )}
                      >
                        {notif.category}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-muted-foreground">
                      {notif.body}
                    </p>
                    <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                      {notif.createdAt.slice(0, 16).replace("T", " ")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Classes, Upcoming Exams, Recent Submissions */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border/50 bg-white/30 backdrop-blur-md dark:bg-[#121a19] dark:backdrop-blur-none">
          <CardHeader>
            <CardTitle className="text-base">
              {t.overview.scheduleSectionTitle}
            </CardTitle>
            <CardDescription>
              {t.overview.scheduleSectionDescription}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.upcomingSchedules.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title={t.common.noRecordsTitle}
                description={t.common.noRecordsDescription}
              />
            ) : (
              <div className="space-y-2.5">
                {data.upcomingSchedules.slice(0, 6).map((slot) => (
                  <div
                    key={slot.id}
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-white/20 p-3 text-xs backdrop-blur-md dark:bg-[#1a2624] dark:backdrop-blur-none"
                  >
                    <div>
                      <p className="font-semibold text-foreground">
                        {slot.courseTitle}
                      </p>
                      <p className="text-muted-foreground">
                        {DAY_LABELS[slot.day_of_week] ?? "Day"} •{" "}
                        {slot.start_time.slice(0, 5)} –{" "}
                        {slot.end_time.slice(0, 5)}
                      </p>
                    </div>
                    {slot.room && <Badge variant="outline" className="bg-transparent">{slot.room}</Badge>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-white/30 backdrop-blur-md dark:bg-[#121a19] dark:backdrop-blur-none">
          <CardHeader>
            <CardTitle className="text-base">
              {t.overview.examsSectionTitle}
            </CardTitle>
            <CardDescription>
              {t.overview.examsSectionDescription}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.upcomingExams.length === 0 ? (
              <EmptyState
                icon={ClipboardCheck}
                title={t.common.noRecordsTitle}
                description={t.common.noRecordsDescription}
              />
            ) : (
              <div className="space-y-2.5">
                {data.upcomingExams.slice(0, 6).map((exam) => (
                  <div
                    key={exam.id}
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-white/20 p-3 text-xs backdrop-blur-md dark:bg-[#1a2624] dark:backdrop-blur-none"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">
                        {exam.title}
                      </p>
                      <p className="text-muted-foreground">
                        {exam.duration_minutes} min •{" "}
                        {Number(exam.total_points)} pts
                      </p>
                    </div>
                    <Badge
                      className={cn(
                        "px-2 py-0.5",
                        exam.status === "published" 
                          ? "bg-emerald-500 text-white border-transparent dark:text-white" 
                          : "bg-transparent text-foreground border-border"
                      )}
                    >
                      {exam.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-white/30 backdrop-blur-md dark:bg-[#121a19] dark:backdrop-blur-none">
          <CardHeader>
            <CardTitle className="text-base">
              {t.overview.submissionsSectionTitle}
            </CardTitle>
            <CardDescription>
              {t.overview.submissionsSectionDescription}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentSubmissions.length === 0 ? (
              <EmptyState
                icon={FileCheck2}
                title={t.common.noRecordsTitle}
                description={t.common.noRecordsDescription}
              />
            ) : (
              <div className="space-y-2.5">
                {data.recentSubmissions.slice(0, 6).map((sub) => (
                  <div
                    key={`${sub.kind}-${sub.id}`}
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-white/20 p-3 text-xs backdrop-blur-md dark:bg-[#1a2624] dark:backdrop-blur-none"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">
                        {sub.studentName} — {sub.title}
                      </p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {sub.submittedAt.slice(0, 16).replace("T", " ")}
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-transparent">{sub.scoreLabel}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}