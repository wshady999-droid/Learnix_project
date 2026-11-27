"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Loader2,
  MessageSquare,
  Plus,
  Sparkles,
  Trash2,
  Upload,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, Textarea, fieldBase } from "@/components/ui/input";
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
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { TableRow as DbTableRow } from "@/services/db/utils";
import {
  teacherDeleteAssignmentAction,
  teacherGetAssignmentFileSignedUrlAction,
  teacherGradeAssignmentSubmissionAction,
  teacherGradeEssayAnswerAction,
  teacherSaveAssignmentAction,
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
    "assignments" | "attempts" | "essays" | "violations"
  >("assignments");
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(
    null,
  );
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>(
    data.assignments[0]?.id ?? "",
  );

  // Assignment authoring modal state
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState<
    string | undefined
  >(undefined);
  const [assignCourseId, setAssignCourseId] = useState<string>(
    data.courses[0]?.id ?? "",
  );
  const [assignTitle, setAssignTitle] = useState("");
  const [assignDescription, setAssignDescription] = useState("");
  const [assignInstructions, setAssignInstructions] = useState("");
  const [assignRubric, setAssignRubric] = useState("");
  const [assignMaxPoints, setAssignMaxPoints] = useState("100");
  const [assignDueAt, setAssignDueAt] = useState("");
  const [assignAllowLate, setAssignAllowLate] = useState(true);
  const [allowTextSub, setAllowTextSub] = useState(true);
  const [allowFileSub, setAllowFileSub] = useState(true);
  const [assignAttachmentPath, setAssignAttachmentPath] = useState("");
  const [assignAttachmentName, setAssignAttachmentName] = useState("");
  const [uploadingAssignFile, setUploadingAssignFile] = useState(false);

  // Essay grading dialog state
  const [gradingAnswer, setGradingAnswer] = useState<
    TeacherGradingData["studentAnswers"][number] | null
  >(null);
  const [essayPoints, setEssayPoints] = useState("0");
  const [essayFeedback, setEssayFeedback] = useState("");
  const [aiGradingId, setAiGradingId] = useState<string | null>(null);

  // Assignment grading dialog state
  const [gradingSubmission, setGradingSubmission] = useState<
    TeacherGradingData["assignmentSubmissions"][number] | null
  >(null);
  const [assignmentPoints, setAssignmentPoints] = useState("0");
  const [assignmentFeedback, setAssignmentFeedback] = useState("");
  const [aiGradingSubId, setAiGradingSubId] = useState<string | null>(null);
  const [liveAiSuggestion, setLiveAiSuggestion] = useState<{
    submissionId: string;
    points: number;
    explanation: string;
    feedback: string;
  } | null>(null);

  const resultByAttemptMap = useMemo(
    () => new Map(data.results.map((r) => [r.attempt_id, r])),
    [data.results],
  );

  const essayAnswers = useMemo(
    () =>
      data.studentAnswers.filter(
        (ans) =>
          ans.questionType === "essay" ||
          ans.questionType === "short_answer" ||
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

  const activeAssignmentId =
    selectedAssignmentId || data.assignments[0]?.id || "";
  const activeAssignment = useMemo(
    () => data.assignments.find((a) => a.id === activeAssignmentId) ?? null,
    [data.assignments, activeAssignmentId],
  );

  const activeAssignmentSubmissions = useMemo(
    () =>
      data.assignmentSubmissions.filter(
        (s) => s.assignment_id === activeAssignmentId,
      ),
    [data.assignmentSubmissions, activeAssignmentId],
  );

  const nonSubmittedStudents = useMemo(() => {
    if (!activeAssignment) return [];
    const submittedIds = new Set(
      activeAssignmentSubmissions.map((s) => s.student_id),
    );
    return data.courseEnrollments.filter(
      (enr) =>
        enr.courseId === activeAssignment.course_id &&
        !submittedIds.has(enr.studentId),
    );
  }, [
    activeAssignment,
    activeAssignmentSubmissions,
    data.courseEnrollments,
  ]);

  function openNewAssignmentModal() {
    if (data.courses.length === 0) {
      toast.error("Create a course first before creating assignments.");
      return;
    }
    setEditingAssignmentId(undefined);
    setAssignCourseId(data.courses[0]!.id);
    setAssignTitle("");
    setAssignDescription("");
    setAssignInstructions(
      "Write your solution clearly or attach your completed file before the deadline.",
    );
    setAssignRubric(
      "Accuracy (40%), Completeness (30%), Clarity & Structure (30%).",
    );
    setAssignMaxPoints("100");
    setAssignDueAt("");
    setAssignAllowLate(true);
    setAllowTextSub(true);
    setAllowFileSub(true);
    setAssignAttachmentPath("");
    setAssignAttachmentName("");
    setAssignmentModalOpen(true);
  }

  function openEditAssignmentModal(item: DbTableRow<"assignments">) {
    setEditingAssignmentId(item.id);
    setAssignCourseId(item.course_id);
    setAssignTitle(item.title);
    setAssignDescription(item.description);
    setAssignInstructions(item.instructions ?? "");
    setAssignRubric(item.rubric ?? "");
    setAssignMaxPoints(String(item.max_points ?? 100));
    setAssignDueAt(item.due_at ? item.due_at.slice(0, 16) : "");
    setAssignAllowLate(item.allow_late_submissions);
    const types = item.submission_types ?? ["text", "file"];
    setAllowTextSub(types.includes("text"));
    setAllowFileSub(types.includes("file"));
    setAssignAttachmentPath(item.attachment_storage_path ?? "");
    setAssignAttachmentName(item.attachment_file_name ?? "");
    setAssignmentModalOpen(true);
  }

  async function handleUploadAssignmentPromptFile(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0];
    if (!file || !assignCourseId) return;

    setUploadingAssignFile(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${assignCourseId}/teacher_prompt_${Date.now()}_${safeName}`;
      const { error } = await supabase.storage
        .from("assignment-attachments")
        .upload(path, file, { upsert: true });

      if (error) {
        toast.error(error.message);
        return;
      }
      setAssignAttachmentPath(path);
      setAssignAttachmentName(file.name);
      toast.success("Assignment attachment uploaded.");
    } finally {
      setUploadingAssignFile(false);
    }
  }

  function handleSaveAssignment(publishNow: boolean) {
    const submissionTypes: Array<"text" | "file"> = [];
    if (allowTextSub) submissionTypes.push("text");
    if (allowFileSub) submissionTypes.push("file");
    if (submissionTypes.length === 0) {
      toast.error("Enable at least one submission type (Text or File).");
      return;
    }

    startTransition(async () => {
      const res = await teacherSaveAssignmentAction({
        id: editingAssignmentId,
        courseId: assignCourseId,
        title: assignTitle,
        description: assignDescription,
        instructions: assignInstructions,
        rubric: assignRubric,
        maxPoints: Number(assignMaxPoints),
        dueAt: assignDueAt ? new Date(assignDueAt).toISOString() : null,
        allowLateSubmissions: assignAllowLate,
        submissionTypes,
        attachmentStoragePath: assignAttachmentPath || null,
        attachmentFileName: assignAttachmentName || null,
        isPublished: publishNow,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success(
        publishNow
          ? "Assignment published to students."
          : "Assignment saved as draft.",
      );
      setAssignmentModalOpen(false);
      setSelectedAssignmentId(res.data.id);
      router.refresh();
    });
  }

  function handleDeleteAssignment(item: DbTableRow<"assignments">) {
    startTransition(async () => {
      const res = await teacherDeleteAssignmentAction({
        assignmentId: item.id,
        courseId: item.course_id,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Assignment deleted.");
      if (selectedAssignmentId === item.id) {
        setSelectedAssignmentId("");
      }
      router.refresh();
    });
  }

  async function handleDownloadAssignmentFile(
    storagePath: string,
    courseId: string,
  ) {
    const res = await teacherGetAssignmentFileSignedUrlAction({
      storagePath,
      courseId,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    window.open(res.data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function handleRunAiAssignmentGrading(
    sub: TeacherGradingData["assignmentSubmissions"][number],
  ) {
    setAiGradingSubId(sub.id);
    try {
      const res = await fetch("/api/ai/grade-assignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: sub.id }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        data?: {
          suggestedPoints: number;
          suggestedExplanation: string;
          suggestedFeedback: string;
        };
      };
      if (!res.ok || !json.ok || !json.data) {
        toast.error(json.error ?? "AI assignment evaluation failed.");
        return;
      }

      setLiveAiSuggestion({
        submissionId: sub.id,
        points: json.data.suggestedPoints,
        explanation: json.data.suggestedExplanation,
        feedback: json.data.suggestedFeedback,
      });
      if (gradingSubmission?.id === sub.id) {
        setAssignmentPoints(String(json.data.suggestedPoints));
        setAssignmentFeedback(json.data.suggestedFeedback);
      }
      toast.success(
        `AI suggested ${json.data.suggestedPoints}/${sub.maxPoints}. Review and approve before publishing.`,
      );
      router.refresh();
    } finally {
      setAiGradingSubId(null);
    }
  }

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

  function handleSaveEssayGrade(useAiSuggestion = false, publishResult = true) {
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
        publishResult,
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
    const latestAi =
      liveAiSuggestion?.submissionId === sub.id ? liveAiSuggestion : null;
    setAssignmentPoints(
      String(
        sub.grade_points ??
          latestAi?.points ??
          sub.aiSuggestedGrade ??
          sub.maxPoints,
      ),
    );
    setAssignmentFeedback(
      sub.feedback ??
        latestAi?.feedback ??
        sub.aiSuggestedFeedback ??
        "",
    );
  }

  function handleSaveAssignmentGrade(publishGrade: boolean) {
    if (!gradingSubmission) return;
    startTransition(async () => {
      const res = await teacherGradeAssignmentSubmissionAction({
        submissionId: gradingSubmission.id,
        gradePoints: Number(assignmentPoints),
        feedback: assignmentFeedback,
        publishGrade,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        publishGrade
          ? "Grade & feedback approved and published to student."
          : "Draft grade saved privately (hidden from student).",
      );
      setGradingSubmission(null);
      router.refresh();
    });
  }

  function handleExportCsv() {
    downloadExcelCsv(
      "learnix-teacher-grading-results.csv",
      [
        "Student",
        "Email",
        "Course",
        "Assessment",
        "Status",
        "Score (%)",
        "Passed",
      ],
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
      headers: ["Student", "Course", "Assessment", "Status", "Score (%)"],
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
            Assignments & Grading Workspace
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create assignments, run AI rubric evaluations, approve & publish student grades, and review quiz attempts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="gold" size="sm" onClick={openNewAssignmentModal}>
            <Plus className="size-4" />
            <span>New Assignment</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <FileSpreadsheet className="size-4" />
            <span>{t.common.exportExcel}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPdf}>
            <Download className="size-4" />
            <span>{t.common.exportPdf}</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeTab === "assignments" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("assignments")}
        >
          Assignments & AI Grading ({data.assignments.length})
        </Button>
        <Button
          variant={activeTab === "attempts" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("attempts")}
        >
          {t.grading.tabExamSubmissions} ({data.attempts.length})
        </Button>
        <Button
          variant={activeTab === "essays" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("essays")}
        >
          {t.grading.tabEssayAiReview} ({essayAnswers.length})
        </Button>
        <Button
          variant={activeTab === "violations" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("violations")}
        >
          Focus & Integrity Log ({data.violations.length})
        </Button>
      </div>

      {/* TAB 1: ASSIGNMENTS MANAGEMENT + SUBMISSIONS + AI GRADING */}
      {activeTab === "assignments" && (
        <div className="space-y-6">
          {data.assignments.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No Assignments Created Yet"
              description="Create your first course assignment with instructions, rubric, attachments, and AI-assisted grading."
              actions={
                <Button
                  variant="gold"
                  size="sm"
                  onClick={openNewAssignmentModal}
                >
                  <Plus className="size-4" />
                  <span>New Assignment</span>
                </Button>
              }
            />
          ) : (
            <>
              {/* Assignment Cards Selector */}
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.assignments.map((item) => {
                  const course = data.courses.find(
                    (c) => c.id === item.course_id,
                  );
                  const subCount = data.assignmentSubmissions.filter(
                    (s) => s.assignment_id === item.id,
                  ).length;
                  const enrolledCount = data.courseEnrollments.filter(
                    (e) => e.courseId === item.course_id,
                  ).length;
                  const isSelected = item.id === activeAssignmentId;

                  return (
                    <Card
                      key={item.id}
                      className={cn(
                        "cursor-pointer transition-all",
                        isSelected
                          ? "border-emerald-500/70 shadow-md"
                          : "border-border/80 hover:border-emerald-500/30",
                      )}
                      onClick={() => setSelectedAssignmentId(item.id)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            {course?.code ?? "COURSE"}
                          </Badge>
                          <Badge
                            variant={item.is_published ? "gold" : "outline"}
                          >
                            {item.is_published ? "Published" : "Draft"}
                          </Badge>
                        </div>
                        <CardTitle className="mt-1.5 text-base">
                          {item.title}
                        </CardTitle>
                        <CardDescription className="line-clamp-2 text-xs">
                          {item.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2 text-xs text-muted-foreground">
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/40 p-2">
                          <span>Max: {Number(item.max_points)} pts</span>
                          <span>
                            Submitted: {subCount} / {enrolledCount}
                          </span>
                        </div>
                        {item.due_at && (
                          <p className="font-mono text-[11px]">
                            Deadline:{" "}
                            {item.due_at.slice(0, 16).replace("T", " ")}
                          </p>
                        )}
                      </CardContent>
                      <CardFooter
                        className="flex items-center justify-between gap-2 border-t border-border/60 pt-2.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant={isSelected ? "gold" : "outline"}
                          size="sm"
                          onClick={() => setSelectedAssignmentId(item.id)}
                        >
                          Open Submissions
                        </Button>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditAssignmentModal(item)}
                          >
                            <Edit3 className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isPending}
                            onClick={() => handleDeleteAssignment(item)}
                          >
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        </div>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>

              {/* Active Assignment Submissions & Non-Submitted Roster */}
              {activeAssignment && (
                <Card>
                  <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-base">
                        {activeAssignment.title} — Submissions & AI Grading
                      </CardTitle>
                      <CardDescription>
                        {activeAssignmentSubmissions.length} submitted •{" "}
                        {nonSubmittedStudents.length} not yet submitted • AI grades require teacher approval before publishing.
                      </CardDescription>
                    </div>
                    {activeAssignment.attachment_storage_path && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void handleDownloadAssignmentFile(
                            activeAssignment.attachment_storage_path!,
                            activeAssignment.course_id,
                          )
                        }
                      >
                        <Download className="size-3.5" />
                        <span>
                          Prompt Attachment (
                          {activeAssignment.attachment_file_name || "Download"})
                        </span>
                      </Button>
                    )}
                  </CardHeader>

                  <CardContent className="space-y-6">
                    {/* Submitted Students Table */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold tracking-wide text-foreground uppercase">
                        Students Who Submitted (
                        {activeAssignmentSubmissions.length})
                      </h4>
                      {activeAssignmentSubmissions.length === 0 ? (
                        <p className="rounded-lg border border-border/60 p-4 text-xs text-muted-foreground">
                          No students have submitted this assignment yet.
                        </p>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Student</TableHead>
                              <TableHead>Submitted Date</TableHead>
                              <TableHead>Files / Content</TableHead>
                              <TableHead>AI Suggested</TableHead>
                              <TableHead>Official Grade</TableHead>
                              <TableHead className="text-right">
                                Actions
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {activeAssignmentSubmissions.map((sub) => {
                              const aiSug =
                                liveAiSuggestion?.submissionId === sub.id
                                  ? liveAiSuggestion.points
                                  : sub.aiSuggestedGrade;

                              return (
                                <TableRow key={sub.id}>
                                  <TableCell>
                                    <p className="font-semibold text-foreground">
                                      {sub.studentName}
                                    </p>
                                    <p className="font-mono text-xs text-muted-foreground">
                                      {sub.studentEmail}
                                    </p>
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    <p className="font-mono text-muted-foreground">
                                      {sub.submitted_at
                                        .slice(0, 16)
                                        .replace("T", " ")}
                                    </p>
                                    <Badge
                                      variant={
                                        sub.status === "late"
                                          ? "destructive"
                                          : sub.gradePublished
                                            ? "gold"
                                            : "outline"
                                      }
                                      className="mt-1"
                                    >
                                      {sub.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    <div className="space-y-1">
                                      {sub.submission_text && (
                                        <span className="block text-muted-foreground">
                                          Written text (
                                          {sub.submission_text.length} chars)
                                        </span>
                                      )}
                                      {sub.attachment_storage_path && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() =>
                                            void handleDownloadAssignmentFile(
                                              sub.attachment_storage_path!,
                                              sub.courseId,
                                            )
                                          }
                                        >
                                          <Download className="size-3.5" />
                                          <span className="max-w-[140px] truncate">
                                            {sub.attachment_file_name ||
                                              "Download File"}
                                          </span>
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-mono text-xs">
                                    {aiSug !== null ? (
                                      <Badge variant="outline">
                                        <Sparkles className="mr-1 size-3 text-emerald-500" />
                                        {aiSug} / {sub.maxPoints}
                                      </Badge>
                                    ) : (
                                      <span className="text-muted-foreground">
                                        Not run
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="font-mono text-xs">
                                    {sub.gradePublished &&
                                    sub.grade_points !== null ? (
                                      <Badge variant="gold">
                                        {Number(sub.grade_points)} /{" "}
                                        {sub.maxPoints} (Published)
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline">
                                        Unpublished
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex flex-wrap justify-end gap-1.5">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={aiGradingSubId === sub.id}
                                        onClick={() =>
                                          void handleRunAiAssignmentGrading(sub)
                                        }
                                      >
                                        {aiGradingSubId === sub.id ? (
                                          <Loader2 className="size-3.5 animate-spin" />
                                        ) : (
                                          <Sparkles className="size-3.5 text-emerald-500" />
                                        )}
                                        <span>AI Grade</span>
                                      </Button>
                                      <Button
                                        variant="gold"
                                        size="sm"
                                        onClick={() =>
                                          openAssignmentGradeDialog(sub)
                                        }
                                      >
                                        Review & Grade
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      )}
                    </div>

                    {/* Students Who Did Not Submit */}
                    <div className="space-y-2 border-t border-border/60 pt-4">
                      <h4 className="text-xs font-semibold tracking-wide text-foreground uppercase">
                        Students Who Have Not Submitted (
                        {nonSubmittedStudents.length})
                      </h4>
                      {nonSubmittedStudents.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Every enrolled student in this course has submitted!
                        </p>
                      ) : (
                        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                          {nonSubmittedStudents.map((stu) => (
                            <div
                              key={stu.studentId}
                              className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/20 p-2.5 text-xs"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-foreground">
                                  {stu.studentName}
                                </p>
                                <p className="truncate font-mono text-[11px] text-muted-foreground">
                                  {stu.studentEmail}
                                </p>
                              </div>
                              <Button asChild variant="outline" size="sm">
                                <Link
                                  href={`/messages?userId=${stu.studentId}&courseId=${stu.courseId}`}
                                >
                                  <MessageSquare className="size-3.5" />
                                  <span>Chat</span>
                                </Link>
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 2: QUIZ / EXAM SUBMISSIONS */}
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

      {/* TAB 3: SHORT ANSWER & ESSAY AI REVIEW */}
      {activeTab === "essays" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t.grading.tabEssayAiReview}
            </CardTitle>
            <CardDescription>
              Review written quiz answers, inspect AI grading suggestions, and approve or modify scores before publishing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {essayAnswers.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title={t.common.noRecordsTitle}
                description="Written short-answer and essay responses from student quizzes appear here."
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
                    <div className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-semibold text-foreground">
                          <Sparkles className="size-3.5 text-emerald-500" />
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
                      <Sparkles className="size-3.5 text-emerald-500" />
                      <span>
                        {aiGradingId === ans.id
                          ? "Evaluating..."
                          : "Run AI Grading"}
                      </span>
                    </Button>
                    <Button
                      variant="gold"
                      size="sm"
                      onClick={() => openEssayGradeDialog(ans)}
                    >
                      <CheckCircle2 className="size-3.5" />
                      <span>Approve / Edit Grade</span>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 4: FOCUS & TAB-SWITCH INTEGRITY LOG */}
      {activeTab === "violations" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Quiz Focus & Tab-Switch Integrity Log
            </CardTitle>
            <CardDescription>
              Timestamped focus-loss and tab-switch logs recorded during timed quizzes to assist instructor review (browser telemetry is advisory and does not guarantee prevention of external assistance).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.violations.length === 0 ? (
              <EmptyState
                icon={FileCheck2}
                title={t.common.noRecordsTitle}
                description="No suspicious focus or tab-switch events have been recorded across your quizzes."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Quiz</TableHead>
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

      {/* CREATE / EDIT ASSIGNMENT DIALOG */}
      <Dialog open={assignmentModalOpen} onOpenChange={setAssignmentModalOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingAssignmentId ? "Edit Assignment" : "Create Assignment"}
            </DialogTitle>
            <DialogDescription>
              Configure instructions, maximum marks, deadline, submission types, rubric, and attachments.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Assignment Title *</Label>
              <Input
                value={assignTitle}
                onChange={(e) => setAssignTitle(e.target.value)}
                placeholder="Project 1: Neural Network Backpropagation Implementation"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Course *</Label>
              <select
                className={cn(fieldBase, "h-9 w-full")}
                value={assignCourseId}
                onChange={(e) => setAssignCourseId(e.target.value)}
              >
                {data.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Maximum Marks *</Label>
              <Input
                type="number"
                min={1}
                value={assignMaxPoints}
                onChange={(e) => setAssignMaxPoints(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Deadline</Label>
              <Input
                type="datetime-local"
                value={assignDueAt}
                onChange={(e) => setAssignDueAt(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Submission Types</Label>
              <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-xs">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={allowTextSub}
                    onChange={(e) => setAllowTextSub(e.target.checked)}
                  />
                  <span>Written Answer</span>
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={allowFileSub}
                    onChange={(e) => setAllowFileSub(e.target.checked)}
                  />
                  <span>File Upload</span>
                </label>
              </div>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Description *</Label>
              <Textarea
                rows={3}
                value={assignDescription}
                onChange={(e) => setAssignDescription(e.target.value)}
                placeholder="Overview of the assignment objectives..."
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Detailed Instructions</Label>
              <Textarea
                rows={3}
                value={assignInstructions}
                onChange={(e) => setAssignInstructions(e.target.value)}
                placeholder="Step-by-step instructions, formatting rules, and deliverables..."
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Grading Rubric (Used by AI Grading Assistant)</Label>
              <Textarea
                rows={2}
                value={assignRubric}
                onChange={(e) => setAssignRubric(e.target.value)}
                placeholder="e.g. Correctness (50 pts), Code Quality (30 pts), Documentation (20 pts)"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="flex items-center gap-1.5">
                <Upload className="size-3.5 text-emerald-500" />
                <span>Reference Attachment (PDF / Starter File)</span>
              </Label>
              <Input
                type="file"
                disabled={uploadingAssignFile}
                onChange={handleUploadAssignmentPromptFile}
              />
              {assignAttachmentName && (
                <p className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                  Attached: {assignAttachmentName}
                </p>
              )}
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3 text-xs font-medium sm:col-span-2">
              <span>Allow Late Submissions (marked as Late)</span>
              <input
                type="checkbox"
                checked={assignAllowLate}
                onChange={(e) => setAssignAllowLate(e.target.checked)}
              />
            </label>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setAssignmentModalOpen(false)}
            >
              {t.common.cancel}
            </Button>
            <Button
              variant="outline"
              disabled={isPending || uploadingAssignFile}
              onClick={() => handleSaveAssignment(false)}
            >
              Save Draft
            </Button>
            <Button
              variant="gold"
              disabled={isPending || uploadingAssignFile}
              onClick={() => handleSaveAssignment(true)}
            >
              Publish Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-3">
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
                    onClick={() => handleSaveEssayGrade(true, true)}
                  >
                    Approve & Publish
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

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setGradingAnswer(null)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() => handleSaveEssayGrade(false, false)}
            >
              Save Unreleased
            </Button>
            <Button
              variant="gold"
              disabled={isPending}
              onClick={() => handleSaveEssayGrade(false, true)}
            >
              Approve & Publish Result
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GRADE ASSIGNMENT SUBMISSION DIALOG */}
      <Dialog
        open={Boolean(gradingSubmission)}
        onOpenChange={(open) => {
          if (!open) setGradingSubmission(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Review & Grade Assignment Submission</DialogTitle>
            <DialogDescription>
              {gradingSubmission?.studentName} •{" "}
              {gradingSubmission?.assignmentTitle} (Max:{" "}
              {gradingSubmission?.maxPoints} pts)
            </DialogDescription>
          </DialogHeader>

          {gradingSubmission && (
            <div className="space-y-4 py-2 text-xs">
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="font-semibold text-foreground">
                  Student Written Submission
                </p>
                <p className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap text-muted-foreground">
                  {gradingSubmission.submission_text ||
                    "No written text included (check attached file below)."}
                </p>
                {gradingSubmission.attachment_storage_path && (
                  <div className="mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void handleDownloadAssignmentFile(
                          gradingSubmission.attachment_storage_path!,
                          gradingSubmission.courseId,
                        )
                      }
                    >
                      <Download className="size-3.5" />
                      <span>
                        Download Submitted File (
                        {gradingSubmission.attachment_file_name || "Attachment"}
                        )
                      </span>
                    </Button>
                  </div>
                )}
              </div>

              {/* AI Grading Panel */}
              <div className="space-y-2 rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-semibold text-foreground">
                    <Sparkles className="size-3.5 text-emerald-500" />
                    <span>AI Grading Suggestion (Requires Teacher Approval)</span>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={aiGradingSubId === gradingSubmission.id}
                    onClick={() =>
                      void handleRunAiAssignmentGrading(gradingSubmission)
                    }
                  >
                    {aiGradingSubId === gradingSubmission.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="size-3.5 text-emerald-500" />
                    )}
                    <span>
                      {gradingSubmission.aiSuggestedGrade !== null
                        ? "Re-run AI Evaluation"
                        : "Run AI Evaluation"}
                    </span>
                  </Button>
                </div>

                {(liveAiSuggestion?.submissionId === gradingSubmission.id ||
                  gradingSubmission.aiSuggestedGrade !== null) && (
                  <div className="space-y-1.5 pt-1 text-muted-foreground">
                    <p className="font-semibold text-foreground">
                      Suggested Grade:{" "}
                      {liveAiSuggestion?.submissionId === gradingSubmission.id
                        ? liveAiSuggestion.points
                        : gradingSubmission.aiSuggestedGrade}{" "}
                      / {gradingSubmission.maxPoints}
                    </p>
                    <p>
                      <strong className="text-foreground">Explanation: </strong>
                      {liveAiSuggestion?.submissionId === gradingSubmission.id
                        ? liveAiSuggestion.explanation
                        : gradingSubmission.aiExplanation}
                    </p>
                    <p>
                      <strong className="text-foreground">
                        Suggested Feedback:{" "}
                      </strong>
                      {liveAiSuggestion?.submissionId === gradingSubmission.id
                        ? liveAiSuggestion.feedback
                        : gradingSubmission.aiSuggestedFeedback}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const pts =
                          liveAiSuggestion?.submissionId ===
                          gradingSubmission.id
                            ? liveAiSuggestion.points
                            : (gradingSubmission.aiSuggestedGrade ?? 0);
                        const fb =
                          liveAiSuggestion?.submissionId ===
                          gradingSubmission.id
                            ? liveAiSuggestion.feedback
                            : (gradingSubmission.aiSuggestedFeedback ?? "");
                        setAssignmentPoints(String(pts));
                        setAssignmentFeedback(fb);
                      }}
                    >
                      Apply Suggestion to Form Below
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>
                  Official Marks (0 – {gradingSubmission.maxPoints})
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={gradingSubmission.maxPoints}
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
                  placeholder="Constructive feedback visible to the student once published..."
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setGradingSubmission(null)}
            >
              {t.common.cancel}
            </Button>
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() => handleSaveAssignmentGrade(false)}
            >
              Save Under Review (Hidden)
            </Button>
            <Button
              variant="gold"
              disabled={isPending}
              onClick={() => handleSaveAssignmentGrade(true)}
            >
              Approve & Publish Grade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
