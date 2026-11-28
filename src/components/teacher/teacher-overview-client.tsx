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
  ClipboardCheck,
  FileCheck2,
  GraduationCap,
  MessageSquare,
  Plus,
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
      label: "Pending Submissions",
      value: data.pendingSubmissionsCount,
      icon: FileCheck2,
    },
    {
      label: t.overview.averagePerformance,
      value: `${data.averageStudentPerformance}%`,
      icon: TrendingUp,
    },
  ];

  const chartData = data.courses.map((course) => ({
    name: course.title.slice(0, 18),
    students: course.enrolledCount,
    avgScore: course.averageExamScore,
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button asChild variant="gold" size="sm">
          <Link href="/teacher/courses?action=new">
            <Plus className="size-4" />
            <span>{t.courses.createCourse}</span>
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="bg-white/20 backdrop-blur-md dark:bg-[#121a19]"
        >
          <Link href="/teacher/exams">{t.exams.createExam}</Link>
        </Button>
      </div>

      {/* 4 KPI Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((item) => {
          const Icon = item.icon;
          return (
            <Card
              key={item.label}
              className={cn(
                "group relative overflow-hidden bg-white/30 backdrop-blur-md transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-lg dark:bg-[#121a19] dark:backdrop-blur-none",
                item.highlight
                  ? "border-emerald-500/50 shadow-sm shadow-emerald-500/10"
                  : "border-border/50",
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
        <Card className="border-border/50 bg-white/30 backdrop-blur-md lg:col-span-8 dark:bg-[#121a19] dark:backdrop-blur-none">
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
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minWidth={0}
                  minHeight={260}
                >
                  <BarChart data={chartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(115,115,115,0.2)"
                    />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip cursor={{ fill: "rgba(16, 185, 129, 0.1)" }} />
                    <Bar
                      dataKey="students"
                      name={t.overview.enrolledStudents}
                      fill="#10b981"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="avgScore"
                      name={t.overview.averagePerformance}
                      fill="#34d399"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-white/30 backdrop-blur-md lg:col-span-4 dark:bg-[#121a19] dark:backdrop-blur-none">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">
                {t.overview.notificationsSectionTitle}
              </CardTitle>
              <CardDescription>
                {data.unreadNotificationsCount} unread alerts
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/notifications">View All</Link>
            </Button>
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
                            ? "border-border bg-transparent text-foreground"
                            : "border-transparent bg-emerald-500 text-white dark:text-white",
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

      {/* Recent Student Messages, Active Quizzes, Recent Submissions */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border/50 bg-white/30 backdrop-blur-md dark:bg-[#121a19] dark:backdrop-blur-none">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Recent Messages</CardTitle>
              <CardDescription>Latest student conversations</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/messages">Open Chat</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.recentMessages.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title={t.common.noRecordsTitle}
                description="Student messages from your enrolled courses appear here."
              />
            ) : (
              <div className="space-y-2.5">
                {data.recentMessages.map((msg) => (
                  <Link
                    key={msg.id}
                    href="/messages"
                    className="block rounded-lg border border-border/50 bg-white/20 p-3 text-xs backdrop-blur-md transition-colors hover:border-emerald-500/40 dark:bg-[#1a2624] dark:backdrop-blur-none"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">
                        {msg.senderName}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {msg.createdAt.slice(0, 16).replace("T", " ")}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-muted-foreground">
                      {msg.body || "Sent an attachment"}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-white/30 backdrop-blur-md dark:bg-[#121a19] dark:backdrop-blur-none">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">
                {t.overview.examsSectionTitle}
              </CardTitle>
              <CardDescription>
                {t.overview.examsSectionDescription}
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/teacher/exams">Manage</Link>
            </Button>
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
                          ? "border-transparent bg-emerald-500 text-white dark:text-white"
                          : "border-border bg-transparent text-foreground",
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
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">
                {t.overview.submissionsSectionTitle}
              </CardTitle>
              <CardDescription>
                {data.pendingSubmissionsCount} awaiting review
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/teacher/assignments">Grade</Link>
            </Button>
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
                    <Badge variant="outline" className="bg-transparent">
                      {sub.scoreLabel}
                    </Badge>
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
