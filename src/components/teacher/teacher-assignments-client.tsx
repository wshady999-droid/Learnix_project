"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  FileText,
  Folder,
  Loader2,
  MessageSquare,
  Paperclip,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
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
import { LearnixFilePreview } from "@/components/ui/file-preview";
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
import {
  getNowDateTimeLocalString,
  isoToDateTimeLocalString,
} from "@/lib/date-validation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { TableRow as DbTableRow } from "@/services/db/utils";
import {
  teacherDeleteAssignmentAction,
  teacherDeleteAssignmentMaterialAction,
  teacherGetAssignmentFileSignedUrlAction,
  teacherGradeAssignmentSubmissionAction,
  teacherReviewPausedExamAttemptAction,
  teacherSaveAssignmentAction,
} from "@/services/teacher/actions";
import type { TeacherGradingData } from "@/services/teacher/queries";

interface TeacherAssignmentsClientProps {
  data: TeacherGradingData;
}

interface PendingMaterialUpload {
  storageBucket: string;
  storagePath: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
}

export function TeacherAssignmentsClient({
  data,
}: TeacherAssignmentsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<
    "overview" | "submissions" | "attempts" | "violations"
  >("overview");
  const [courseFilter, setCourseFilter] = useState<string>("all");

  // Assignment authoring modal state
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState<
    string | undefined
  >(undefined);
  const [editingOriginalDueAt, setEditingOriginalDueAt] = useState<
    string | null
  >(null);
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
  const [assignIsPublished, setAssignIsPublished] = useState(true);
  const [pendingMaterials, setPendingMaterials] = useState<
    PendingMaterialUpload[]
  >([]);
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  const [creatingAssignment, setCreatingAssignment] = useState(false);

  // File & submission preview modal
  const [previewTarget, setPreviewTarget] = useState<{
    title: string;
    writtenText?: string | null;
    bucketId?: string;
    storagePath?: string | null;
    fileName?: string | null;
    mimeType?: string | null;
    fileSizeBytes?: number | null;
  } | null>(null);

  // AI grading loading tracker
  const [analyzingSubmissionId, setAnalyzingSubmissionId] = useState<
    string | null
  >(null);

  // Grading dialog state
  const [gradingDialogOpen, setGradingDialogOpen] = useState(false);
  const [gradingSubmissionId, setGradingSubmissionId] = useState<string | null>(
    null,
  );
  const [gradingPoints, setGradingPoints] = useState("");
  const [gradingFeedback, setGradingFeedback] = useState("");
  const [gradingPublish, setGradingPublish] = useState(true);
  const [gradingSubmission, setGradingSubmission] = useState<
    TeacherGradingData["assignmentSubmissions"][number] | undefined
  >(undefined);

  // Exam resume review state
  const [reviewingAttemptId, setReviewingAttemptId] = useState<string | null>(
    null,
  );

  // -------------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------------
  const courseTitleMap = useMemo(
    () => new Map(data.courses.map((c) => [c.id, c.title])),
    [data.courses],
  );

  const assignmentsWithSubmissions = useMemo(() => {
    return data.assignments
      .filter((a) => courseFilter === "all" || a.course_id === courseFilter)
      .map((a: DbTableRow<"assignments">) => {
        const subs = data.assignmentSubmissions.filter(
          (s) => s.assignment_id === a.id,
        );
        const mats = data.assignmentMaterials.filter(
          (m) => m.assignment_id === a.id,
        );
        const graded = subs.filter((s) => s.is_grade_published);
        const pending = subs.filter(
          (s) => !s.is_grade_published && s.status !== "draft",
        );
        const aiSuggested = subs.filter(
          (s) => s.aiSuggestedGrade !== null && !s.is_grade_published,
        );
        return {
          ...a,
          courseTitle: courseTitleMap.get(a.course_id) || "Course",
          submissions: subs,
          materials: mats,
          submissionCount: subs.length,
          gradedCount: graded.length,
          pendingCount: pending.length,
          aiSuggestedCount: aiSuggested.length,
        };
      });
  }, [
    data.assignments,
    data.assignmentSubmissions,
    data.assignmentMaterials,
    courseFilter,
    courseTitleMap,
  ]);

  // Grades Overview rows per enrolled student (combining assignments + exams + Message action)
  const studentGradesOverview = useMemo(() => {
    const filteredEnrollments = data.courseEnrollments.filter(
      (e) => courseFilter === "all" || e.courseId === courseFilter,
    );

    return filteredEnrollments.map((enr) => {
      const stuSubs = data.assignmentSubmissions.filter(
        (s) =>
          s.student_id === enr.studentId &&
          s.courseId === enr.courseId &&
          s.grade_points !== null,
      );
      const stuResults = data.results.filter(
        (r) => r.student_id === enr.studentId && r.course_id === enr.courseId,
      );

      const assignAvg =
        stuSubs.length > 0
          ? Number(
              (
                stuSubs.reduce((sum, s) => {
                  const maxPts = Math.max(1, s.maxPoints);
                  return sum + (Number(s.grade_points ?? 0) / maxPts) * 100;
                }, 0) / stuSubs.length
              ).toFixed(1),
            )
          : null;

      const examAvg =
        stuResults.length > 0
          ? Number(
              (
                stuResults.reduce(
                  (sum, r) => sum + Number(r.score_percent ?? 0),
                  0,
                ) / stuResults.length
              ).toFixed(1),
            )
          : null;

      const buckets: number[] = [];
      if (assignAvg !== null) buckets.push(assignAvg);
      if (examAvg !== null) buckets.push(examAvg);
      const overallPct =
        buckets.length > 0
          ? Number(
              (buckets.reduce((a, b) => a + b, 0) / buckets.length).toFixed(1),
            )
          : null;

      return {
        key: `${enr.courseId}-${enr.studentId}`,
        studentId: enr.studentId,
        studentName: enr.studentName,
        studentEmail: enr.studentEmail,
        courseId: enr.courseId,
        courseTitle: courseTitleMap.get(enr.courseId) || "Course",
        gradedAssignmentsCount: stuSubs.length,
        gradedExamsCount: stuResults.length,
        assignAvg,
        examAvg,
        overallPct,
      };
    });
  }, [
    data.courseEnrollments,
    data.assignmentSubmissions,
    data.results,
    courseFilter,
    courseTitleMap,
  ]);

  const pausedAttempts = useMemo(
    () => data.attempts.filter((a) => a.is_paused),
    [data.attempts],
  );

  // Summary metrics
  const totalSubmissions = data.assignmentSubmissions.length;
  const gradedSubmissions = data.assignmentSubmissions.filter(
    (s) => s.is_grade_published,
  ).length;
  const pendingSubmissions = data.assignmentSubmissions.filter(
    (s) => !s.is_grade_published && s.status !== "draft",
  ).length;
  const aiPendingSubmissions = data.assignmentSubmissions.filter(
    (s) => s.aiSuggestedGrade !== null && !s.is_grade_published,
  ).length;

  const allGrades = data.assignmentSubmissions
    .filter((s) => s.grade_points !== null)
    .map((s) => (Number(s.grade_points ?? 0) / Math.max(1, s.maxPoints)) * 100);
  const classAverage =
    allGrades.length > 0
      ? Number(
          (allGrades.reduce((a, b) => a + b, 0) / allGrades.length).toFixed(1),
        )
      : 0;

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------
  function openNewAssignmentModal() {
    if (data.courses.length === 0) {
      toast.error("Create a course first before creating an assignment.");
      return;
    }
    setEditingAssignmentId(undefined);
    setEditingOriginalDueAt(null);
    setAssignCourseId(data.courses[0]!.id);
    setAssignTitle("");
    setAssignDescription("");
    setAssignInstructions("");
    setAssignRubric("");
    setAssignMaxPoints("100");
    setAssignDueAt("");
    setAssignAllowLate(true);
    setAssignIsPublished(true);
    setPendingMaterials([]);
    setAssignmentModalOpen(true);
  }

  function openEditAssignmentModal(a: DbTableRow<"assignments">) {
    setEditingAssignmentId(a.id);
    setEditingOriginalDueAt(a.due_at);
    setAssignCourseId(a.course_id);
    setAssignTitle(a.title);
    setAssignDescription(a.description);
    setAssignInstructions(a.instructions ?? "");
    setAssignRubric(a.rubric ?? "");
    setAssignMaxPoints(String(a.max_points));
    setAssignDueAt(isoToDateTimeLocalString(a.due_at));
    setAssignAllowLate(a.allow_late_submissions);
    setAssignIsPublished(a.is_published);
    setPendingMaterials([]);
    setAssignmentModalOpen(true);
  }

  async function handleMaterialUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0 || !assignCourseId) return;

    setUploadingMaterial(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const uploadedBatch: PendingMaterialUpload[] = [];

      for (const file of files) {
        if (file.size > 100 * 1024 * 1024) {
          toast.error(`"${file.name}" exceeds the 100 MB limit.`);
          continue;
        }
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        // Unique path preserves original files without overwriting
        const storagePath = `${assignCourseId}/materials/${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 7)}_${safeName}`;

        const { error } = await supabase.storage
          .from("assignment-attachments")
          .upload(storagePath, file, {
            upsert: false,
            contentType: file.type || "application/octet-stream",
          });

        if (error) {
          toast.error(`Failed to upload "${file.name}": ${error.message}`);
          continue;
        }

        uploadedBatch.push({
          storageBucket: "assignment-attachments",
          storagePath,
          fileName: file.name,
          fileSizeBytes: file.size,
          mimeType: file.type || "application/octet-stream",
        });
      }

      if (uploadedBatch.length > 0) {
        setPendingMaterials((prev) => [...prev, ...uploadedBatch]);
        toast.success(`${uploadedBatch.length} material file(s) uploaded.`);
      }
    } finally {
      setUploadingMaterial(false);
      e.target.value = "";
    }
  }

  async function handleSaveAssignment() {
    if (!assignTitle.trim()) {
      toast.error("Assignment title is required.");
      return;
    }
    if (!assignDescription.trim()) {
      toast.error("Description is required.");
      return;
    }

    if (assignDueAt) {
      const chosen = new Date(assignDueAt);
      const isSameHistorical =
        editingOriginalDueAt &&
        Math.abs(new Date(editingOriginalDueAt).getTime() - chosen.getTime()) <
          60_000;
      if (!isSameHistorical && chosen.getTime() < Date.now() - 60_000) {
        toast.error("Due date cannot be in the past.");
        return;
      }
    }

    setCreatingAssignment(true);
    try {
      const res = await teacherSaveAssignmentAction({
        id: editingAssignmentId,
        courseId: assignCourseId,
        lessonId: null,
        title: assignTitle,
        description: assignDescription,
        instructions: assignInstructions || undefined,
        rubric: assignRubric || undefined,
        maxPoints: Number(assignMaxPoints) || 100,
        dueAt: assignDueAt ? new Date(assignDueAt).toISOString() : null,
        allowLateSubmissions: assignAllowLate,
        submissionTypes: ["text", "file"],
        newMaterials: pendingMaterials,
        isPublished: assignIsPublished,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success(
        editingAssignmentId
          ? "Assignment updated."
          : `Assignment "${assignTitle}" saved.`,
      );
      setAssignmentModalOpen(false);
      router.refresh();
    } finally {
      setCreatingAssignment(false);
    }
  }

  async function handleDeleteMaterial(materialId: string, courseId: string) {
    startTransition(async () => {
      const res = await teacherDeleteAssignmentMaterialAction({
        materialId,
        courseId,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Material removed (version archived).");
      router.refresh();
    });
  }

  async function handleDeleteAssignment(a: DbTableRow<"assignments">) {
    if (!confirm(`Delete assignment "${a.title}" and all its submissions?`)) {
      return;
    }
    const res = await teacherDeleteAssignmentAction({
      assignmentId: a.id,
      courseId: a.course_id,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Assignment deleted.");
    router.refresh();
  }

  async function handleRunAiGrading(
    sub: TeacherGradingData["assignmentSubmissions"][number],
  ) {
    setAnalyzingSubmissionId(sub.id);
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

      if (!json.ok || !json.data) {
        toast.error(json.error ?? "AI grading analysis failed.");
        return;
      }

      toast.success(
        `AI suggested ${json.data.suggestedPoints}/${sub.maxPoints} pts. Review and approve to publish.`,
      );

      // Open approval dialog immediately with fresh AI suggestions
      const updatedSub = {
        ...sub,
        aiSuggestedGrade: json.data.suggestedPoints,
        aiExplanation: json.data.suggestedExplanation,
        aiSuggestedFeedback: json.data.suggestedFeedback,
      };
      openGradingDialog(updatedSub);
      router.refresh();
    } catch {
      toast.error("Network error while requesting AI grading suggestion.");
    } finally {
      setAnalyzingSubmissionId(null);
    }
  }

  function openGradingDialog(
    sub: TeacherGradingData["assignmentSubmissions"][number],
  ) {
    setGradingSubmission(sub);
    setGradingSubmissionId(sub.id);
    setGradingPoints(
      sub.grade_points !== null
        ? String(sub.grade_points)
        : sub.aiSuggestedGrade !== null
          ? String(sub.aiSuggestedGrade)
          : "",
    );
    setGradingFeedback(sub.feedback ?? sub.aiSuggestedFeedback ?? "");
    setGradingPublish(true);
    setGradingDialogOpen(true);
  }

  function handleSaveGrade() {
    if (!gradingSubmissionId) return;
    const pts = Number(gradingPoints);
    if (!Number.isFinite(pts) || pts < 0) {
      toast.error("Enter a valid grade.");
      return;
    }
    if (gradingSubmission && pts > gradingSubmission.maxPoints) {
      toast.error(
        `Grade cannot exceed maximum marks (${gradingSubmission.maxPoints}).`,
      );
      return;
    }

    startTransition(async () => {
      const res = await teacherGradeAssignmentSubmissionAction({
        submissionId: gradingSubmissionId,
        gradePoints: pts,
        feedback: gradingFeedback || undefined,
        publishGrade: gradingPublish,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success(
        gradingPublish
          ? "Grade approved and published to student."
          : "Draft grade saved (hidden from student until published).",
      );
      setGradingDialogOpen(false);
      router.refresh();
    });
  }

  function handleReviewPausedAttempt(
    attemptId: string,
    decision: "approved" | "rejected",
  ) {
    setReviewingAttemptId(attemptId);
    startTransition(async () => {
      const res = await teacherReviewPausedExamAttemptAction({
        attemptId,
        decision,
      });
      setReviewingAttemptId(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        decision === "approved"
          ? "Exam resume approved — student can continue."
          : "Paused exam attempt closed.",
      );
      router.refresh();
    });
  }

  const existingMaterialsForEditing = useMemo(
    () =>
      editingAssignmentId
        ? data.assignmentMaterials.filter(
            (m) => m.assignment_id === editingAssignmentId,
          )
        : [],
    [data.assignmentMaterials, editingAssignmentId],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Assignments
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload assignment materials, preview student submissions, run AI
            grading suggestions, approve final grades, and review student
            progress.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            className={cn(fieldBase, "h-9 w-56 text-xs")}
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            aria-label="Filter by course"
          >
            <option value="all">All My Courses</option>
            {data.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>

          <Button
            variant="gold"
            size="sm"
            disabled={creatingAssignment}
            onClick={openNewAssignmentModal}
          >
            <Plus className="size-4" />
            <span>New Assignment</span>
          </Button>
        </div>
      </div>

      {/* TABS */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeTab === "overview" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("overview")}
        >
          <Folder className="mr-1 size-3.5" />
          <span>Grades Overview</span>
        </Button>
        <Button
          variant={activeTab === "submissions" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("submissions")}
        >
          <FileText className="mr-1 size-3.5" />
          <span>Assignments & Submissions ({data.assignments.length})</span>
        </Button>
        <Button
          variant={activeTab === "attempts" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("attempts")}
        >
          <CheckCircle2 className="mr-1 size-3.5" />
          <span>Exam Attempts ({data.attempts.length})</span>
        </Button>
        <Button
          variant={activeTab === "violations" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("violations")}
        >
          <AlertCircle className="mr-1 size-3.5" />
          <span>
            Exam Monitoring ({data.violations.length}
            {pausedAttempts.length > 0
              ? ` • ${pausedAttempts.length} Paused`
              : ""}
            )
          </span>
        </Button>
      </div>

      {/* TAB 1: GRADES OVERVIEW (Students, Grades & Messaging Action) */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Submissions</CardDescription>
                <CardTitle className="text-2xl">{totalSubmissions}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Pending Review</CardDescription>
                <CardTitle className="text-2xl">{pendingSubmissions}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>
                  AI-Suggested (Awaiting Approval)
                </CardDescription>
                <CardTitle className="text-2xl">
                  {aiPendingSubmissions}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>
                  Published Grades ({gradedSubmissions}) • Class Average
                </CardDescription>
                <CardTitle className="text-2xl">
                  {classAverage.toFixed(1)}%
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Student Grades Overview
              </CardTitle>
              <CardDescription>
                Assignment and exam grades for enrolled students, with direct
                one-click messaging.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {studentGradesOverview.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No Enrolled Students Yet"
                  description="Once students enroll in your courses, their assignment and exam grades will appear here."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Course</TableHead>
                      <TableHead>Assignments Avg</TableHead>
                      <TableHead>Exams Avg</TableHead>
                      <TableHead>Overall Grade</TableHead>
                      <TableHead className="text-end">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentGradesOverview.map((row) => (
                      <TableRow key={row.key}>
                        <TableCell>
                          <p className="font-semibold text-foreground">
                            {row.studentName}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {row.studentEmail}
                          </p>
                        </TableCell>
                        <TableCell className="text-xs font-medium">
                          {row.courseTitle}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.assignAvg !== null
                            ? `${row.assignAvg}% (${row.gradedAssignmentsCount})`
                            : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.examAvg !== null
                            ? `${row.examAvg}% (${row.gradedExamsCount})`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {row.overallPct !== null ? (
                            <Badge
                              variant={
                                row.overallPct >= 60 ? "gold" : "destructive"
                              }
                            >
                              {row.overallPct}%
                            </Badge>
                          ) : (
                            <Badge variant="outline">No grades yet</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-end">
                          <Button asChild variant="outline" size="sm">
                            <Link
                              href={`/messages?userId=${row.studentId}&courseId=${row.courseId}`}
                            >
                              <MessageSquare className="size-3.5 text-emerald-500" />
                              <span>Message</span>
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
        </div>
      )}

      {/* TAB 2: ASSIGNMENTS, MATERIALS & STUDENT SUBMISSIONS */}
      {activeTab === "submissions" && (
        <div className="space-y-6">
          {assignmentsWithSubmissions.length === 0 ? (
            <EmptyState
              icon={Folder}
              title="No Assignments"
              description="Create an assignment and attach reference materials to collect student solutions."
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
            <div className="space-y-5">
              {assignmentsWithSubmissions.map((a) => (
                <Card key={a.id} className="border-border/80">
                  <CardHeader className="flex flex-wrap items-start justify-between gap-3 pb-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {a.courseTitle}
                        </Badge>
                        <Badge variant={a.is_published ? "gold" : "outline"}>
                          {a.is_published ? "Published" : "Draft"}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg">{a.title}</CardTitle>
                      <CardDescription className="line-clamp-2 text-xs">
                        {a.description}
                      </CardDescription>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-xs">
                        {a.submissionCount} submissions
                      </Badge>
                      <Badge
                        variant={a.gradedCount > 0 ? "gold" : "outline"}
                        className="text-xs"
                      >
                        {a.gradedCount} published
                      </Badge>
                      {a.aiSuggestedCount > 0 && (
                        <Badge variant="gold" className="text-xs">
                          {a.aiSuggestedCount} AI-suggested
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Uploaded Assignment Materials */}
                    {(a.materials.length > 0 || a.attachment_storage_path) && (
                      <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                          <Paperclip className="size-3.5 text-emerald-500" />
                          <span>Assignment Materials</span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {a.materials.map((mat) => (
                            <div
                              key={mat.id}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-background px-2.5 py-1.5 text-xs"
                            >
                              <span className="max-w-[180px] truncate font-medium">
                                {mat.file_name}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1.5"
                                onClick={() =>
                                  setPreviewTarget({
                                    title: `Material: ${mat.file_name}`,
                                    bucketId: mat.storage_bucket,
                                    storagePath: mat.storage_path,
                                    fileName: mat.file_name,
                                    mimeType: mat.mime_type,
                                    fileSizeBytes: mat.file_size_bytes,
                                  })
                                }
                              >
                                <Eye className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 px-1.5"
                                onClick={() =>
                                  void handleDeleteMaterial(mat.id, a.course_id)
                                }
                              >
                                <Trash2 className="size-3 text-destructive" />
                              </Button>
                            </div>
                          ))}
                          {a.attachment_storage_path &&
                            !a.materials.some(
                              (m) =>
                                m.storage_path === a.attachment_storage_path,
                            ) && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setPreviewTarget({
                                    title: `Material: ${
                                      a.attachment_file_name || "Attachment"
                                    }`,
                                    bucketId: "assignment-attachments",
                                    storagePath: a.attachment_storage_path,
                                    fileName:
                                      a.attachment_file_name || "Attachment",
                                  })
                                }
                              >
                                <Eye className="size-3.5" />
                                <span>
                                  {a.attachment_file_name ||
                                    "Preview Attachment"}
                                </span>
                              </Button>
                            )}
                        </div>
                      </div>
                    )}

                    {/* Student Submissions Table */}
                    {a.submissions.length === 0 ? (
                      <div className="py-6 text-center text-xs text-muted-foreground">
                        No student submissions yet for this assignment.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Published Grade</TableHead>
                            <TableHead>AI Suggestion</TableHead>
                            <TableHead>Submission</TableHead>
                            <TableHead className="text-end">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {a.submissions.map((s) => {
                            const maxPts = Math.max(1, s.maxPoints);
                            const gradePct =
                              s.grade_points !== null
                                ? `${s.grade_points}/${maxPts} (${(
                                    (Number(s.grade_points) / maxPts) *
                                    100
                                  ).toFixed(0)}%)`
                                : "Unpublished";
                            const aiLabel =
                              s.aiSuggestedGrade !== null
                                ? `${s.aiSuggestedGrade}/${maxPts}`
                                : "—";
                            const isAnalyzing = analyzingSubmissionId === s.id;

                            return (
                              <TableRow key={s.id}>
                                <TableCell>
                                  <p className="text-sm font-medium">
                                    {s.studentName}
                                  </p>
                                  <p className="font-mono text-[11px] text-muted-foreground">
                                    {s.submitted_at
                                      .slice(0, 16)
                                      .replace("T", " ")}
                                  </p>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={
                                      s.is_grade_published
                                        ? "gold"
                                        : s.status === "late"
                                          ? "destructive"
                                          : "outline"
                                    }
                                    className="text-[10px]"
                                  >
                                    {s.is_grade_published ? "published" : s.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                  {s.is_grade_published ? gradePct : "Pending"}
                                </TableCell>
                                <TableCell className="font-mono text-xs text-emerald-500">
                                  {aiLabel}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        setPreviewTarget({
                                          title: `${s.studentName} — ${s.assignmentTitle}`,
                                          writtenText: s.submission_text,
                                          bucketId: "assignment-attachments",
                                          storagePath: s.attachment_storage_path,
                                          fileName:
                                            s.attachment_file_name ||
                                            s.attachment_storage_path
                                              ?.split("/")
                                              .pop() ||
                                            "submission",
                                          mimeType: s.attachment_mime_type,
                                        })
                                      }
                                    >
                                      <Eye className="size-3.5" />
                                      <span>Preview</span>
                                    </Button>

                                    {s.attachment_storage_path && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        title="Download submitted file"
                                        onClick={() => {
                                          void teacherGetAssignmentFileSignedUrlAction(
                                            {
                                              storagePath:
                                                s.attachment_storage_path!,
                                              courseId: s.courseId,
                                            },
                                          ).then((res) => {
                                            if (res.ok) {
                                              window.open(
                                                res.data.signedUrl,
                                                "_blank",
                                                "noopener,noreferrer",
                                              );
                                            } else {
                                              toast.error(res.error);
                                            }
                                          });
                                        }}
                                      >
                                        <Download className="size-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-end">
                                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      disabled={isAnalyzing}
                                      onClick={() =>
                                        void handleRunAiGrading(s)
                                      }
                                    >
                                      {isAnalyzing ? (
                                        <Loader2 className="size-3.5 animate-spin" />
                                      ) : (
                                        <Sparkles className="size-3.5 text-emerald-500" />
                                      )}
                                      <span>
                                        {s.aiSuggestedGrade !== null
                                          ? "Re-Analyze AI"
                                          : "AI Suggest"}
                                      </span>
                                    </Button>

                                    <Button
                                      type="button"
                                      variant={
                                        s.aiSuggestedGrade !== null &&
                                        !s.is_grade_published
                                          ? "gold"
                                          : "outline"
                                      }
                                      size="sm"
                                      onClick={() => openGradingDialog(s)}
                                    >
                                      <Check className="size-3.5" />
                                      <span>
                                        {s.is_grade_published
                                          ? "Edit Grade"
                                          : s.aiSuggestedGrade !== null
                                            ? "Review & Approve"
                                            : "Grade"}
                                      </span>
                                    </Button>

                                    <Button
                                      asChild
                                      variant="ghost"
                                      size="sm"
                                      title="Message student"
                                    >
                                      <Link
                                        href={`/messages?userId=${s.student_id}&courseId=${s.courseId}`}
                                      >
                                        <MessageSquare className="size-3.5" />
                                      </Link>
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>

                  <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Max: {a.max_points} pts</span>
                      <span>•</span>
                      <span>
                        Due{" "}
                        {a.due_at
                          ? a.due_at.slice(0, 16).replace("T", " ")
                          : "Open"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditAssignmentModal(a)}
                      >
                        <Edit3 className="size-3.5" />
                        <span>Edit & Materials</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleDeleteAssignment(a)}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: EXAM ATTEMPTS */}
      {activeTab === "attempts" && (
        <Card>
          <CardContent className="pt-6">
            {data.attempts.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No Exam Attempts"
                description="Students have not attempted any exams yet."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Exam</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-end">Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.attempts.map((att) => (
                    <TableRow key={att.id}>
                      <TableCell className="text-sm font-medium">
                        {att.studentName}
                      </TableCell>
                      <TableCell className="text-sm">{att.examTitle}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {att.courseTitle}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {att.scorePercent.toFixed(1)}%
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            att.is_paused
                              ? "destructive"
                              : att.status === "graded"
                                ? "gold"
                                : "outline"
                          }
                          className="text-[10px]"
                        >
                          {att.is_paused ? "paused" : att.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {att.submitted_at
                          ? att.submitted_at.slice(0, 16).replace("T", " ")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-end">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/messages?userId=${att.student_id}`}>
                            <MessageSquare className="size-3.5" />
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

      {/* TAB 4: EXAM MONITORING & PAUSE/RESUME APPROVAL */}
      {activeTab === "violations" && (
        <div className="space-y-6">
          {pausedAttempts.length > 0 && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertCircle className="size-4 text-destructive" />
                  <span>
                    Paused Exams Awaiting Your Approval ({pausedAttempts.length}
                    )
                  </span>
                </CardTitle>
                <CardDescription>
                  These students triggered an exam security event. Their
                  progress is saved and their exam is locked until you approve
                  resuming or close the attempt.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Exam</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Paused At</TableHead>
                      <TableHead>Remaining Time</TableHead>
                      <TableHead className="text-end">Decision</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pausedAttempts.map((att) => (
                      <TableRow key={att.id}>
                        <TableCell className="font-semibold">
                          {att.studentName}
                        </TableCell>
                        <TableCell>{att.examTitle}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">
                            {(att.paused_reason || "security_event").replace(
                              /_/g,
                              " ",
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {att.paused_at
                            ? att.paused_at.slice(0, 19).replace("T", " ")
                            : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {att.remaining_seconds !== null
                            ? `${Math.ceil(att.remaining_seconds / 60)} min`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-end">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="gold"
                              disabled={reviewingAttemptId === att.id}
                              onClick={() =>
                                handleReviewPausedAttempt(att.id, "approved")
                              }
                            >
                              <Play className="size-3.5" />
                              <span>Approve Resume</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={reviewingAttemptId === att.id}
                              onClick={() =>
                                handleReviewPausedAttempt(att.id, "rejected")
                              }
                            >
                              <XCircle className="size-3.5" />
                              <span>Close Attempt</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Recorded Exam Monitoring Events
              </CardTitle>
              <CardDescription>
                Timestamped browser visibility, focus, clipboard, and camera
                events recorded during active exams.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.violations.length === 0 ? (
                <EmptyState
                  icon={AlertCircle}
                  title="No Security Events"
                  description="No exam integrity events have been logged."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Exam</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Attempt State</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.violations.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">
                          {v.studentName}
                        </TableCell>
                        <TableCell>{v.examTitle}</TableCell>
                        <TableCell className="text-xs">
                          {v.violation_type.replace(/_/g, " ")}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              v.severity === "high" || v.severity === "critical"
                                ? "destructive"
                                : "outline"
                            }
                            className="text-[10px]"
                          >
                            {v.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {v.occurred_at.slice(0, 19).replace("T", " ")}
                        </TableCell>
                        <TableCell>
                          {v.isAttemptPaused ? (
                            <Button
                              size="sm"
                              variant="gold"
                              onClick={() =>
                                handleReviewPausedAttempt(
                                  v.attempt_id,
                                  "approved",
                                )
                              }
                            >
                              Approve Resume
                            </Button>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              {v.attemptResumeStatus === "none"
                                ? "logged"
                                : v.attemptResumeStatus}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Assignment Authoring & Materials Modal */}
      <Dialog open={assignmentModalOpen} onOpenChange={setAssignmentModalOpen}>
        <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingAssignmentId ? "Edit Assignment" : "New Assignment"}
            </DialogTitle>
            <DialogDescription>
              Configure assignment details, attach reference materials (PDF,
              Word, PowerPoint, Excel, video, image), and set a future deadline.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSaveAssignment();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Course *</Label>
                <select
                  className={cn(fieldBase, "h-9 w-full")}
                  value={assignCourseId}
                  onChange={(e) => setAssignCourseId(e.target.value)}
                >
                  {data.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={assignTitle}
                  onChange={(e) => setAssignTitle(e.target.value)}
                  placeholder="e.g. Module 2 Practical Assignment"
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Description *</Label>
                <Textarea
                  value={assignDescription}
                  onChange={(e) => setAssignDescription(e.target.value)}
                  rows={3}
                  placeholder="Explain the objective and deliverables..."
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Instructions</Label>
                <Textarea
                  value={assignInstructions}
                  onChange={(e) => setAssignInstructions(e.target.value)}
                  rows={2}
                  placeholder="Formatting or submission instructions..."
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Grading Rubric (Used by AI & Teacher)</Label>
                <Textarea
                  value={assignRubric}
                  onChange={(e) => setAssignRubric(e.target.value)}
                  rows={2}
                  placeholder="Criteria for AI grading suggestions..."
                />
              </div>
              <div className="space-y-2">
                <Label>Max Points</Label>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={assignMaxPoints}
                  onChange={(e) => setAssignMaxPoints(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Due Date & Time</Label>
                <Input
                  type="datetime-local"
                  min={getNowDateTimeLocalString()}
                  value={assignDueAt}
                  onChange={(e) => setAssignDueAt(e.target.value)}
                />
              </div>
            </div>

            {/* Assignment Materials Upload */}
            <div className="space-y-2 rounded-xl border border-border/80 bg-muted/30 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Label className="text-xs font-semibold">
                    Assignment Materials
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Upload PDF, Word, PowerPoint, Excel, video, or image files
                    for students to preview and download.
                  </p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:border-emerald-500">
                  {uploadingMaterial ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Upload className="size-3.5 text-emerald-500" />
                  )}
                  <span>
                    {uploadingMaterial ? "Uploading..." : "Upload Files"}
                  </span>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md,.zip,.png,.jpg,.jpeg,.webp,.mp4,.webm,.mov"
                    className="hidden"
                    disabled={uploadingMaterial}
                    onChange={(e) => void handleMaterialUpload(e)}
                  />
                </label>
              </div>

              {(existingMaterialsForEditing.length > 0 ||
                pendingMaterials.length > 0) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {existingMaterialsForEditing.map((m) => (
                    <Badge key={m.id} variant="outline" className="gap-1.5">
                      <span>{m.file_name}</span>
                    </Badge>
                  ))}
                  {pendingMaterials.map((m, idx) => (
                    <Badge key={m.storagePath} variant="gold" className="gap-1">
                      <span>{m.fileName} (New)</span>
                      <button
                        type="button"
                        onClick={() =>
                          setPendingMaterials((prev) =>
                            prev.filter((_, i) => i !== idx),
                          )
                        }
                        className="ml-1 text-xs"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-6 pt-1">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={assignAllowLate}
                  onChange={(e) => setAssignAllowLate(e.target.checked)}
                  className="size-4 rounded border-border accent-emerald-600"
                />
                <span className="text-sm">Allow late submissions</span>
              </label>

              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={assignIsPublished}
                  onChange={(e) => setAssignIsPublished(e.target.checked)}
                  className="size-4 rounded border-border accent-emerald-600"
                />
                <span className="text-sm font-medium">
                  Publish to enrolled students
                </span>
              </label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAssignmentModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="gold"
                disabled={creatingAssignment || uploadingMaterial}
              >
                {creatingAssignment ? "Saving…" : "Save Assignment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* In-App Submission & Material Preview Modal */}
      <Dialog
        open={Boolean(previewTarget)}
        onOpenChange={(open) => {
          if (!open) setPreviewTarget(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
          {previewTarget && (
            <>
              <DialogHeader>
                <DialogTitle>{previewTarget.title}</DialogTitle>
                <DialogDescription>
                  In-app preview (original uploaded file is never modified).
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {previewTarget.writtenText && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Student Written Solution</Label>
                    <div className="max-h-60 overflow-y-auto rounded-xl border border-border/80 bg-muted/40 p-4 text-xs leading-relaxed whitespace-pre-wrap text-foreground">
                      {previewTarget.writtenText}
                    </div>
                  </div>
                )}

                {previewTarget.storagePath && previewTarget.bucketId ? (
                  <LearnixFilePreview
                    bucketId={previewTarget.bucketId}
                    storagePath={previewTarget.storagePath}
                    fileName={previewTarget.fileName || "file"}
                    mimeType={previewTarget.mimeType}
                    fileSizeBytes={previewTarget.fileSizeBytes}
                  />
                ) : !previewTarget.writtenText ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No file or text attached to this submission.
                  </p>
                ) : null}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Grading & AI Approval Dialog */}
      <Dialog open={gradingDialogOpen} onOpenChange={setGradingDialogOpen}>
        <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {gradingSubmission?.is_grade_published
                ? "Edit Published Grade"
                : "Review, Approve & Publish Grade"}
            </DialogTitle>
            <DialogDescription>
              {gradingSubmission?.assignmentTitle} —{" "}
              {gradingSubmission?.studentName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 rounded-xl border border-border/70 bg-muted/30 p-3.5 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Max Points</p>
                <p className="font-mono font-semibold">
                  {gradingSubmission?.maxPoints}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  AI Suggested Score
                </p>
                <p className="font-mono font-semibold text-emerald-500">
                  {gradingSubmission?.aiSuggestedGrade !== null &&
                  gradingSubmission?.aiSuggestedGrade !== undefined
                    ? `${gradingSubmission.aiSuggestedGrade} / ${gradingSubmission.maxPoints}`
                    : "Not analyzed yet"}
                </p>
              </div>
              {gradingSubmission?.aiExplanation && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-foreground">
                    AI Grading Rationale
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {gradingSubmission.aiExplanation}
                  </p>
                </div>
              )}
            </div>

            {gradingSubmission && (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPreviewTarget({
                      title: `${gradingSubmission.studentName} — ${gradingSubmission.assignmentTitle}`,
                      writtenText: gradingSubmission.submission_text,
                      bucketId: "assignment-attachments",
                      storagePath: gradingSubmission.attachment_storage_path,
                      fileName:
                        gradingSubmission.attachment_file_name || "submission",
                      mimeType: gradingSubmission.attachment_mime_type,
                    })
                  }
                >
                  <Eye className="size-3.5" />
                  <span>Preview Submission</span>
                </Button>

                {gradingSubmission.aiSuggestedGrade !== null && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setGradingPoints(
                        String(gradingSubmission.aiSuggestedGrade),
                      );
                      if (gradingSubmission.aiSuggestedFeedback) {
                        setGradingFeedback(
                          gradingSubmission.aiSuggestedFeedback,
                        );
                      }
                    }}
                  >
                    <Sparkles className="size-3.5 text-emerald-500" />
                    <span>Use AI Suggestion</span>
                  </Button>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Approved Grade (points)</Label>
              <Input
                type="number"
                min={0}
                step="0.5"
                max={gradingSubmission?.maxPoints ?? 1000}
                value={gradingPoints}
                onChange={(e) => setGradingPoints(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Instructor Feedback</Label>
              <Textarea
                value={gradingFeedback}
                onChange={(e) => setGradingFeedback(e.target.value)}
                rows={3}
                placeholder="Constructive comments for the student..."
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={gradingPublish}
                onChange={(e) => setGradingPublish(e.target.checked)}
                className="size-4 rounded border-border accent-emerald-600"
              />
              <span className="text-sm">
                Approve & publish grade to student immediately
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setGradingDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="gold"
              onClick={handleSaveGrade}
              disabled={isPending}
            >
              {isPending
                ? "Saving…"
                : gradingPublish
                  ? "Approve & Publish"
                  : "Save Unpublished Draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
