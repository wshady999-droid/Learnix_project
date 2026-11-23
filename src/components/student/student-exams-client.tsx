"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Award,
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
  CardFooter,
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
          {data.exams.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title={t.common.noRecordsTitle}
              description="Published examinations for your enrolled courses will appear here."
            />
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {data.exams.map((exam) => {
                const canStartNew = exam.attemptsUsed < exam.max_attempts;
                return (
                  <Card
                    key={exam.id}
                    className={
                      exam.activeAttemptId
                        ? "border-gold-primary/70 shadow-md"
                        : "border-border/80"
                    }
                  >
                    <CardHeader className="pb-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {exam.courseCode}
                        </Badge>
                        <div className="flex items-center gap-1.5">
                          {exam.strict_proctoring && (
                            <Badge variant="gold">
                              <ShieldCheck className="mr-1 size-3" />
                              {t.exams.proctoredBadge}
                            </Badge>
                          )}
                          {exam.camera_monitoring_enabled && (
                            <Badge variant="outline">
                              <Camera className="mr-1 size-3 text-gold-foreground" />
                              Camera
                            </Badge>
                          )}
                        </div>
                      </div>
                      <CardTitle className="mt-2 text-base">
                        {exam.title}
                      </CardTitle>
                      <CardDescription className="line-clamp-2 text-xs">
                        {exam.description || exam.courseTitle}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-3 text-xs text-muted-foreground">
                      <div className="grid grid-cols-3 gap-2 rounded-lg border border-border/70 bg-muted/40 p-2.5 text-center">
                        <div>
                          <p className="font-semibold text-foreground">
                            {exam.questionCount}
                          </p>
                          <p className="text-[11px]">Questions</p>
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">
                            {exam.duration_minutes}m
                          </p>
                          <p className="text-[11px]">{t.exams.durationLabel}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">
                            {Number(exam.total_points)}
                          </p>
                          <p className="text-[11px]">{t.exams.marksLabel}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          {t.exams.attemptsUsedLabel}:{" "}
                          <strong className="text-foreground">
                            {exam.attemptsUsed} / {exam.max_attempts}
                          </strong>
                        </span>
                        <span>
                          {t.exams.passingScoreLabel}:{" "}
                          <strong className="text-foreground">
                            {Number(exam.passing_score)}%
                          </strong>
                        </span>
                      </div>

                      {(exam.available_from || exam.available_until) && (
                        <p className="flex items-center gap-1.5 font-mono text-[11px]">
                          <Clock className="size-3.5 text-gold-foreground" />
                          <span>
                            {exam.available_from
                              ? exam.available_from.slice(0, 16).replace("T", " ")
                              : "Open"}{" "}
                            →{" "}
                            {exam.available_until
                              ? exam.available_until.slice(0, 16).replace("T", " ")
                              : "No deadline"}
                          </span>
                        </p>
                      )}
                    </CardContent>

                    <CardFooter className="border-t border-border/60 pt-3">
                      {exam.activeAttemptId ? (
                        <Button asChild variant="gold" size="sm" className="w-full">
                          <Link href={`/student/exams/${exam.id}`}>
                            <PlayCircle className="size-4" />
                            <span>{t.exams.resumeExamButton}</span>
                          </Link>
                        </Button>
                      ) : canStartNew ? (
                        <Button asChild variant="gold" size="sm" className="w-full">
                          <Link href={`/student/exams/${exam.id}`}>
                            <PlayCircle className="size-4" />
                            <span>{t.exams.startExamButton}</span>
                          </Link>
                        </Button>
                      ) : (
                        <Button asChild variant="outline" size="sm" className="w-full">
                          <Link href={`/student/exams/${exam.id}`}>
                            <Award className="size-4" />
                            <span>{t.exams.viewResultButton}</span>
                          </Link>
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
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
