"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  Download,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  Sparkles,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getTeacherDictionary } from "@/i18n/teacher-dictionaries";
import {
  downloadExcelCsv,
  exportPrintablePdfReport,
} from "@/lib/admin/export-and-import";
import {
  teacherGradeAssignmentSubmissionAction,
  teacherGradeEssayAnswerAction,
  teacherToggleResultPublishedAction,
} from "@/services/teacher/actions";
import type { TeacherGradingData } from "@/services/teacher/queries";

interface TeacherGradingClientProps {
  data: TeacherGradingData;
}

export function TeacherGradingClient({ data }: TeacherGradingClientProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const t = getTeacherDictionary(locale);
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<
    "attempts" | "essays" | "assignments" | "violations"
  >("attempts");
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(
    null,
  );

  // Essay grading dialog state
  const [gradingAnswer, setGradingAnswer] = useState<
    TeacherGradingData["studentAnswers"][number] | null
  >(null);
  const [essayPoints, setEssayPoints] = useState("0");
  const [essayFeedback, setEssayFeedback] = useState("");
  const [aiGradingId, setAiGradingId] = useState<string | null>(null);

  async function handleRunAiEssaySuggestion(answerId: string) {
    setAiGradingId(answerId);
    try {
      const res = await fetch("/api/ai/grade-essay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerId }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        data?: { suggestedPoints: number; suggestedFeedback: string };
      };
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? "AI essay suggestion failed.");
        return;
      }
      toast.success(
        `AI suggested ${json.data?.suggestedPoints} marks. Review and approve below.`,
      );
      router.refresh();
    } finally {
      setAiGradingId(null);
    }
  }

  // Assignment grading dialog state
  const [gradingSubmission, setGradingSubmission] = useState<
    TeacherGradingData["assignmentSubmissions"][number] | null
  >(null);
  const [assignmentPoints, setAssignmentPoints] = useState("0");
  const [assignmentFeedback, setAssignmentFeedback] = useState("");

  const resultByAttemptMap = useMemo(
    () => new Map(data.results.map((r) => [r.attempt_id, r])),
    [data.results],
  );

  const essayAnswers = useMemo(
    () =>
      data.studentAnswers.filter(
        (ans) =>
          ans.questionType === "essay" ||
          Boolean(ans.answer_text) ||
          ans.ai_suggested_points !== null,
      ),
    [data.studentAnswers],
  );

  const selectedAttemptAnswers = useMemo(
    () =>
      selectedAttemptId
        ? data.studentAnswers.filter((a) => a.attempt_id === selectedAttemptId)
        : [],
    [data.studentAnswers, selectedAttemptId],
  );

  function openEssayGradeDialog(
    ans: TeacherGradingData["studentAnswers"][number],
  ) {
    setGradingAnswer(ans);
    setEssayPoints(
      String(ans.points_awarded ?? ans.ai_suggested_points ?? ans.maxPoints),
    );
    setEssayFeedback(
      ans.teacher_feedback ?? ans.ai_suggested_feedback ?? "",
    );
  }

  function handleSaveEssayGrade(useAiSuggestion = false) {
    if (!gradingAnswer) return;
    const pointsToSave = useAiSuggestion
      ? Number(gradingAnswer.ai_suggested_points ?? essayPoints)
      : Number(essayPoints);
    const feedbackToSave = useAiSuggestion
      ? gradingAnswer.ai_suggested_feedback || essayFeedback
      : essayFeedback;

    startTransition(async () => {
      const res = await teacherGradeEssayAnswerAction({
        answerId: gradingAnswer.id,
        attemptId: gradingAnswer.attempt_id,
        pointsAwarded: pointsToSave,
        teacherFeedback: feedbackToSave,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success(t.grading.essayGradedToast);
      setGradingAnswer(null);
      router.refresh();
    });
  }

  function handleTogglePublishResult(resultId: string, nextPublished: boolean) {
    startTransition(async () => {
      const res = await teacherToggleResultPublishedAction({
        resultId,
        isPublished: nextPublished,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t.grading.resultPublishedToast);
      router.refresh();
    });
  }

  function openAssignmentGradeDialog(
    sub: TeacherGradingData["assignmentSubmissions"][number],
  ) {
    setGradingSubmission(sub);
    setAssignmentPoints(String(sub.grade_points ?? sub.maxPoints));
    setAssignmentFeedback(sub.feedback ?? "");
  }

  function handleSaveAssignmentGrade() {
    if (!gradingSubmission) return;
    startTransition(async () => {
      const res = await teacherGradeAssignmentSubmissionAction({
        submissionId: gradingSubmission.id,
        gradePoints: Number(assignmentPoints),
        feedback: assignmentFeedback,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t.grading.assignmentGradedToast);
      setGradingSubmission(null);
      router.refresh();
    });
  }

  function handleExportCsv() {
    downloadExcelCsv(
      "learnix-teacher-grading-results.csv",
      ["Student", "Email", "Course", "Examination", "Status", "Score (%)", "Passed"],
      data.attempts.map((att) => [
        att.studentName,
        att.studentEmail,
        att.courseTitle,
        att.examTitle,
        att.status,
        att.scorePercent.toFixed(1),
        att.passed ? "Yes" : "No",
      ]),
    );
  }

  function handleExportPdf() {
    exportPrintablePdfReport({
      title: t.grading.title,
      subtitle: t.grading.subtitle,
      headers: ["Student", "Course", "Examination", "Status", "Score (%)"],
      rows: data.attempts.map((att) => [
        att.studentName,
        att.courseTitle,
        att.examTitle,
        att.status,
        `${att.scorePercent.toFixed(1)}%`,
      ]),
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t.grading.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.grading.subtitle}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <FileSpreadsheet className="size-4" />
            <span>{t.common.exportExcel}</span>
          </Button>
          <Button variant="gold" size="sm" onClick={handleExportPdf}>
            <Download className="size-4" />
            <span>{t.common.exportPdf}</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeTab === "attempts" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("attempts")}
        >
          {t.grading.tabExamSubmissions}
        </Button>
        <Button
          variant={activeTab === "essays" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("essays")}
        >
          {t.grading.tabEssayAiReview} ({essayAnswers.length})
        </Button>
        <Button
          variant={activeTab === "assignments" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("assignments")}
        >
          {t.grading.tabAssignments}
        </Button>
        <Button
          variant={activeTab === "violations" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("violations")}
        >
          Proctoring & Camera Events ({data.violations.length})
        </Button>
      </div>

      {activeTab === "attempts" && (
        <Card>
          <CardContent className="pt-6">
            {data.attempts.length === 0 ? (
              <EmptyState
                icon={FileCheck2}
                title={t.common.noRecordsTitle}
                description={t.common.noRecordsDescription}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.grading.studentLabel}</TableHead>
                    <TableHead>{t.grading.examLabel}</TableHead>
                    <TableHead>{t.grading.statusLabel}</TableHead>
                    <TableHead>{t.grading.scorePercentLabel}</TableHead>
                    <TableHead>{t.grading.publishedLabel}</TableHead>
                    <TableHead className="text-right">
                      {t.common.actions}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.attempts.map((att) => {
                    const resultRow = resultByAttemptMap.get(att.id);
                    return (
                      <TableRow key={att.id}>
                        <TableCell>
                          <p className="font-semibold text-foreground">
                            {att.studentName}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {att.studentEmail}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-foreground">
                            {att.examTitle}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {att.courseTitle}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{att.status}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {att.scorePercent.toFixed(1)}%
                        </TableCell>
                        <TableCell>
                          {resultRow ? (
                            <Badge
                              variant={
                                resultRow.is_published ? "gold" : "outline"
                              }
                            >
                              {resultRow.is_published ? "Published" : "Hidden"}
                            </Badge>
                          ) : (
                            <Badge variant="outline">In Progress</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedAttemptId(att.id)}
                            >
                              <Eye className="size-3.5" />
                              <span>{t.grading.reviewAnswersButton}</span>
                            </Button>
                            {resultRow && (
                              <Button
                                variant={
                                  resultRow.is_published ? "ghost" : "gold"
                                }
                                size="sm"
                                disabled={isPending}
                                onClick={() =>
                                  handleTogglePublishResult(
                                    resultRow.id,
                                    !resultRow.is_published,
                                  )
                                }
                              >
                                {resultRow.is_published
                                  ? t.grading.unpublishResultButton
                                  : t.grading.publishResultButton}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "essays" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t.grading.tabEssayAiReview}
            </CardTitle>
            <CardDescription>
              Review written student answers, inspect AI essay grading suggestions, and approve or modify scores.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {essayAnswers.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title={t.common.noRecordsTitle}
                description="Written essay answers from student exam attempts appear here."
              />
            ) : (
              essayAnswers.map((ans) => (
                <div
                  key={ans.id}
                  className="rounded-xl border border-border/80 bg-card/60 p-4 text-xs"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground">
                        {ans.studentName} • {ans.examTitle}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        Prompt: {ans.questionPrompt}
                      </p>
                    </div>
                    <Badge variant="outline">
                      Awarded: {Number(ans.points_awarded ?? 0)} /{" "}
                      {ans.maxPoints} pts
                    </Badge>
                  </div>

                  <div className="mt-3 rounded-lg border border-border/70 bg-background/80 p-3">
                    <p className="font-medium text-foreground">
                      Student Answer:
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                      {ans.answer_text || "No text response submitted."}
                    </p>
                  </div>

                  {(ans.ai_suggested_points !== null ||
                    ans.ai_suggested_feedback) && (
                    <div className="mt-3 rounded-lg border border-gold-primary/40 bg-gold-primary/10 p-3">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-semibold text-foreground">
                          <Sparkles className="size-3.5 text-gold-foreground" />
                          {t.grading.aiSuggestedPointsLabel}:{" "}
                          {Number(ans.ai_suggested_points ?? 0)} /{" "}
                          {ans.maxPoints}
                        </span>
                      </div>
                      {ans.ai_suggested_feedback && (
                        <p className="mt-1 text-muted-foreground">
                          {ans.ai_suggested_feedback}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={aiGradingId === ans.id}
                      onClick={() => void handleRunAiEssaySuggestion(ans.id)}
                    >
                      <Sparkles className="size-3.5 text-gold-foreground" />
                      <span>
                        {aiGradingId === ans.id
                          ? "Evaluating..."
                          : "Run AI Essay Grading"}
                      </span>
                    </Button>
                    <Button
                      variant="gold"
                      size="sm"
                      onClick={() => openEssayGradeDialog(ans)}
                    >
                      <CheckCircle2 className="size-3.5" />
                      <span>Grade / Review Answer</span>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "assignments" && (
        <Card>
          <CardContent className="pt-6">
            {data.assignmentSubmissions.length === 0 ? (
              <EmptyState
                icon={FileCheck2}
                title={t.common.noRecordsTitle}
                description={t.common.noRecordsDescription}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.grading.studentLabel}</TableHead>
                    <TableHead>{t.grading.assignmentTitleLabel}</TableHead>
                    <TableHead>{t.grading.statusLabel}</TableHead>
                    <TableHead>{t.grading.gradePointsLabel}</TableHead>
                    <TableHead className="text-right">
                      {t.common.actions}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.assignmentSubmissions.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell>
                        <p className="font-semibold text-foreground">
                          {sub.studentName}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {sub.studentEmail}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-foreground">
                          {sub.assignmentTitle}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {sub.courseTitle}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            sub.status === "graded" ? "gold" : "outline"
                          }
                        >
                          {sub.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {sub.grade_points !== null
                          ? `${Number(sub.grade_points)} / ${sub.maxPoints}`
                          : `— / ${sub.maxPoints}`}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openAssignmentGradeDialog(sub)}
                        >
                          Grade Submission
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

      {activeTab === "violations" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Exam Proctoring & Camera Monitoring Events
            </CardTitle>
            <CardDescription>
              Timestamped browser focus, tab-switch, copy/print deterrence, and camera/phone-indicator events. Student exam progress is preserved for teacher review.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.violations.length === 0 ? (
              <EmptyState
                icon={FileCheck2}
                title={t.common.noRecordsTitle}
                description="No suspicious proctoring events have been recorded across your examinations."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Examination</TableHead>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.violations.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-semibold text-foreground">
                        {v.studentName}
                      </TableCell>
                      <TableCell>{v.examTitle}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {v.violation_type}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            v.severity === "high" || v.severity === "critical"
                              ? "destructive"
                              : "gold"
                          }
                          className="uppercase"
                        >
                          {v.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {v.occurred_at.slice(0, 19).replace("T", " ")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* INSPECT ATTEMPT ANSWERS DIALOG */}
      <Dialog
        open={Boolean(selectedAttemptId)}
        onOpenChange={(open) => {
          if (!open) setSelectedAttemptId(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t.grading.reviewAnswersButton}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            {selectedAttemptAnswers.length === 0 ? (
              <p className="text-muted-foreground">
                No individual answer rows recorded for this attempt.
              </p>
            ) : (
              selectedAttemptAnswers.map((ans) => (
                <div
                  key={ans.id}
                  className="rounded-lg border border-border/80 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">
                      {ans.questionPrompt}
                    </span>
                    <Badge variant="outline">
                      {Number(ans.points_awarded ?? 0)} / {ans.maxPoints} pts
                    </Badge>
                  </div>
                  {ans.answer_text && (
                    <p className="mt-1.5 text-muted-foreground">
                      {ans.answer_text}
                    </p>
                  )}
                  <div className="mt-2 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedAttemptId(null);
                        openEssayGradeDialog(ans);
                      }}
                    >
                      Adjust Score / Feedback
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* GRADE ESSAY / STUDENT ANSWER DIALOG */}
      <Dialog
        open={Boolean(gradingAnswer)}
        onOpenChange={(open) => {
          if (!open) setGradingAnswer(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.grading.saveEssayGradeButton}</DialogTitle>
            <DialogDescription>
              {gradingAnswer?.studentName} • Max Marks:{" "}
              {gradingAnswer?.maxPoints}
            </DialogDescription>
          </DialogHeader>

          {gradingAnswer && (
            <div className="space-y-4 py-2 text-xs">
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="font-semibold text-foreground">
                  {gradingAnswer.questionPrompt}
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-muted-foreground">
                  {gradingAnswer.answer_text || "Choice answer"}
                </p>
              </div>

              {gradingAnswer.ai_suggested_points !== null && (
                <div className="flex items-center justify-between rounded-lg border border-gold-primary/50 bg-gold-primary/10 p-3">
                  <div>
                    <p className="font-semibold text-foreground">
                      {t.grading.aiSuggestedPointsLabel}:{" "}
                      {Number(gradingAnswer.ai_suggested_points)} /{" "}
                      {gradingAnswer.maxPoints}
                    </p>
                    {gradingAnswer.ai_suggested_feedback && (
                      <p className="mt-0.5 text-muted-foreground">
                        {gradingAnswer.ai_suggested_feedback}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="gold"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleSaveEssayGrade(true)}
                  >
                    {t.grading.approveAiGradeButton}
                  </Button>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>{t.grading.customPointsLabel}</Label>
                <Input
                  type="number"
                  value={essayPoints}
                  onChange={(e) => setEssayPoints(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t.grading.teacherFeedbackLabel}</Label>
                <Textarea
                  rows={3}
                  value={essayFeedback}
                  onChange={(e) => setEssayFeedback(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setGradingAnswer(null)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="gold"
              disabled={isPending}
              onClick={() => handleSaveEssayGrade(false)}
            >
              {t.grading.saveEssayGradeButton}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GRADE ASSIGNMENT DIALOG */}
      <Dialog
        open={Boolean(gradingSubmission)}
        onOpenChange={(open) => {
          if (!open) setGradingSubmission(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.grading.saveAssignmentGradeButton}</DialogTitle>
            <DialogDescription>
              {gradingSubmission?.studentName} •{" "}
              {gradingSubmission?.assignmentTitle}
            </DialogDescription>
          </DialogHeader>

          {gradingSubmission && (
            <div className="space-y-4 py-2 text-xs">
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="font-semibold text-foreground">
                  {t.grading.submissionTextLabel}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                  {gradingSubmission.submission_text ||
                    gradingSubmission.attachment_storage_path ||
                    "Submitted file attachment"}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>
                  {t.grading.gradePointsLabel} (Max:{" "}
                  {gradingSubmission.maxPoints})
                </Label>
                <Input
                  type="number"
                  value={assignmentPoints}
                  onChange={(e) => setAssignmentPoints(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t.grading.teacherFeedbackLabel}</Label>
                <Textarea
                  rows={3}
                  value={assignmentFeedback}
                  onChange={(e) => setAssignmentFeedback(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setGradingSubmission(null)}
            >
              {t.common.cancel}
            </Button>
            <Button
              variant="gold"
              disabled={isPending}
              onClick={handleSaveAssignmentGrade}
            >
              {t.grading.saveAssignmentGradeButton}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
