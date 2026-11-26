"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Award,
  BookOpen,
  Camera,
  ClipboardCheck,
  Clock,
  FileCheck2,
  PlayCircle,
  ShieldCheck,
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
import { getStudentDictionary } from "@/i18n/student-dictionaries";
import type { StudentExamsCenterData } from "@/services/student/queries";

interface StudentExamsClientProps {
  data: StudentExamsCenterData;
}

export function StudentExamsClient({ data }: StudentExamsClientProps) {
  const { locale } = useLocale();
  const t = getStudentDictionary(locale);
  const [activeTab, setActiveTab] = useState<"available" | "history">(
    "available",
  );

  const courseExamGroups = useMemo(() => {
    const enrolledList =
      data.enrolledCourses && data.enrolledCourses.length > 0
        ? data.enrolledCourses
        : Array.from(
          new Map(
            data.exams.map((e) => [
              e.course_id,
              {
                id: e.course_id,
                code: e.courseCode,
                title: e.courseTitle,
              },
            ]),
          ).values(),
        );

    return enrolledList.map((course) => {
      const courseExams = data.exams.filter((e) => e.course_id === course.id);
      const completedExamsCount = courseExams.filter(
        (e) => !e.activeAttemptId && e.attemptsUsed > 0,
      ).length;
      const inProgressExamsCount = courseExams.filter((e) =>
        Boolean(e.activeAttemptId),
      ).length;

      return {
        course,
        exams: courseExams,
        totalExams: courseExams.length,
        completedExamsCount,
        inProgressExamsCount,
      };
    });
  }, [data.enrolledCourses, data.exams]);

  function getExamStatusBadge(exam: StudentExamsCenterData["exams"][number]) {
    if (exam.activeAttemptId) {
      return <Badge variant="gold">In Progress</Badge>;
    }
    if (exam.latestResult) {
      return (
        <Badge variant={exam.latestResult.passed ? "gold" : "destructive"}>
          {exam.latestResult.passed ? "Passed" : "Completed"} (
          {Number(exam.latestResult.score_percent).toFixed(1)}%)
        </Badge>
      );
    }
    if (exam.attemptsUsed > 0) {
      return <Badge variant="outline">Submitted</Badge>;
    }
    return <Badge variant="outline">Available</Badge>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t.exams.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.exams.subtitle}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeTab === "available" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("available")}
        >
          {t.exams.tabAvailable} ({data.exams.length})
        </Button>
        <Button
          variant={activeTab === "history" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("history")}
        >
          {t.exams.tabHistory} ({data.attempts.length})
        </Button>
      </div>

      {activeTab === "available" && (
        <div>
          {courseExamGroups.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title={t.common.noRecordsTitle}
              description="Enroll in a course to access assigned examinations."
            />
          ) : (
            <div className="flex flex-col gap-6">
              {courseExamGroups.map((group) => (
                <Card key={group.course.id} className="w-full border-border/80 bg-card">
                  <CardHeader className="border-b border-border/60 pb-3 pt-4 px-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gold-primary/15 text-gold-foreground">
                          <BookOpen className="size-4" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className="font-mono text-[10px]"
                            >
                              {group.course.code}
                            </Badge>
                            <CardTitle className="text-lg">
                              {group.course.title}
                            </CardTitle>
                          </div>
                          <CardDescription className="mt-0.5 text-xs">
                            {group.totalExams}{" "}
                            {group.totalExams === 1
                              ? "Available Exam"
                              : "Available Exams"}{" "}
                            • {group.completedExamsCount} Completed
                          </CardDescription>
                        </div>
                      </div>
                      <Badge
                        variant={group.totalExams > 0 ? "gold" : "outline"}
                      >
                        {group.totalExams}{" "}
                        {group.totalExams === 1 ? "Exam" : "Exams"}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5">
                    {group.exams.length === 0 ? (
                      <p className="py-4 text-center text-xs text-muted-foreground">
                        No published examinations available for this course yet.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-4">
                        {group.exams.map((exam) => {
                          const canStartNew =
                            exam.attemptsUsed < exam.max_attempts;
                          return (
                            <div
                              key={exam.id}
                              className={
                                exam.activeAttemptId
                                  ? "flex w-full flex-col items-center justify-between gap-4 rounded-xl border border-gold-primary/70 bg-background p-4 shadow-sm md:flex-row"
                                  : "flex w-full flex-col items-center justify-between gap-4 rounded-xl border border-border/80 bg-background p-4 shadow-sm md:flex-row"
                              }
                            >
                              <div className="w-full space-y-1.5 md:w-1/3">
                                <div className="flex flex-wrap items-center gap-2">
                                  {getExamStatusBadge(exam)}
                                  {exam.strict_proctoring && (
                                    <Badge variant="gold" className="text-[10px] px-1.5 py-0.5">
                                      <ShieldCheck className="mr-1 size-3" />
                                      {t.exams.proctoredBadge}
                                    </Badge>
                                  )}
                                  {exam.camera_monitoring_enabled && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                                      <Camera className="mr-1 size-3 text-gold-foreground" />
                                      Camera
                                    </Badge>
                                  )}
                                </div>
                                <CardTitle className="text-base">
                                  {exam.title}
                                </CardTitle>
                                {exam.description && (
                                  <p className="line-clamp-1 text-xs text-muted-foreground">
                                    {exam.description}
                                  </p>
                                )}
                              </div>

                              <div className="flex w-full flex-1 items-center justify-evenly gap-2 border-y border-border/50 py-3 md:border-x md:border-y-0 md:py-0">
                                <div className="text-center">
                                  <p className="font-semibold text-foreground text-sm">
                                    {exam.questionCount}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">Qs</p>
                                </div>
                                <div className="text-center">
                                  <p className="font-semibold text-foreground text-sm">
                                    {exam.duration_minutes}m
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">Dur</p>
                                </div>
                                <div className="text-center">
                                  <p className="font-semibold text-foreground text-sm">
                                    {Number(exam.total_points)}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">Marks</p>
                                </div>
                                <div className="text-center">
                                  <p className="font-semibold text-foreground text-sm">
                                    {Number(exam.passing_score)}%
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">Pass</p>
                                </div>
                                <div className="text-center">
                                  <p className="font-semibold text-foreground text-sm">
                                    {exam.attemptsUsed} / {exam.max_attempts}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">Att</p>
                                </div>
                              </div>

        
                              <div className="w-full md:w-auto shrink-0">
                                {exam.activeAttemptId ? (
                                  <Button
                                    asChild
                                    variant="gold"
                                    size="sm"
                                    className="w-full md:w-auto"
                                  >
                                    <Link href={`/student/exams/${exam.id}`}>
                                      <PlayCircle className="mr-2 size-4" />
                                      <span>{t.exams.resumeExamButton}</span>
                                    </Link>
                                  </Button>
                                ) : canStartNew ? (
                                  <Button
                                    asChild
                                    variant="gold"
                                    size="sm"
                                    className="w-full md:w-auto"
                                  >
                                    <Link href={`/student/exams/${exam.id}`}>
                                      <PlayCircle className="mr-2 size-4" />
                                      <span>{t.exams.startExamButton}</span>
                                    </Link>
                                  </Button>
                                ) : (
                                  <Button
                                    asChild
                                    variant="outline"
                                    size="sm"
                                    className="w-full md:w-auto"
                                  >
                                    <Link href={`/student/exams/${exam.id}`}>
                                      <Award className="mr-2 size-4" />
                                      <span>{t.exams.viewResultButton}</span>
                                    </Link>
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "history" && (
        <Card>
          <CardContent className="pt-6">
            {data.attempts.length === 0 ? (
              <EmptyState
                icon={FileCheck2}
                title={t.common.noRecordsTitle}
                description="Your completed examination attempts and results will appear here."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Examination</TableHead>
                    <TableHead>Attempt</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.attempts.map((att) => (
                    <TableRow key={att.id}>
                      <TableCell>
                        <p className="font-semibold text-foreground">
                          {att.examTitle}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {att.courseTitle}
                        </p>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        #{att.attempt_number} (Ver. {att.assigned_version})
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            att.status === "in_progress" ? "gold" : "outline"
                          }
                        >
                          {att.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {att.result
                          ? `${Number(att.result.score_percent).toFixed(1)}%`
                          : "Pending Review"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {att.started_at.slice(0, 16).replace("T", " ")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/student/exams/${att.exam_id}`}>
                            {att.status === "in_progress"
                              ? t.exams.resumeExamButton
                              : t.exams.viewResultButton}
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}