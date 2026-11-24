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
  CheckCheck,
  ClipboardCheck,
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
      highlight: true,
    },
    {
      label: t.overview.completionProgress,
      value: `${data.averageCompletionPercent}%`,
      icon: TrendingUp,
    },
    {
      label: t.overview.upcomingExams,
      value: data.upcomingExamsCount,
      icon: ClipboardCheck,
    },
    {
      label: t.overview.upcomingAssignments,
      value: data.upcomingAssignmentsCount,
      icon: FileText,
    },
    {
      label: t.overview.recentGrades,
      value: `${data.latestGradePercent}%`,
      icon: Award,
    },
    {
      label: t.overview.studyHours,
      value: `${data.totalStudyHours}h`,
      icon: Clock,
    },
    {
      label: t.overview.unreadNotifications,
      value: data.unreadNotificationsCount,
      icon: Bell,
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {kpiCards.map((item) => {
          const Icon = item.icon;
          return (
            <Card
              key={item.label}
              className={cn(
                "group transition-all duration-300 ease-in-out hover:-translate-y-1 hover:scale-[1.03] hover:shadow-lg hover:border-gold-primary/60 cursor-pointer",
                item.highlight
                  ? "border-gold-primary/50 bg-gold-primary/5 hover:bg-gold-primary/10"
                  : "border-border/80 hover:bg-muted/30"
              )}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                    {item.label}
                  </p>
                  <p className="mt-1 text-xl font-bold text-foreground transition-colors group-hover:text-gold-primary">
                    {item.value}
                  </p>
                </div>
                <div className="rounded-lg bg-gold-primary/15 p-2 text-gold-foreground transition-all duration-300 group-hover:scale-110 group-hover:bg-gold-primary group-hover:text-brand-charcoal">
                  <Icon className="size-4" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">
              {t.overview.enrolledCoursesSectionTitle}
            </CardTitle>
            <CardDescription>
              {t.overview.enrolledCoursesSectionDescription}
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/student/courses">{t.nav.courses}</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {data.enrolledCourses.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title={t.common.noRecordsTitle}
              description={t.common.noRecordsDescription}
              actions={
                <Button asChild variant="gold" size="sm">
                  <Link href="/student/courses">{t.common.enrollNow}</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.enrolledCourses.slice(0, 6).map((course) => (
                <Card key={course.id} className="border-border/80">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {course.code}
                      </Badge>
                      <Badge
                        variant={
                          course.progressPercent >= 100 ? "gold" : "outline"
                        }
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
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-gold-metallic transition-all"
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
                      className="w-full"
                    >
                      <Link href={`/student/courses?courseId=${course.id}`}>
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

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-8">
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
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
                  <BarChart data={chartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(115,115,115,0.2)"
                    />
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis fontSize={12} domain={[0, 100]} />
                    <Tooltip />
                    <Bar
                      dataKey="progress"
                      name={t.overview.completionProgress}
                      fill="#A88945"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="examScore"
                      name={t.overview.recentGrades}
                      fill="#202124"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">
                {t.overview.notificationsTitle}
              </CardTitle>
            </div>
            {data.unreadNotificationsCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={handleMarkAllRead}
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
                  <div
                    key={notif.recipientId}
                    className="rounded-lg border border-border/80 bg-card/60 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground">
                        {notif.title}
                      </span>
                      <Badge variant={notif.isRead ? "outline" : "gold"}>
                        {notif.category}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-muted-foreground">
                      {notif.body}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t.overview.upcomingExamsTitle}
            </CardTitle>
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
                {data.upcomingExams.map((exam) => (
                  <div
                    key={exam.id}
                    className="flex items-center justify-between rounded-lg border border-border/80 p-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">
                        {exam.title}
                      </p>
                      <p className="text-muted-foreground">
                        {exam.courseTitle} • {exam.duration_minutes}m
                      </p>
                    </div>
                    <Badge variant="gold">{Number(exam.total_points)} pts</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t.overview.upcomingAssignmentsTitle}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.upcomingAssignments.length === 0 ? (
              <EmptyState
                icon={FileText}
                title={t.common.noRecordsTitle}
                description={t.common.noRecordsDescription}
              />
            ) : (
              <div className="space-y-2.5">
                {data.upcomingAssignments.map((asg) => (
                  <div
                    key={asg.id}
                    className="flex items-center justify-between rounded-lg border border-border/80 p-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">
                        {asg.title}
                      </p>
                      <p className="text-muted-foreground">
                        {asg.courseTitle}
                        {asg.due_at ? ` • Due ${asg.due_at.slice(0, 10)}` : ""}
                      </p>
                    </div>
                    <Badge variant="outline">{Number(asg.max_points)} pts</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t.overview.recentGradesTitle}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentGrades.length === 0 ? (
              <EmptyState
                icon={Award}
                title={t.common.noRecordsTitle}
                description={t.common.noRecordsDescription}
              />
            ) : (
              <div className="space-y-2.5">
                {data.recentGrades.map((grade) => (
                  <div
                    key={grade.id}
                    className="flex items-center justify-between rounded-lg border border-border/80 p-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">
                        {grade.examTitle}
                      </p>
                      <p className="text-muted-foreground">
                        {grade.courseTitle}
                      </p>
                    </div>
                    <Badge variant={grade.passed ? "gold" : "destructive"}>
                      {Number(grade.score_percent).toFixed(1)}%
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