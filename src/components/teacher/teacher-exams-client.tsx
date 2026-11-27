"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ClipboardCheck,
  CopyPlus,
  Database,
  Edit3,
  Eye,
  Image as ImageIcon,
  Layers,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Trash2,
  Upload,
  Users,
} from "lucide-react";

import type { GeneratedDraftQuestion } from "@/app/api/ai/teacher/route";
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
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { TableRow as DbTableRow } from "@/services/db/utils";
import {
  teacherDeleteQuestionAction,
  teacherImportBankQuestionToExamAction,
  teacherSaveExamAction,
  teacherSaveGeneratedQuizAction,
  teacherSaveQuestionAction,
} from "@/services/teacher/actions";
import type { TeacherExamBuilderData } from "@/services/teacher/queries";

interface TeacherExamsClientProps {
  data: TeacherExamBuilderData;
}

export function TeacherExamsClient({ data }: TeacherExamsClientProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const t = getTeacherDictionary(locale);
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<
    "exams" | "ai-generator" | "builder" | "roster" | "bank"
  >("exams");
  const [selectedExamId, setSelectedExamId] = useState<string>(
    data.exams[0]?.id ?? "",
  );
  const [bankDifficultyFilter, setBankDifficultyFilter] =
    useState<string>("all");

  // AI Quiz Generator state
  const [genCourseId, setGenCourseId] = useState<string>(
    data.courses[0]?.id ?? "",
  );
  const [genTitle, setGenTitle] = useState("");
  const [genQuestionCount, setGenQuestionCount] = useState("5");
  const [genTotalMarks, setGenTotalMarks] = useState("50");
  const [genDifficulty, setGenDifficulty] = useState<
    "balanced" | "easy" | "medium" | "hard"
  >("balanced");
  const [genTypes, setGenTypes] = useState<
    Array<"single_choice" | "multiple_choice" | "true_false" | "short_answer">
  >(["single_choice", "true_false"]);
  const [genDeadline, setGenDeadline] = useState("");
  const [genDurationMinutes, setGenDurationMinutes] = useState("30");
  const [genMaxAttempts, setGenMaxAttempts] = useState("1");
  const [genTopicFocus, setGenTopicFocus] = useState("");
  const [generatingAiQuiz, setGeneratingAiQuiz] = useState(false);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);
  const [draftQuestions, setDraftQuestions] = useState<
    GeneratedDraftQuestion[]
  >([]);
  const [previewQuizOpen, setPreviewQuizOpen] = useState(false);

  // Exam modal state
  const [examDialogOpen, setExamDialogOpen] = useState(false);
  const [editingExamId, setEditingExamId] = useState<string | undefined>(
    undefined,
  );
  const [examCourseId, setExamCourseId] = useState<string>(
    data.courses[0]?.id ?? "",
  );
  const [examChapterId, setExamChapterId] = useState<string>("none");
  const [examClassId, setExamClassId] = useState<string>("none");
  const [assignedStudentIds, setAssignedStudentIds] = useState<string[]>([]);
  const [examTitle, setExamTitle] = useState("");
  const [examDescription, setExamDescription] = useState("");
  const [examInstructions, setExamInstructions] = useState("");
  const [examDuration, setExamDuration] = useState("45");
  const [examTotalPoints, setExamTotalPoints] = useState("100");
  const [examPassingScore, setExamPassingScore] = useState("60");
  const [examMaxAttempts, setExamMaxAttempts] = useState("1");
  const [examRandomCount, setExamRandomCount] = useState("0");
  const [examVersionCount, setExamVersionCount] = useState("1");
  const [examAvailableFrom, setExamAvailableFrom] = useState("");
  const [examAvailableUntil, setExamAvailableUntil] = useState("");
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [strictProctoring, setStrictProctoring] = useState(true);
  const [cameraMonitoringEnabled, setCameraMonitoringEnabled] = useState(false);
  const [allowAnswerReview, setAllowAnswerReview] = useState(true);
  const [retentionDays, setRetentionDays] = useState("30");
  const [showResultsImmediately, setShowResultsImmediately] = useState(true);
  const [examStatus, setExamStatus] = useState<
    "draft" | "published" | "closed" | "archived"
  >("draft");

  // Question modal state
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<
    string | undefined
  >(undefined);
  const [questionType, setQuestionType] = useState<
    | "single_choice"
    | "multiple_choice"
    | "true_false"
    | "short_answer"
    | "essay"
  >("single_choice");
  const [questionDifficulty, setQuestionDifficulty] = useState<
    "easy" | "medium" | "hard"
  >("medium");
  const [questionPoints, setQuestionPoints] = useState("5");
  const [questionOrder, setQuestionOrder] = useState("1");
  const [questionPrompt, setQuestionPrompt] = useState("");
  const [questionExplanation, setQuestionExplanation] = useState("");
  const [questionMediaUrl, setQuestionMediaUrl] = useState("");
  const [questionInBank, setQuestionInBank] = useState(true);
  const [uploadingDiagram, setUploadingDiagram] = useState(false);
  const [questionOptions, setQuestionOptions] = useState<
    Array<{ optionText: string; isCorrect: boolean }>
  >([
    { optionText: "Option A", isCorrect: true },
    { optionText: "Option B", isCorrect: false },
    { optionText: "Option C", isCorrect: false },
    { optionText: "Option D", isCorrect: false },
  ]);

  const activeExamId = selectedExamId || data.exams[0]?.id || "";
  const activeExam = data.exams.find((e) => e.id === activeExamId);

  const examQuestions = useMemo(
    () => data.questions.filter((q) => q.exam_id === activeExamId),
    [data.questions, activeExamId],
  );

  const bankQuestions = useMemo(() => {
    const items = data.questions.filter((q) => q.is_in_bank);
    if (bankDifficultyFilter === "all") return items;
    return items.filter((q) => q.difficulty === bankDifficultyFilter);
  }, [data.questions, bankDifficultyFilter]);

  // Student Quiz Roster: completed vs not attempted for the selected quiz
  const examStudentRoster = useMemo(() => {
    if (!activeExam) return { completed: [], notAttempted: [] };
    const enrolled = data.enrollments.filter(
      (e) => e.courseId === activeExam.course_id,
    );
    const attemptsForExam = data.examAttemptsSummary.filter(
      (a) => a.examId === activeExam.id,
    );

    const completed: Array<{
      studentId: string;
      fullName: string;
      email: string;
      status: string;
      submittedAt: string | null;
      scorePercent: number | null;
    }> = [];
    const notAttempted: Array<{
      studentId: string;
      fullName: string;
      email: string;
    }> = [];

    for (const stu of enrolled) {
      const stuAttempts = attemptsForExam.filter(
        (a) => a.studentId === stu.studentId,
      );
      if (stuAttempts.length > 0) {
        const latest = stuAttempts[0]!;
        completed.push({
          studentId: stu.studentId,
          fullName: stu.fullName,
          email: stu.email,
          status: latest.status,
          submittedAt: latest.submittedAt,
          scorePercent: latest.scorePercent,
        });
      } else {
        notAttempted.push({
          studentId: stu.studentId,
          fullName: stu.fullName,
          email: stu.email,
        });
      }
    }

    return { completed, notAttempted };
  }, [activeExam, data.enrollments, data.examAttemptsSummary]);

  function toggleGenType(
    type: "single_choice" | "multiple_choice" | "true_false" | "short_answer",
  ) {
    setGenTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }

  async function handleGenerateAiQuiz() {
    if (!genCourseId) {
      toast.error("Select a course first.");
      return;
    }
    if (!genTitle.trim()) {
      toast.error("Enter a Quiz Title.");
      return;
    }
    if (genTypes.length === 0) {
      toast.error("Select at least one question type.");
      return;
    }

    setGeneratingAiQuiz(true);
    try {
      const res = await fetch("/api/ai/teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: genCourseId,
          mode: "exam_generator",
          prompt:
            genTopicFocus.trim() ||
            `Generate a ${genDifficulty} quiz titled "${genTitle}" grounded in this course.`,
          questionCount: Math.max(1, Math.min(30, Number(genQuestionCount) || 5)),
          totalMarks: Math.max(1, Number(genTotalMarks) || 50),
          difficultyMix: genDifficulty,
          questionTypes: genTypes,
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        data?: { draftQuestions: GeneratedDraftQuestion[] };
      };
      if (!res.ok || !json.ok || !json.data) {
        toast.error(json.error ?? "AI quiz generation failed.");
        return;
      }
      setDraftQuestions(
        json.data.draftQuestions.map((dq) => ({
          ...dq,
          prompt: dq.prompt.replace(/^\[Draft for Teacher Review\]\s*/i, ""),
        })),
      );
      toast.success(
        `Generated ${json.data.draftQuestions.length} editable draft questions.`,
      );
    } catch {
      toast.error("Failed to connect to AI Quiz Generator.");
    } finally {
      setGeneratingAiQuiz(false);
    }
  }

  async function handleReplaceDraftQuestionWithAi(index: number) {
    const current = draftQuestions[index];
    if (!current || !genCourseId) return;

    setReplacingIndex(index);
    try {
      const res = await fetch("/api/ai/teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: genCourseId,
          mode: "question_replacement",
          prompt:
            genTopicFocus.trim() ||
            `Generate a fresh ${current.difficulty} ${current.questionType} question for "${genTitle}".`,
          questionCount: 1,
          totalMarks: current.points,
          difficultyMix: current.difficulty,
          questionTypes: [current.questionType],
          existingQuestionPrompt: current.prompt,
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        data?: { draftQuestions: GeneratedDraftQuestion[] };
      };
      const replacement = json.data?.draftQuestions?.[0];
      if (!res.ok || !json.ok || !replacement) {
        toast.error(json.error ?? "Failed to replace question with AI.");
        return;
      }
      setDraftQuestions((prev) =>
        prev.map((item, i) =>
          i === index
            ? {
                ...replacement,
                points: current.points,
                prompt: replacement.prompt.replace(
                  /^\[Draft for Teacher Review\]\s*/i,
                  "",
                ),
              }
            : item,
        ),
      );
      toast.success(`Question ${index + 1} replaced with AI.`);
    } finally {
      setReplacingIndex(null);
    }
  }

  function handleAddBlankDraftQuestion() {
    setDraftQuestions((prev) => [
      ...prev,
      {
        prompt: "New question prompt...",
        questionType: "single_choice",
        difficulty: "medium",
        points: 5,
        explanation: "",
        options: [
          { optionText: "Option A", isCorrect: true },
          { optionText: "Option B", isCorrect: false },
          { optionText: "Option C", isCorrect: false },
          { optionText: "Option D", isCorrect: false },
        ],
      },
    ]);
  }

  function handleSaveGeneratedQuiz(status: "draft" | "published") {
    if (!genCourseId || !genTitle.trim()) {
      toast.error("Course and Quiz Title are required.");
      return;
    }
    if (draftQuestions.length === 0) {
      toast.error("Generate or add at least one question before saving.");
      return;
    }

    startTransition(async () => {
      const res = await teacherSaveGeneratedQuizAction({
        courseId: genCourseId,
        title: genTitle,
        description: genTopicFocus || undefined,
        durationMinutes: Number(genDurationMinutes) || 30,
        totalPoints: Number(genTotalMarks) || 50,
        passingScore: 60,
        maxAttempts: Number(genMaxAttempts) || 1,
        availableUntil: genDeadline
          ? new Date(genDeadline).toISOString()
          : null,
        status,
        questions: draftQuestions,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success(
        status === "published"
          ? `Quiz "${genTitle}" published (${res.data.questionCount} questions)!`
          : `Quiz "${genTitle}" saved as draft.`,
      );
      setSelectedExamId(res.data.examId);
      setDraftQuestions([]);
      setGenTitle("");
      setActiveTab("exams");
      router.refresh();
    });
  }

  function openNewExamModal() {
    if (data.courses.length === 0) {
      toast.error("Create a course first before creating a quiz.");
      return;
    }
    setEditingExamId(undefined);
    setExamCourseId(data.courses[0]!.id);
    setExamChapterId("none");
    setExamClassId("none");
    setAssignedStudentIds([]);
    setExamTitle("");
    setExamDescription("");
    setExamInstructions(
      "Answer all questions carefully. Focus loss and tab switching are logged during timed attempts.",
    );
    setExamDuration("45");
    setExamTotalPoints("100");
    setExamPassingScore("60");
    setExamMaxAttempts("1");
    setExamRandomCount("0");
    setExamVersionCount("1");
    setExamAvailableFrom("");
    setExamAvailableUntil("");
    setShuffleQuestions(true);
    setShuffleOptions(true);
    setStrictProctoring(true);
    setCameraMonitoringEnabled(false);
    setAllowAnswerReview(true);
    setRetentionDays("30");
    setShowResultsImmediately(true);
    setExamStatus("draft");
    setExamDialogOpen(true);
  }

  function openEditExamModal(exam: DbTableRow<"exams">) {
    setEditingExamId(exam.id);
    setExamCourseId(exam.course_id);
    setExamChapterId(exam.chapter_id ?? "none");
    setExamClassId(exam.class_id ?? "none");
    setAssignedStudentIds(exam.assigned_student_ids ?? []);
    setExamTitle(exam.title);
    setExamDescription(exam.description ?? "");
    setExamInstructions(exam.instructions ?? "");
    setExamDuration(String(exam.duration_minutes));
    setExamTotalPoints(String(exam.total_points));
    setExamPassingScore(String(exam.passing_score));
    setExamMaxAttempts(String(exam.max_attempts));
    setExamRandomCount(String(exam.random_question_count ?? 0));
    setExamVersionCount(String(exam.version_count ?? 1));
    setExamAvailableFrom(
      exam.available_from ? exam.available_from.slice(0, 16) : "",
    );
    setExamAvailableUntil(
      exam.available_until ? exam.available_until.slice(0, 16) : "",
    );
    setShuffleQuestions(exam.shuffle_questions);
    setShuffleOptions(exam.shuffle_options);
    setStrictProctoring(exam.strict_proctoring);
    setCameraMonitoringEnabled(exam.camera_monitoring_enabled);
    setAllowAnswerReview(exam.allow_answer_review);
    setRetentionDays(String(exam.retention_days ?? 30));
    setShowResultsImmediately(exam.show_results_immediately);
    setExamStatus(exam.status);
    setExamDialogOpen(true);
  }

  function toggleAssignedStudent(studentId: string) {
    setAssignedStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId],
    );
  }

  function handleSaveExam() {
    startTransition(async () => {
      const res = await teacherSaveExamAction({
        id: editingExamId,
        courseId: examCourseId,
        chapterId: examChapterId === "none" ? null : examChapterId,
        classId: examClassId === "none" ? null : examClassId,
        assignedStudentIds,
        title: examTitle,
        description: examDescription,
        instructions: examInstructions,
        durationMinutes: Number(examDuration),
        totalPoints: Number(examTotalPoints),
        passingScore: Number(examPassingScore),
        maxAttempts: Number(examMaxAttempts),
        randomQuestionCount: Number(examRandomCount) || null,
        versionCount: Number(examVersionCount) || 1,
        availableFrom: examAvailableFrom
          ? new Date(examAvailableFrom).toISOString()
          : null,
        availableUntil: examAvailableUntil
          ? new Date(examAvailableUntil).toISOString()
          : null,
        shuffleQuestions,
        shuffleOptions,
        strictProctoring,
        cameraMonitoringEnabled,
        allowAnswerReview,
        retentionDays: Number(retentionDays) || 30,
        showResultsImmediately,
        status: examStatus,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success(t.exams.examSavedToast);
      setExamDialogOpen(false);
      setSelectedExamId(res.data.id);
      router.refresh();
    });
  }

  function applyQuestionTypeDefaults(
    type:
      | "single_choice"
      | "multiple_choice"
      | "true_false"
      | "short_answer"
      | "essay",
  ) {
    setQuestionType(type);
    if (type === "true_false") {
      setQuestionOptions([
        { optionText: "True", isCorrect: true },
        { optionText: "False", isCorrect: false },
      ]);
    } else if (type === "single_choice" || type === "multiple_choice") {
      setQuestionOptions([
        { optionText: "Option A", isCorrect: true },
        { optionText: "Option B", isCorrect: false },
        { optionText: "Option C", isCorrect: false },
        { optionText: "Option D", isCorrect: false },
      ]);
    } else {
      setQuestionOptions([]);
    }
  }

  function openNewQuestionModal() {
    if (!activeExam) {
      toast.error("Select or create a quiz first.");
      return;
    }
    setEditingQuestionId(undefined);
    applyQuestionTypeDefaults("single_choice");
    setQuestionDifficulty("medium");
    setQuestionPoints("5");
    setQuestionOrder(String(examQuestions.length + 1));
    setQuestionPrompt("");
    setQuestionExplanation("");
    setQuestionMediaUrl("");
    setQuestionInBank(true);
    setQuestionDialogOpen(true);
  }

  function openEditQuestionModal(q: DbTableRow<"questions">) {
    setEditingQuestionId(q.id);
    setQuestionType(q.question_type);
    setQuestionDifficulty(q.difficulty);
    setQuestionPoints(String(q.points));
    setQuestionOrder(String(q.position));
    setQuestionPrompt(q.prompt);
    setQuestionExplanation(q.explanation ?? "");
    setQuestionMediaUrl(q.media_url ?? "");
    setQuestionInBank(q.is_in_bank);

    const existingOpts = data.questionOptions
      .filter((o) => o.question_id === q.id)
      .map((o) => ({
        optionText: o.option_text,
        isCorrect: o.is_correct,
      }));

    setQuestionOptions(existingOpts);
    setQuestionDialogOpen(true);
  }

  async function handleDiagramUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeExam) return;
    if (
      !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(
        file.type,
      )
    ) {
      toast.error("Only JPG, PNG, WEBP, or AVIF diagram images are supported.");
      return;
    }

    setUploadingDiagram(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${activeExam.course_id}/exam_diagrams_${Date.now()}_${safeName}`;
      const { error } = await supabase.storage
        .from("course-thumbnails")
        .upload(storagePath, file, { upsert: true });

      if (error) {
        toast.error(error.message);
        return;
      }

      const { data: pub } = supabase.storage
        .from("course-thumbnails")
        .getPublicUrl(storagePath);

      setQuestionMediaUrl(pub.publicUrl);
      toast.success("Diagram uploaded.");
    } finally {
      setUploadingDiagram(false);
    }
  }

  function handleSaveQuestion() {
    if (!activeExam) return;
    startTransition(async () => {
      const res = await teacherSaveQuestionAction({
        id: editingQuestionId,
        examId: activeExam.id,
        courseId: activeExam.course_id,
        questionType,
        difficulty: questionDifficulty,
        prompt: questionPrompt,
        explanation: questionExplanation,
        points: Number(questionPoints),
        positionOrder: Number(questionOrder),
        mediaUrl: questionMediaUrl || null,
        isInBank: questionInBank,
        options:
          questionType === "essay" || questionType === "short_answer"
            ? []
            : questionOptions,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success(t.exams.questionSavedToast);
      setQuestionDialogOpen(false);
      router.refresh();
    });
  }

  function handleDeleteQuestion(questionId: string) {
    if (!activeExam) return;
    startTransition(async () => {
      const res = await teacherDeleteQuestionAction({
        questionId,
        courseId: activeExam.course_id,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t.exams.questionDeletedToast);
      router.refresh();
    });
  }

  function handleCloneBankQuestion(sourceQuestionId: string) {
    if (!activeExamId) {
      toast.error("Select a target quiz first.");
      return;
    }
    startTransition(async () => {
      const res = await teacherImportBankQuestionToExamAction({
        sourceQuestionId,
        targetExamId: activeExamId,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t.exams.importedFromBankToast);
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t.exams.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.exams.subtitle}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="gold"
            size="sm"
            onClick={() => setActiveTab("ai-generator")}
          >
            <Sparkles className="size-4" />
            <span>AI Quiz Generator</span>
          </Button>
          <Button variant="outline" size="sm" onClick={openNewExamModal}>
            <Plus className="size-4" />
            <span>{t.exams.createExam}</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeTab === "exams" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("exams")}
        >
          {t.exams.tabExams} ({data.exams.length})
        </Button>
        <Button
          variant={activeTab === "ai-generator" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("ai-generator")}
        >
          <Sparkles className="size-3.5" />
          <span>AI Quiz Generator</span>
        </Button>
        <Button
          variant={activeTab === "builder" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("builder")}
        >
          {t.exams.tabBuilder}
        </Button>
        <Button
          variant={activeTab === "roster" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("roster")}
        >
          <Users className="size-3.5" />
          <span>Student Attempts & Roster</span>
        </Button>
        <Button
          variant={activeTab === "bank" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("bank")}
        >
          {t.exams.tabQuestionBank}
        </Button>
      </div>

      {/* TAB 1: QUIZZES / EXAMINATIONS */}
      {activeTab === "exams" && (
        <div>
          {data.exams.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title={t.common.noRecordsTitle}
              description={t.common.noRecordsDescription}
              actions={
                <div className="flex gap-2">
                  <Button
                    variant="gold"
                    size="sm"
                    onClick={() => setActiveTab("ai-generator")}
                  >
                    <Sparkles className="size-4" />
                    <span>Generate Quiz with AI</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openNewExamModal}
                  >
                    <Plus className="size-4" />
                    <span>{t.exams.createExam}</span>
                  </Button>
                </div>
              }
            />
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {data.exams.map((exam) => {
                const course = data.courses.find(
                  (c) => c.id === exam.course_id,
                );
                const qCount = data.questions.filter(
                  (q) => q.exam_id === exam.id,
                ).length;
                const completedCount = new Set(
                  data.examAttemptsSummary
                    .filter((a) => a.examId === exam.id)
                    .map((a) => a.studentId),
                ).size;
                const enrolledCount = data.enrollments.filter(
                  (e) => e.courseId === exam.course_id,
                ).length;
                const isSelected = exam.id === activeExamId;

                return (
                  <Card
                    key={exam.id}
                    className={
                      isSelected
                        ? "border-emerald-500/60 shadow-md"
                        : "border-border/80"
                    }
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {course?.code ?? "COURSE"}
                        </Badge>
                        <Badge
                          variant={
                            exam.status === "published" ? "gold" : "outline"
                          }
                        >
                          {exam.status}
                        </Badge>
                      </div>
                      <CardTitle className="mt-2 text-base">
                        {exam.title}
                      </CardTitle>
                      <CardDescription className="line-clamp-2">
                        {exam.instructions || "Standard timed quiz."}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-2.5 text-xs text-muted-foreground">
                      <div className="grid grid-cols-4 gap-2 rounded-lg border border-border/70 bg-muted/40 p-2.5 text-center">
                        <div>
                          <p className="font-semibold text-foreground">
                            {qCount}
                          </p>
                          <p className="text-[11px]">Questions</p>
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">
                            {exam.duration_minutes}m
                          </p>
                          <p className="text-[11px]">Time</p>
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">
                            {Number(exam.total_points)}
                          </p>
                          <p className="text-[11px]">Marks</p>
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">
                            {completedCount}/{enrolledCount}
                          </p>
                          <p className="text-[11px]">Taken</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline">
                          Attempts: {exam.max_attempts}
                        </Badge>
                        {exam.available_until && (
                          <Badge variant="outline">
                            Due {exam.available_until.slice(0, 10)}
                          </Badge>
                        )}
                        {exam.shuffle_questions && (
                          <Badge variant="outline">
                            <Shuffle className="mr-1 size-3" />
                            Randomized
                          </Badge>
                        )}
                        {exam.strict_proctoring && (
                          <Badge variant="gold">
                            <ShieldCheck className="mr-1 size-3" />
                            Focus Log
                          </Badge>
                        )}
                      </div>
                    </CardContent>

                    <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                      <div className="flex gap-1.5">
                        <Button
                          variant={isSelected ? "gold" : "outline"}
                          size="sm"
                          onClick={() => {
                            setSelectedExamId(exam.id);
                            setActiveTab("builder");
                          }}
                        >
                          <Layers className="size-3.5" />
                          <span>Questions</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedExamId(exam.id);
                            setActiveTab("roster");
                          }}
                        >
                          <Users className="size-3.5" />
                          <span>Students</span>
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditExamModal(exam)}
                      >
                        <Edit3 className="size-3.5" />
                        <span>{t.common.edit}</span>
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AI QUIZ GENERATOR */}
      {activeTab === "ai-generator" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-4 text-emerald-500" />
                <span>AI Quiz Generator</span>
              </CardTitle>
              <CardDescription>
                Generate course-grounded quizzes with Gemini AI, edit or replace any question, preview, and save as Draft or Publish.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Course *</Label>
                  <select
                    className={cn(fieldBase, "h-9 w-full")}
                    value={genCourseId}
                    onChange={(e) => setGenCourseId(e.target.value)}
                  >
                    {data.courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Quiz Title *</Label>
                  <Input
                    value={genTitle}
                    onChange={(e) => setGenTitle(e.target.value)}
                    placeholder="Module 2 Mastery Quiz: Neural Architectures"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Number of Questions</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={genQuestionCount}
                    onChange={(e) => setGenQuestionCount(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Total Marks</Label>
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    value={genTotalMarks}
                    onChange={(e) => setGenTotalMarks(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Difficulty</Label>
                  <select
                    className={cn(fieldBase, "h-9 w-full")}
                    value={genDifficulty}
                    onChange={(e) =>
                      setGenDifficulty(
                        e.target.value as
                          | "balanced"
                          | "easy"
                          | "medium"
                          | "hard",
                      )
                    }
                  >
                    <option value="balanced">Balanced Mix</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label>Time Limit (Minutes)</Label>
                  <Input
                    type="number"
                    min={5}
                    max={360}
                    value={genDurationMinutes}
                    onChange={(e) => setGenDurationMinutes(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Deadline (Optional)</Label>
                  <Input
                    type="datetime-local"
                    value={genDeadline}
                    onChange={(e) => setGenDeadline(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Allowed Attempts</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={genMaxAttempts}
                    onChange={(e) => setGenMaxAttempts(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-4">
                  <Label>Question Types</Label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {(
                      [
                        ["single_choice", "Single Choice (MCQ)"],
                        ["multiple_choice", "Multiple Correct Answers"],
                        ["true_false", "True / False"],
                        ["short_answer", "Short Written Answer"],
                      ] as const
                    ).map(([typeKey, label]) => {
                      const active = genTypes.includes(typeKey);
                      return (
                        <Button
                          key={typeKey}
                          type="button"
                          size="sm"
                          variant={active ? "gold" : "outline"}
                          onClick={() => toggleGenType(typeKey)}
                        >
                          {label}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5 sm:col-span-4">
                  <Label>Topic / Instructions Focus (Optional)</Label>
                  <Textarea
                    rows={2}
                    value={genTopicFocus}
                    onChange={(e) => setGenTopicFocus(e.target.value)}
                    placeholder="Optional: specify chapters, concepts, or formulas to emphasize..."
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  variant="gold"
                  disabled={generatingAiQuiz}
                  onClick={() => void handleGenerateAiQuiz()}
                >
                  {generatingAiQuiz ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  <span>
                    {generatingAiQuiz
                      ? "Generating Quiz Questions..."
                      : "Generate Questions with AI"}
                  </span>
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={handleAddBlankDraftQuestion}
                >
                  <Plus className="size-4" />
                  <span>Add Manual Question</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {draftQuestions.length > 0 && (
            <Card className="border-emerald-500/40">
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base">
                    Editable Quiz Questions ({draftQuestions.length})
                  </CardTitle>
                  <CardDescription>
                    Total Marks:{" "}
                    {draftQuestions
                      .reduce((s, q) => s + Number(q.points || 0), 0)
                      .toFixed(1)}{" "}
                    • Review, edit, or replace any question before publishing.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewQuizOpen(true)}
                  >
                    <Eye className="size-3.5" />
                    <span>Preview Quiz</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleSaveGeneratedQuiz("draft")}
                  >
                    Save Draft
                  </Button>
                  <Button
                    variant="gold"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleSaveGeneratedQuiz("published")}
                  >
                    Publish Quiz
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 text-xs">
                {draftQuestions.map((dq, idx) => (
                  <div
                    key={idx}
                    className="space-y-3 rounded-xl border border-border/80 bg-background/80 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          Q{idx + 1}
                        </Badge>
                        <Badge variant="outline" className="uppercase">
                          {dq.questionType.replace("_", " ")}
                        </Badge>
                        <select
                          className={cn(fieldBase, "h-7 w-28 text-xs")}
                          value={dq.difficulty}
                          onChange={(e) => {
                            const nextDiff = e.target.value as
                              | "easy"
                              | "medium"
                              | "hard";
                            setDraftQuestions((prev) =>
                              prev.map((q, i) =>
                                i === idx ? { ...q, difficulty: nextDiff } : q,
                              ),
                            );
                          }}
                        >
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                        </select>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            className="h-7 w-20 text-xs"
                            value={dq.points}
                            onChange={(e) => {
                              const pts = Number(e.target.value) || 1;
                              setDraftQuestions((prev) =>
                                prev.map((q, i) =>
                                  i === idx ? { ...q, points: pts } : q,
                                ),
                              );
                            }}
                          />
                          <span className="text-muted-foreground">pts</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={replacingIndex === idx}
                          onClick={() =>
                            void handleReplaceDraftQuestionWithAi(idx)
                          }
                        >
                          {replacingIndex === idx ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="size-3.5 text-emerald-500" />
                          )}
                          <span>Replace with AI</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setDraftQuestions((prev) =>
                              prev.filter((_, i) => i !== idx),
                            )
                          }
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label>Question Prompt</Label>
                      <Textarea
                        rows={2}
                        value={dq.prompt}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDraftQuestions((prev) =>
                            prev.map((q, i) =>
                              i === idx ? { ...q, prompt: val } : q,
                            ),
                          );
                        }}
                      />
                    </div>

                    {dq.questionType !== "short_answer" &&
                      dq.questionType !== "essay" && (
                        <div className="space-y-2">
                          <Label>Answer Options (Check Correct)</Label>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {dq.options.map((opt, oIdx) => (
                              <div
                                key={oIdx}
                                className="flex items-center gap-2"
                              >
                                <Input
                                  value={opt.optionText}
                                  disabled={dq.questionType === "true_false"}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setDraftQuestions((prev) =>
                                      prev.map((q, i) =>
                                        i === idx
                                          ? {
                                              ...q,
                                              options: q.options.map((o, j) =>
                                                j === oIdx
                                                  ? { ...o, optionText: val }
                                                  : o,
                                              ),
                                            }
                                          : q,
                                      ),
                                    );
                                  }}
                                />
                                <label className="flex shrink-0 cursor-pointer items-center gap-1 rounded border border-border px-2 py-1.5">
                                  <input
                                    type="checkbox"
                                    checked={opt.isCorrect}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setDraftQuestions((prev) =>
                                        prev.map((q, i) => {
                                          if (i !== idx) return q;
                                          return {
                                            ...q,
                                            options: q.options.map((o, j) => {
                                              if (
                                                q.questionType ===
                                                  "single_choice" ||
                                                q.questionType === "true_false"
                                              ) {
                                                return {
                                                  ...o,
                                                  isCorrect:
                                                    j === oIdx
                                                      ? checked
                                                      : false,
                                                };
                                              }
                                              return j === oIdx
                                                ? { ...o, isCorrect: checked }
                                                : o;
                                            }),
                                          };
                                        }),
                                      );
                                    }}
                                  />
                                  <span>✓</span>
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    <div className="space-y-1">
                      <Label>Answer Key Explanation / Grading Guide</Label>
                      <Input
                        value={dq.explanation}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDraftQuestions((prev) =>
                            prev.map((q, i) =>
                              i === idx ? { ...q, explanation: val } : q,
                            ),
                          );
                        }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* TAB 3: QUESTION BUILDER FOR EXISTING QUIZ */}
      {activeTab === "builder" && (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">
                {t.exams.selectExamPrompt}
              </CardTitle>
              <CardDescription>
                Create or edit MCQ, Multiple-Correct, True/False, Short-Answer, and Essay items.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className={cn(fieldBase, "h-9 w-72")}
                value={activeExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
              >
                {data.exams.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title} ({e.duration_minutes}m)
                  </option>
                ))}
              </select>

              <Button
                variant="gold"
                size="sm"
                disabled={!activeExamId}
                onClick={openNewQuestionModal}
              >
                <Plus className="size-4" />
                <span>{t.exams.addQuestion}</span>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {examQuestions.length === 0 ? (
              <EmptyState
                icon={ClipboardCheck}
                title={t.common.noRecordsTitle}
                description="Add questions manually, generate via AI Quiz Generator, or clone items from your Question Bank."
              />
            ) : (
              examQuestions.map((q) => {
                const opts = data.questionOptions.filter(
                  (o) => o.question_id === q.id,
                );

                return (
                  <div
                    key={q.id}
                    className="rounded-xl border border-border/80 bg-card/60 p-4 text-xs"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="font-mono">
                            Q{q.position}
                          </Badge>
                          <Badge variant="outline" className="uppercase">
                            {q.question_type.replace("_", " ")}
                          </Badge>
                          <Badge
                            variant={
                              q.difficulty === "hard"
                                ? "destructive"
                                : q.difficulty === "medium"
                                  ? "gold"
                                  : "outline"
                            }
                            className="uppercase"
                          >
                            {q.difficulty}
                          </Badge>
                          <Badge variant="outline">
                            {Number(q.points)} Marks
                          </Badge>
                        </div>
                        <p className="mt-1.5 text-sm font-semibold text-foreground">
                          {q.prompt}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditQuestionModal(q)}
                        >
                          <Edit3 className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleDeleteQuestion(q.id)}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {q.media_url && (
                      <div className="mt-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={q.media_url}
                          alt="Question diagram"
                          className="max-h-48 rounded-lg border border-border object-contain"
                        />
                      </div>
                    )}

                    {opts.length > 0 && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {opts.map((opt) => (
                          <div
                            key={opt.id}
                            className={
                              opt.is_correct
                                ? "rounded-lg border border-emerald-500/60 bg-emerald-500/10 p-2 font-medium text-foreground"
                                : "rounded-lg border border-border/70 bg-background/60 p-2 text-muted-foreground"
                            }
                          >
                            {opt.option_text}{" "}
                            {opt.is_correct && (
                              <span className="ml-1 font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                                ✓ Correct
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 4: STUDENT QUIZ ROSTER (COMPLETED VS NOT ATTEMPTED + CHAT) */}
      {activeTab === "roster" && (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">
                Quiz Student Participation & Grades
              </CardTitle>
              <CardDescription>
                Track students who completed the quiz and students who have not attempted it yet.
              </CardDescription>
            </div>
            <select
              className={cn(fieldBase, "h-9 w-72")}
              value={activeExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
            >
              {data.exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </CardHeader>

          <CardContent className="space-y-6 text-xs">
            <div className="space-y-2">
              <h4 className="font-semibold tracking-wide text-foreground uppercase">
                Students Who Attempted / Completed (
                {examStudentRoster.completed.length})
              </h4>
              {examStudentRoster.completed.length === 0 ? (
                <p className="rounded-lg border border-border/70 p-4 text-muted-foreground">
                  No enrolled students have attempted this quiz yet.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Attempt Date</TableHead>
                      <TableHead className="text-right">Chat</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {examStudentRoster.completed.map((stu) => (
                      <TableRow key={stu.studentId}>
                        <TableCell>
                          <p className="font-semibold text-foreground">
                            {stu.fullName}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {stu.email}
                          </p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{stu.status}</Badge>
                        </TableCell>
                        <TableCell className="font-mono">
                          {stu.scorePercent !== null
                            ? `${stu.scorePercent.toFixed(1)}%`
                            : "Pending"}
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground">
                          {stu.submittedAt
                            ? stu.submittedAt.slice(0, 16).replace("T", " ")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="gold" size="sm">
                            <Link
                              href={`/messages?userId=${stu.studentId}${
                                activeExam
                                  ? `&courseId=${activeExam.course_id}`
                                  : ""
                              }`}
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Chat</span>
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <div className="space-y-2 border-t border-border/60 pt-4">
              <h4 className="font-semibold tracking-wide text-foreground uppercase">
                Students Who Did Not Attempt (
                {examStudentRoster.notAttempted.length})
              </h4>
              {examStudentRoster.notAttempted.length === 0 ? (
                <p className="text-muted-foreground">
                  All enrolled students in this course have attempted this quiz.
                </p>
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {examStudentRoster.notAttempted.map((stu) => (
                    <div
                      key={stu.studentId}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/20 p-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">
                          {stu.fullName}
                        </p>
                        <p className="truncate font-mono text-[11px] text-muted-foreground">
                          {stu.email}
                        </p>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link
                          href={`/messages?userId=${stu.studentId}${
                            activeExam
                              ? `&courseId=${activeExam.course_id}`
                              : ""
                          }`}
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

      {/* TAB 5: QUESTION BANK */}
      {activeTab === "bank" && (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">
                {t.exams.tabQuestionBank}
              </CardTitle>
              <CardDescription>
                Reusable pool of questions across your assigned courses. Clone any item into the active quiz.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <select
                className={cn(fieldBase, "h-9 w-40")}
                value={bankDifficultyFilter}
                onChange={(e) => setBankDifficultyFilter(e.target.value)}
              >
                <option value="all">{t.common.allFilter}</option>
                <option value="easy">{t.common.easy}</option>
                <option value="medium">{t.common.medium}</option>
                <option value="hard">{t.common.hard}</option>
              </select>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {bankQuestions.length === 0 ? (
              <EmptyState
                icon={Database}
                title={t.common.noRecordsTitle}
                description="Questions marked 'Include in Reusable Question Bank' appear here."
              />
            ) : (
              bankQuestions.map((q) => (
                <div
                  key={q.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/80 p-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="uppercase">
                        {q.question_type.replace("_", " ")}
                      </Badge>
                      <Badge variant="gold" className="uppercase">
                        {q.difficulty}
                      </Badge>
                      <Badge variant="outline">{Number(q.points)} pts</Badge>
                    </div>
                    <p className="font-semibold text-foreground">{q.prompt}</p>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending || !activeExamId}
                    onClick={() => handleCloneBankQuestion(q.id)}
                  >
                    <CopyPlus className="size-3.5" />
                    <span>{t.exams.importToSelectedExamButton}</span>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* QUIZ PREVIEW DIALOG */}
      <Dialog open={previewQuizOpen} onOpenChange={setPreviewQuizOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Quiz Preview: {genTitle || "Untitled Quiz"}
            </DialogTitle>
            <DialogDescription>
              Time Limit: {genDurationMinutes} min • Attempts: {genMaxAttempts}{" "}
              • Questions & Options Randomized per Student
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            {draftQuestions.map((q, i) => (
              <div
                key={i}
                className="space-y-2 rounded-xl border border-border/80 p-3.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">
                    Question {i + 1}
                  </span>
                  <Badge variant="outline">{q.points} pts</Badge>
                </div>
                <p className="text-foreground">{q.prompt}</p>
                {q.options.length > 0 ? (
                  <div className="space-y-1.5 pt-1">
                    {q.options.map((opt, j) => (
                      <div
                        key={j}
                        className="rounded-lg border border-border/70 px-3 py-2 text-muted-foreground"
                      >
                        {opt.optionText}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-3 text-muted-foreground">
                    [Student short-answer text input box]
                  </div>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPreviewQuizOpen(false)}
            >
              Close Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CREATE/EDIT EXAM DIALOG */}
      <Dialog open={examDialogOpen} onOpenChange={setExamDialogOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingExamId ? t.exams.editExam : t.exams.createExam}
            </DialogTitle>
            <DialogDescription>{t.exams.subtitle}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t.exams.examTitleLabel}</Label>
              <Input
                value={examTitle}
                onChange={(e) => setExamTitle(e.target.value)}
                placeholder="Midterm Quiz — Deep Learning Architectures"
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t.exams.courseLabel}</Label>
              <select
                className={cn(fieldBase, "h-9 w-full")}
                value={examCourseId}
                onChange={(e) => setExamCourseId(e.target.value)}
              >
                {data.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>{t.exams.classLabel}</Label>
              <select
                className={cn(fieldBase, "h-9 w-full")}
                value={examClassId}
                onChange={(e) => setExamClassId(e.target.value)}
              >
                <option value="none">— All Enrolled Students —</option>
                {data.classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.code} — {cls.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>{t.exams.durationMinutesLabel}</Label>
              <Input
                type="number"
                value={examDuration}
                onChange={(e) => setExamDuration(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t.exams.totalPointsLabel}</Label>
              <Input
                type="number"
                value={examTotalPoints}
                onChange={(e) => setExamTotalPoints(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t.exams.passingScoreLabel}</Label>
              <Input
                type="number"
                value={examPassingScore}
                onChange={(e) => setExamPassingScore(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t.exams.maxAttemptsLabel}</Label>
              <Input
                type="number"
                value={examMaxAttempts}
                onChange={(e) => setExamMaxAttempts(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t.exams.randomQuestionCountLabel}</Label>
              <Input
                type="number"
                value={examRandomCount}
                onChange={(e) => setExamRandomCount(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t.exams.statusLabel}</Label>
              <select
                className={cn(fieldBase, "h-9 w-full")}
                value={examStatus}
                onChange={(e) =>
                  setExamStatus(
                    e.target.value as
                      | "draft"
                      | "published"
                      | "closed"
                      | "archived",
                  )
                }
              >
                <option value="draft">{t.common.draft}</option>
                <option value="published">{t.common.published}</option>
                <option value="closed">Closed</option>
                <option value="archived">{t.common.archived}</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>{t.exams.availableFromLabel}</Label>
              <Input
                type="datetime-local"
                value={examAvailableFrom}
                onChange={(e) => setExamAvailableFrom(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t.exams.availableUntilLabel} (Deadline)</Label>
              <Input
                type="datetime-local"
                value={examAvailableUntil}
                onChange={(e) => setExamAvailableUntil(e.target.value)}
              />
            </div>

            {data.assignedStudents.length > 0 && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{t.exams.assignedStudentsLabel}</Label>
                <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-border p-2.5">
                  {data.assignedStudents.map((stu) => {
                    const selected = assignedStudentIds.includes(stu.id);
                    return (
                      <Button
                        key={stu.id}
                        type="button"
                        size="sm"
                        variant={selected ? "gold" : "outline"}
                        onClick={() => toggleAssignedStudent(stu.id)}
                      >
                        {stu.fullName}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Summary / Description</Label>
              <Input
                value={examDescription}
                onChange={(e) => setExamDescription(e.target.value)}
                placeholder="Comprehensive quiz covering modules 1–4"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t.exams.instructionsLabel}</Label>
              <Textarea
                rows={3}
                value={examInstructions}
                onChange={(e) => setExamInstructions(e.target.value)}
              />
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3 text-xs font-medium">
              <span>{t.exams.shuffleQuestionsLabel}</span>
              <input
                type="checkbox"
                checked={shuffleQuestions}
                onChange={(e) => setShuffleQuestions(e.target.checked)}
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3 text-xs font-medium">
              <span>{t.exams.shuffleOptionsLabel}</span>
              <input
                type="checkbox"
                checked={shuffleOptions}
                onChange={(e) => setShuffleOptions(e.target.checked)}
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3 text-xs font-medium">
              <span>Log Suspicious Focus & Tab Switching</span>
              <input
                type="checkbox"
                checked={strictProctoring}
                onChange={(e) => setStrictProctoring(e.target.checked)}
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3 text-xs font-medium">
              <span>{t.exams.showResultsImmediatelyLabel}</span>
              <input
                type="checkbox"
                checked={showResultsImmediately}
                onChange={(e) => setShowResultsImmediately(e.target.checked)}
              />
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setExamDialogOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button variant="gold" disabled={isPending} onClick={handleSaveExam}>
              {t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QUESTION AUTHORING DIALOG */}
      <Dialog open={questionDialogOpen} onOpenChange={setQuestionDialogOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t.exams.addQuestion}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>{t.exams.questionTypeLabel}</Label>
              <select
                className={cn(fieldBase, "h-9 w-full")}
                value={questionType}
                onChange={(e) =>
                  applyQuestionTypeDefaults(
                    e.target.value as
                      | "single_choice"
                      | "multiple_choice"
                      | "true_false"
                      | "short_answer"
                      | "essay",
                  )
                }
              >
                <option value="single_choice">
                  {t.exams.typeSingleChoice}
                </option>
                <option value="multiple_choice">
                  {t.exams.typeMultipleChoice}
                </option>
                <option value="true_false">{t.exams.typeTrueFalse}</option>
                <option value="short_answer">Short Answer</option>
                <option value="essay">{t.exams.typeEssay}</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>{t.exams.difficultyLabel}</Label>
              <select
                className={cn(fieldBase, "h-9 w-full")}
                value={questionDifficulty}
                onChange={(e) =>
                  setQuestionDifficulty(
                    e.target.value as "easy" | "medium" | "hard",
                  )
                }
              >
                <option value="easy">{t.common.easy}</option>
                <option value="medium">{t.common.medium}</option>
                <option value="hard">{t.common.hard}</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>{t.exams.pointsLabel}</Label>
              <Input
                type="number"
                value={questionPoints}
                onChange={(e) => setQuestionPoints(e.target.value)}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-3">
              <Label>{t.exams.promptLabel}</Label>
              <Textarea
                rows={3}
                value={questionPrompt}
                onChange={(e) => setQuestionPrompt(e.target.value)}
                placeholder="Write the question prompt clearly..."
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="flex items-center gap-1.5">
                <ImageIcon className="size-3.5 text-emerald-500" />
                <span>{t.exams.mediaUrlLabel}</span>
              </Label>
              <Input
                value={questionMediaUrl}
                onChange={(e) => setQuestionMediaUrl(e.target.value)}
                placeholder="https://... or upload below"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Upload className="size-3.5 text-emerald-500" />
                <span>{t.exams.uploadDiagramLabel}</span>
              </Label>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                disabled={uploadingDiagram}
                onChange={handleDiagramUpload}
              />
            </div>

            {questionType !== "essay" && questionType !== "short_answer" && (
              <div className="space-y-2.5 sm:col-span-3">
                <div className="flex items-center justify-between">
                  <Label>{t.exams.optionsHeading}</Label>
                  {questionType !== "true_false" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setQuestionOptions((prev) => [
                          ...prev,
                          { optionText: "", isCorrect: false },
                        ])
                      }
                    >
                      <Plus className="size-3.5" />
                      <span>{t.exams.addOptionButton}</span>
                    </Button>
                  )}
                </div>

                {questionOptions.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      value={opt.optionText}
                      disabled={questionType === "true_false"}
                      onChange={(e) => {
                        const val = e.target.value;
                        setQuestionOptions((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, optionText: val } : item,
                          ),
                        );
                      }}
                      placeholder={`Option ${idx + 1}`}
                    />
                    <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={opt.isCorrect}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setQuestionOptions((prev) =>
                            prev.map((item, i) => {
                              if (
                                questionType === "single_choice" ||
                                questionType === "true_false"
                              ) {
                                return {
                                  ...item,
                                  isCorrect: i === idx ? checked : false,
                                };
                              }
                              return i === idx
                                ? { ...item, isCorrect: checked }
                                : item;
                            }),
                          );
                        }}
                      />
                      <span>{t.exams.correctOptionLabel}</span>
                    </label>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-1.5 sm:col-span-3">
              <Label>{t.exams.explanationLabel}</Label>
              <Textarea
                rows={2}
                value={questionExplanation}
                onChange={(e) => setQuestionExplanation(e.target.value)}
              />
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3 text-xs font-medium sm:col-span-3">
              <span>{t.exams.saveToQuestionBankLabel}</span>
              <input
                type="checkbox"
                checked={questionInBank}
                onChange={(e) => setQuestionInBank(e.target.checked)}
              />
            </label>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setQuestionDialogOpen(false)}
            >
              {t.common.cancel}
            </Button>
            <Button
              variant="gold"
              disabled={isPending}
              onClick={handleSaveQuestion}
            >
              {t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
