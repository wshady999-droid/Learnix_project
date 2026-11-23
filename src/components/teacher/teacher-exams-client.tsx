"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ClipboardCheck,
  CopyPlus,
  Database,
  Edit3,
  Image as ImageIcon,
  Layers,
  Plus,
  ShieldCheck,
  Shuffle,
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
import { getTeacherDictionary } from "@/i18n/teacher-dictionaries";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { TableRow as DbTableRow } from "@/services/db/utils";
import {
  teacherDeleteQuestionAction,
  teacherImportBankQuestionToExamAction,
  teacherSaveExamAction,
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

  const [activeTab, setActiveTab] = useState<"exams" | "builder" | "bank">(
    "exams",
  );
  const [selectedExamId, setSelectedExamId] = useState<string>(
    data.exams[0]?.id ?? "",
  );
  const [bankDifficultyFilter, setBankDifficultyFilter] =
    useState<string>("all");

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
    "single_choice" | "multiple_choice" | "true_false" | "short_answer" | "essay"
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

  function openNewExamModal() {
    if (data.courses.length === 0) {
      toast.error("Create a course first before creating an examination.");
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
      "Answer all questions carefully. Switching tabs or copying content is monitored when strict proctoring is active.",
    );
    setExamDuration("45");
    setExamTotalPoints("100");
    setExamPassingScore("60");
    setExamMaxAttempts("1");
    setExamRandomCount("0");
    setExamVersionCount("2");
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
      toast.error("Select or create an examination first.");
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
      toast.error("Select a target examination first.");
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
        <Button variant="gold" size="sm" onClick={openNewExamModal}>
          <Plus className="size-4" />
          <span>{t.exams.createExam}</span>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeTab === "exams" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("exams")}
        >
          {t.exams.tabExams}
        </Button>
        <Button
          variant={activeTab === "builder" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("builder")}
        >
          {t.exams.tabBuilder}
        </Button>
        <Button
          variant={activeTab === "bank" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("bank")}
        >
          {t.exams.tabQuestionBank}
        </Button>
      </div>

      {/* TAB 1: EXAMINATIONS */}
      {activeTab === "exams" && (
        <div>
          {data.exams.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title={t.common.noRecordsTitle}
              description={t.common.noRecordsDescription}
              actions={
                <Button variant="gold" size="sm" onClick={openNewExamModal}>
                  <Plus className="size-4" />
                  <span>{t.exams.createExam}</span>
                </Button>
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
                const isSelected = exam.id === activeExamId;

                return (
                  <Card
                    key={exam.id}
                    className={
                      isSelected
                        ? "border-gold-primary/60 shadow-md"
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
                        {exam.instructions || "Standard examination."}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-2.5 text-xs text-muted-foreground">
                      <div className="grid grid-cols-3 gap-2 rounded-lg border border-border/70 bg-muted/40 p-2.5 text-center">
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
                          <p className="text-[11px]">Duration</p>
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">
                            {Number(exam.total_points)}
                          </p>
                          <p className="text-[11px]">Marks</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline">
                          Versions: {exam.version_count}
                        </Badge>
                        <Badge variant="outline">
                          Attempts: {exam.max_attempts}
                        </Badge>
                        {exam.random_question_count && (
                          <Badge variant="outline">
                            <Shuffle className="mr-1 size-3" />
                            Draw {exam.random_question_count}
                          </Badge>
                        )}
                        {exam.strict_proctoring && (
                          <Badge variant="gold">
                            <ShieldCheck className="mr-1 size-3" />
                            Proctored
                          </Badge>
                        )}
                      </div>
                    </CardContent>

                    <CardFooter className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                      <Button
                        variant={isSelected ? "gold" : "outline"}
                        size="sm"
                        onClick={() => {
                          setSelectedExamId(exam.id);
                          setActiveTab("builder");
                        }}
                      >
                        <Layers className="size-3.5" />
                        <span>Manage Questions</span>
                      </Button>
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

      {/* TAB 2: QUESTION BUILDER */}
      {activeTab === "builder" && (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">
                {t.exams.selectExamPrompt}
              </CardTitle>
              <CardDescription>
                Create MCQ, True/False, and Essay items with Easy/Medium/Hard difficulty, diagrams, and marks.
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
                description="Add questions or clone items from your Question Bank."
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
                          {q.is_in_bank && (
                            <Badge variant="outline">In Bank</Badge>
                          )}
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

      {/* TAB 3: QUESTION BANK */}
      {activeTab === "bank" && (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">
                {t.exams.tabQuestionBank}
              </CardTitle>
              <CardDescription>
                Reusable pool of questions across your assigned courses. Clone any item into the active examination.
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
                placeholder="Midterm Assessment — Deep Learning Architectures"
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
                <option value="none">— All Course Cohorts —</option>
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
              <Label>{t.exams.versionCountLabel}</Label>
              <Input
                type="number"
                value={examVersionCount}
                onChange={(e) => setExamVersionCount(e.target.value)}
              />
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
              <Label>{t.exams.availableUntilLabel}</Label>
              <Input
                type="datetime-local"
                value={examAvailableUntil}
                onChange={(e) => setExamAvailableUntil(e.target.value)}
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
              <Label>Exam Summary / Description</Label>
              <Input
                value={examDescription}
                onChange={(e) => setExamDescription(e.target.value)}
                placeholder="Comprehensive assessment covering modules 1–4"
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

            <div className="space-y-1.5">
              <Label>Proctoring Metadata Retention (Days)</Label>
              <Input
                type="number"
                value={retentionDays}
                onChange={(e) => setRetentionDays(e.target.value)}
              />
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3 text-xs font-medium">
              <span>Camera Monitoring & Consent Gate</span>
              <input
                type="checkbox"
                checked={cameraMonitoringEnabled}
                onChange={(e) => setCameraMonitoringEnabled(e.target.checked)}
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3 text-xs font-medium">
              <span>Allow Post-Exam Answer Key Review</span>
              <input
                type="checkbox"
                checked={allowAnswerReview}
                onChange={(e) => setAllowAnswerReview(e.target.checked)}
              />
            </label>

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
              <span>{t.exams.strictProctoringLabel}</span>
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
                <ImageIcon className="size-3.5 text-gold-foreground" />
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
                <Upload className="size-3.5 text-gold-foreground" />
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
