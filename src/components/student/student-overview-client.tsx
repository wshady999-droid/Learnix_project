"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
  Award,
  Bell,
  BookOpen,
  BookOpenCheck,
  CheckCheck,
  ClipboardCheck,
  Compass,
  FileText,
  MessageSquare,
  PlayCircle,
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
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getStudentDictionary } from "@/i18n/student-dictionaries";
import { cn } from "@/lib/utils";
import { studentMarkNotificationsReadAction } from "@/services/student/actions";
import type { StudentOverviewData } from "@/services/student/queries";

interface StudentOverviewClientProps {
  data: StudentOverviewData;
}

export function StudentOverviewClient({ data }: StudentOverviewClientProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const t = getStudentDictionary(locale);
  const [isPending, startTransition] = useTransition();

  const kpiCards = [
    {
      label: t.overview.enrolledCourses,
      value: data.enrolledCoursesCount,
      icon: BookOpen,
      href: "/student/my-learning",
      highlight: true,
    },
    {
      label: "Completed Courses",
      value: data.completedCoursesCount,
      icon: BookOpenCheck,
      href: "/student/my-learning",
    },
    {
      label: "In Progress",
      value: data.inProgressCoursesCount,
      icon: PlayCircle,
      href: "/student/my-learning",
    },
    {
      label: t.overview.completionProgress,
      value: `${data.averageCompletionPercent}%`,
      icon: TrendingUp,
      href: "/student/performance",
    },
    {
      label: t.overview.upcomingAssignments,
      value: data.upcomingAssignmentsCount,
      icon: FileText,
      href: "/student/assignments",
    },
    {
      label: t.overview.upcomingExams,
      value: data.upcomingExamsCount,
      icon: ClipboardCheck,
      href: "/student/exams",
    },
    {
      label: t.overview.recentGrades,
      value: `${data.latestGradePercent}%`,
      icon: Award,
      href: "/student/performance",
    },
    {
      label: t.overview.unreadNotifications,
      value: data.unreadNotificationsCount,
      icon: Bell,
      href: "/notifications",
    },
  ];

  const chartData = data.enrolledCourses.map((c) => ({
    name: c.code || c.title.slice(0, 15),
    progress: c.progressPercent,
    examScore: c.averageExamScore,
  }));

  function handleMarkAllRead() {
    startTransition(async () => {
      const res = await studentMarkNotificationsReadAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t.nav.overview}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Track your enrolled courses, upcoming assignments, quizzes, grades, and instructor messages.
          </p>
        </div>

        <Button asChild variant="gold" size="sm">
          <Link href="/student/courses">
            <Compass className="size-4" />
            <span>Explore Courses</span>
          </Link>
        </Button>
      </div>

      {/* 1. KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.label} href={item.href} className="block">
              <Card
                className={cn(
                  "group relative overflow-hidden bg-white/15 backdrop-blur-lg transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-lg dark:bg-[#121a19] dark:backdrop-blur-none",
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
                    <Icon className="size-5" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* 2. Enrolled Courses */}
      <Card className="border-border/50 bg-white/15 shadow-sm backdrop-blur-lg dark:bg-[#121a19] dark:backdrop-blur-none">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">
              {t.overview.enrolledCoursesSectionTitle}
            </CardTitle>
            <CardDescription>
              {t.overview.enrolledCoursesSectionDescription}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-emerald-500/30 bg-transparent text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
            >
              <Link href="/student/my-learning">{t.nav.courses}</Link>
            </Button>
            <Button asChild variant="gold" size="sm">
              <Link href="/student/courses">Explore Courses</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {data.enrolledCourses.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title={t.common.noRecordsTitle}
              description={t.common.noRecordsDescription}
              actions={
                <Button asChild variant="gold" size="sm">
                  <Link href="/student/courses">Explore Courses</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.enrolledCourses.slice(0, 6).map((course) => (
                <Card
                  key={course.id}
                  className="border-border/50 bg-white/20 shadow-sm backdrop-blur-lg dark:bg-[#1a2624] dark:backdrop-blur-none"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant="outline"
                        className="bg-transparent font-mono text-xs"
                      >
                        {course.code}
                      </Badge>
                      <Badge
                        className={cn(
                          "px-2 py-0.5",
                          course.progressPercent >= 100
                            ? "border-transparent bg-emerald-500 text-white dark:text-white"
                            : "border-border bg-transparent text-foreground",
                        )}
                      >
                        {course.progressPercent}%
                      </Badge>
                    </div>
                    <CardTitle className="mt-2 text-sm">
                      {course.title}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {course.teacherName}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                      <div
                        className="h-full bg-emerald-500 transition-all dark:bg-emerald-400"
                        style={{
                          width: `${Math.min(100, course.progressPercent)}%`,
                        }}
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="pt-0">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="w-full border-emerald-500/50 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-500/50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                    >
                      <Link href={`/student/my-learning?courseId=${course.id}`}>
                        {t.common.continueLearning}
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Progress Chart & Notifications */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="border-border/50 bg-white/15 backdrop-blur-lg dark:bg-[#121a19] dark:backdrop-blur-none lg:col-span-8">
          <CardHeader>
            <CardTitle className="text-base">
              {t.overview.studyChartTitle}
            </CardTitle>
            <CardDescription>
              {t.overview.studyChartDescription}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
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
                  <BarChart data={chartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(115,115,115,0.2)"
                    />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} domain={[0, 100]} />
                    <Tooltip cursor={{ fill: "rgba(16, 185, 129, 0.1)" }} />
                    <Bar
                      dataKey="progress"
                      name={t.overview.completionProgress}
                      fill="#10b981"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="examScore"
                      name={t.overview.recentGrades}
                      fill="#0ea5e9"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-white/15 backdrop-blur-lg dark:bg-[#121a19] dark:backdrop-blur-none lg:col-span-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              {t.overview.notificationsTitle}
            </CardTitle>
            {data.unreadNotificationsCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={handleMarkAllRead}
                className="text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
              >
                <CheckCheck className="size-3.5" />
                <span>{t.overview.markAllReadButton}</span>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {data.notifications.length === 0 ? (
              <EmptyState
                icon={Bell}
                title={t.common.noRecordsTitle}
                description={t.common.noRecordsDescription}
              />
            ) : (
              <div className="space-y-2.5">
                {data.notifications.slice(0, 5).map((notif) => (
                  <Link
                    key={notif.recipientId}
                    href={notif.actionUrl || "/notifications"}
                    className="block rounded-lg border border-border/50 bg-white/20 p-3 text-xs backdrop-blur-lg transition-colors hover:border-emerald-500/40 dark:bg-[#1a2624] dark:backdrop-blur-none"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold text-foreground">
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
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 4. Upcoming Quizzes, Assignments, Recent Grades & Teacher Messages */}
      <div className="grid gap-6 lg:grid-cols-4">
        <Card className="border-border/50 bg-white/15 backdrop-blur-lg dark:bg-[#121a19] dark:backdrop-blur-none">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">
              {t.overview.upcomingExamsTitle}
            </CardTitle>
            <Link
              href="/student/exams"
              className="text-xs font-semibold text-gold-foreground hover:underline"
            >
              View All
            </Link>
          </CardHeader>
          <CardContent>
            {data.upcomingExams.length === 0 ? (
              <EmptyState
                icon={ClipboardCheck}
                title="No quizzes"
                description="Published quizzes will appear here."
              />
            ) : (
              <div className="space-y-2.5">
                {data.upcomingExams.map((exam) => (
                  <Link
                    key={exam.id}
                    href={`/student/exams/${exam.id}`}
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-white/20 p-3 text-xs backdrop-blur-lg transition-colors hover:border-emerald-500/40 dark:bg-[#1a2624] dark:backdrop-blur-none"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">
                        {exam.title}
                      </p>
                      <p className="truncate text-muted-foreground">
                        {exam.courseTitle} • {exam.duration_minutes}m
                      </p>
                    </div>
                    <Badge className="shrink-0 border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                      {Number(exam.total_points)} pts
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-white/15 backdrop-blur-lg dark:bg-[#121a19] dark:backdrop-blur-none">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">
              {t.overview.upcomingAssignmentsTitle}
            </CardTitle>
            <Link
              href="/student/assignments"
              className="text-xs font-semibold text-gold-foreground hover:underline"
            >
              Open
            </Link>
          </CardHeader>
          <CardContent>
            {data.upcomingAssignments.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No assignments"
                description="Published course assignments will appear here."
              />
            ) : (
              <div className="space-y-2.5">
                {data.upcomingAssignments.map((asg) => (
                  <Link
                    key={asg.id}
                    href={`/student/assignments?assignmentId=${asg.id}`}
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-white/20 p-3 text-xs backdrop-blur-lg transition-colors hover:border-emerald-500/40 dark:bg-[#1a2624] dark:backdrop-blur-none"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">
                        {asg.title}
                      </p>
                      <p className="truncate text-muted-foreground">
                        {asg.courseTitle}
                        {asg.due_at ? ` • Due ${asg.due_at.slice(0, 10)}` : ""}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0 bg-transparent">
                      {Number(asg.max_points)} pts
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-white/15 backdrop-blur-lg dark:bg-[#121a19] dark:backdrop-blur-none">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">
              {t.overview.recentGradesTitle}
            </CardTitle>
            <Link
              href="/student/performance"
              className="text-xs font-semibold text-gold-foreground hover:underline"
            >
              Analytics
            </Link>
          </CardHeader>
          <CardContent>
            {data.recentGrades.length === 0 ? (
              <EmptyState
                icon={Award}
                title="No grades yet"
                description="Published quiz and assignment grades appear here."
              />
            ) : (
              <div className="space-y-2.5">
                {data.recentGrades.map((grade) => (
                  <div
                    key={grade.id}
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-white/20 p-3 text-xs backdrop-blur-lg dark:bg-[#1a2624] dark:backdrop-blur-none"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">
                        {grade.title}
                      </p>
                      <p className="truncate text-muted-foreground">
                        {grade.courseTitle} •{" "}
                        <span className="capitalize">{grade.kind}</span>
                      </p>
                    </div>
                    <Badge
                      className={cn(
                        "shrink-0 px-2 py-0.5",
                        grade.passed
                          ? "border-transparent bg-emerald-500 text-white dark:text-white"
                          : "border-transparent bg-destructive text-destructive-foreground",
                      )}
                    >
                      {grade.scorePercent.toFixed(1)}%
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-white/15 backdrop-blur-lg dark:bg-[#121a19] dark:backdrop-blur-none">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Recent Teacher Messages</CardTitle>
            <Link
              href="/messages"
              className="text-xs font-semibold text-gold-foreground hover:underline"
            >
              Chat
            </Link>
          </CardHeader>
          <CardContent>
            {data.recentTeacherMessages.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title="No messages yet"
                description="Messages from your instructors appear here."
              />
            ) : (
              <div className="space-y-2.5">
                {data.recentTeacherMessages.map((msg) => (
                  <Link
                    key={msg.id}
                    href={`/messages?convId=${msg.conversationId}`}
                    className="block rounded-lg border border-border/50 bg-white/20 p-3 text-xs backdrop-blur-lg transition-colors hover:border-emerald-500/40 dark:bg-[#1a2624] dark:backdrop-blur-none"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold text-foreground">
                        {msg.senderName}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {msg.createdAt.slice(5, 16).replace("T", " ")}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-muted-foreground">
                      {msg.body}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
