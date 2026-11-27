"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  FileText,
  History,
  Loader2,
  Plus,
  Send,
  Sparkles,
  Upload,
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input, Textarea, fieldBase } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getTeacherDictionary } from "@/i18n/teacher-dictionaries";
import {
  getOptionLetter,
  sanitizeQuizOptionText,
  sanitizeQuizQuestionPrompt,
} from "@/lib/quiz-format";
import { cn } from "@/lib/utils";
import type { AiCitation } from "@/services/ai/engine";
import type { AiWorkspaceHistoryData } from "@/services/ai/queries";
import { teacherSaveQuestionAction } from "@/services/teacher/actions";
import type {
  TeacherCoursesData,
  TeacherGradingData,
} from "@/services/teacher/queries";

interface TeacherAiAssistantClientProps {
  coursesData: TeacherCoursesData;
  gradingData: Pick<TeacherGradingData, "exams">;
  history: AiWorkspaceHistoryData;
}

type TeacherAiMode =
  | "question_generator"
  | "pdf_questions"
  | "lesson_questions"
  | "exam_generator"
  | "teaching_plan"
  | "assignment_assistant"
  | "performance_analyzer"
  | "weakness_detector"
  | "learning_recommendations";

const ANALYTICAL_QUICK_PROMPTS: Array<{
  label: string;
  mode: TeacherAiMode;
  prompt: string;
}> = [
  {
    label: "Individual Student Performance",
    mode: "performance_analyzer",
    prompt:
      "Summarize individual student performance across this course, highlighting top performers and struggling learners.",
  },
  {
    label: "Low Grades & At-Risk Students",
    mode: "performance_analyzer",
    prompt:
      "Which enrolled students currently have low quiz or assignment grades and need immediate support?",
  },
  {
    label: "Missing Assignments",
    mode: "assignment_assistant",
    prompt:
      "Identify students with missing or unsubmitted assignments in this course and suggest an outreach plan.",
  },
  {
    label: "Course & Quiz Averages",
    mode: "performance_analyzer",
    prompt:
      "Analyze course completion averages, quiz performance trends, and overall grade distribution.",
  },
  {
    label: "Difficult Topics Detector",
    mode: "weakness_detector",
    prompt:
      "Which topics or questions are students struggling with most in quizzes and assignments, and how should I reteach them?",
  },
  {
    label: "Course Analytics & Action Plan",
    mode: "learning_recommendations",
    prompt:
      "Provide a data-backed course analytics summary and concrete teaching recommendations for next week.",
  },
];

export function TeacherAiAssistantClient({
  coursesData,
  gradingData,
  history,
}: TeacherAiAssistantClientProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const t = getTeacherDictionary(locale);
  const [isPending, startTransition] = useTransition();

  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    coursesData.courses[0]?.id ?? "",
  );
  const [selectedLessonId, setSelectedLessonId] = useState<string>("all");
  const [targetExamId, setTargetExamId] = useState<string>(
    gradingData.exams[0]?.id ?? "",
  );
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [mode, setMode] = useState<TeacherAiMode>("performance_analyzer");
  const [questionCount, setQuestionCount] = useState("5");
  const [difficultyMix, setDifficultyMix] = useState<
    "balanced" | "foundational" | "advanced"
  >("balanced");
  const [promptInput, setPromptInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [responseText, setResponseText] = useState<string | null>(null);
  const [citations, setCitations] = useState<AiCitation[]>([]);
  const [draftQuestions, setDraftQuestions] = useState<
    GeneratedDraftQuestion[]
  >([]);
  const [approvedIndices, setApprovedIndices] = useState<number[]>([]);

  const courseLessons = useMemo(
    () =>
      coursesData.lessons.filter((l) => l.course_id === selectedCourseId),
    [coursesData.lessons, selectedCourseId],
  );
  const courseExams = useMemo(
    () => gradingData.exams.filter((e) => e.course_id === selectedCourseId),
    [gradingData.exams, selectedCourseId],
  );
  const courseDocs = useMemo(
    () =>
      history.indexedDocuments.filter((d) => d.courseId === selectedCourseId),
    [history.indexedDocuments, selectedCourseId],
  );
  const conversationMessages = useMemo(
    () =>
      activeConversationId
        ? history.messages.filter(
            (m) => m.conversation_id === activeConversationId,
          )
        : [],
    [history.messages, activeConversationId],
  );

  async function handleUploadPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedCourseId) return;

    setUploadingPdf(true);
    try {
      const formData = new FormData();
      formData.append("courseId", selectedCourseId);
      formData.append("lessonId", selectedLessonId);
      formData.append("file", file);

      const res = await fetch("/api/ai/ingest", {
        method: "POST",
        body: formData,
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        data?: { fileName: string; chunksIndexed: number };
      };
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? "PDF upload failed.");
        return;
      }
      toast.success(
        `Indexed "${json.data?.fileName}" (${json.data?.chunksIndexed} chunks) for AI question & plan generation.`,
      );
      router.refresh();
    } finally {
      setUploadingPdf(false);
      e.target.value = "";
    }
  }

  async function handleGenerate(override?: {
    mode?: TeacherAiMode;
    prompt?: string;
  }) {
    if (!selectedCourseId) {
      toast.error("Create and select a course first.");
      return;
    }
    const effectiveMode = override?.mode ?? mode;
    const prompt =
      (override?.prompt ?? promptInput).trim() ||
      `Generate ${effectiveMode.replace(/_/g, " ")} grounded in the selected course materials`;

    if (override?.mode) setMode(override.mode);
    if (override?.prompt) setPromptInput(override.prompt);

    setLoading(true);
    setApprovedIndices([]);
    try {
      const res = await fetch("/api/ai/teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConversationId,
          courseId: selectedCourseId,
          lessonId: selectedLessonId === "all" ? null : selectedLessonId,
          mode: effectiveMode,
          prompt,
          questionCount: Number(questionCount) || 5,
          difficultyMix,
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        data?: {
          conversationId?: string | null;
          content: string;
          citations: AiCitation[];
          draftQuestions: GeneratedDraftQuestion[];
        };
      };

      if (!res.ok || !json.ok || !json.data) {
        toast.error(json.error ?? "AI generation failed.");
        return;
      }

      if (json.data.conversationId) {
        setActiveConversationId(json.data.conversationId);
      }
      setResponseText(json.data.content);
      setCitations(json.data.citations ?? []);
      setDraftQuestions(json.data.draftQuestions ?? []);
      router.refresh();
    } catch {
      toast.error("Failed to reach Learnix AI Teacher backend.");
    } finally {
      setLoading(false);
    }
  }

  function handleApproveAndImportQuestion(
    draft: GeneratedDraftQuestion,
    index: number,
  ) {
    const resolvedExamId = targetExamId || courseExams[0]?.id;
    if (!resolvedExamId) {
      toast.error(
        "Create a quiz for this course first before importing approved AI questions.",
      );
      return;
    }

    startTransition(async () => {
      const res = await teacherSaveQuestionAction({
        examId: resolvedExamId,
        courseId: selectedCourseId,
        questionType: draft.questionType,
        difficulty: draft.difficulty,
        prompt: draft.prompt.replace(/^\[Draft for Teacher Review\]\s*/i, ""),
        explanation: draft.explanation,
        points: draft.points,
        positionOrder: index + 1,
        isInBank: true,
        options: draft.options,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      setApprovedIndices((prev) => [...prev, index]);
      toast.success("Approved AI question imported into quiz & Question Bank.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t.aiAssistant.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.aiAssistant.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setActiveConversationId(null);
              setResponseText(null);
              setDraftQuestions([]);
              setPromptInput("");
            }}
          >
            <Plus className="size-3.5" />
            <span>New Session</span>
          </Button>
          <Badge variant="gold" className="gap-1.5 px-3 py-1">
            <Sparkles className="size-3.5" />
            <span>Authorized Teacher Scope</span>
          </Badge>
        </div>
      </div>

      {coursesData.courses.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title={t.common.noRecordsTitle}
          description="Create a course first to analyze student performance, missing assignments, difficult topics, and AI assessments."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Configuration Column */}
          <div className="space-y-4 lg:col-span-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  AI Teacher Context & Scope
                </CardTitle>
                <CardDescription className="text-xs">
                  Strictly scoped to your own courses and enrolled students.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="space-y-1">
                  <Label>{t.aiAssistant.selectCourseLabel}</Label>
                  <select
                    className={cn(fieldBase, "h-9 w-full")}
                    value={selectedCourseId}
                    onChange={(e) => {
                      setSelectedCourseId(e.target.value);
                      setSelectedLessonId("all");
                    }}
                  >
                    {coursesData.courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label>{t.aiAssistant.selectChapterLessonLabel}</Label>
                  <select
                    className={cn(fieldBase, "h-9 w-full")}
                    value={selectedLessonId}
                    onChange={(e) => setSelectedLessonId(e.target.value)}
                  >
                    <option value="all">All Course Lessons & PDFs</option>
                    {courseLessons.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.position}. {l.title} ({l.content_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label>AI Teacher Mode</Label>
                  <select
                    className={cn(fieldBase, "h-9 w-full")}
                    value={mode}
                    onChange={(e) => setMode(e.target.value as TeacherAiMode)}
                  >
                    <option value="performance_analyzer">
                      Student & Course Performance Analyzer
                    </option>
                    <option value="weakness_detector">
                      Difficult Topics & Weakness Detector
                    </option>
                    <option value="assignment_assistant">
                      Missing Assignments & Rubric Assistant
                    </option>
                    <option value="learning_recommendations">
                      Teaching & Intervention Recommendations
                    </option>
                    <option value="exam_generator">AI Quiz Generator</option>
                    <option value="question_generator">
                      AI Question Generator
                    </option>
                    <option value="pdf_questions">PDF Question Generator</option>
                    <option value="lesson_questions">
                      Lesson Question Generator
                    </option>
                    <option value="teaching_plan">
                      Teaching Plan Assistant
                    </option>
                  </select>
                </div>

                {(mode === "exam_generator" ||
                  mode === "question_generator" ||
                  mode === "pdf_questions" ||
                  mode === "lesson_questions") && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>{t.aiAssistant.questionCountLabel}</Label>
                      <Input
                        type="number"
                        value={questionCount}
                        onChange={(e) => setQuestionCount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Difficulty</Label>
                      <select
                        className={cn(fieldBase, "h-9 w-full")}
                        value={difficultyMix}
                        onChange={(e) =>
                          setDifficultyMix(
                            e.target.value as
                              | "balanced"
                              | "foundational"
                              | "advanced",
                          )
                        }
                      >
                        <option value="balanced">Balanced</option>
                        <option value="foundational">Foundational</option>
                        <option value="advanced">Advanced</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5 border-t border-border/70 pt-3">
                  <Label className="flex items-center gap-1.5">
                    <Upload className="size-3.5 text-emerald-500" />
                    <span>Upload Course PDF for AI Grounding</span>
                  </Label>
                  <Input
                    type="file"
                    accept=".pdf,.txt,.md"
                    disabled={uploadingPdf}
                    onChange={handleUploadPdf}
                  />
                  {courseDocs.length > 0 && (
                    <div className="space-y-1 pt-1">
                      {courseDocs.slice(0, 4).map((doc) => (
                        <div
                          key={doc.sourceTitle}
                          className="flex items-center justify-between rounded bg-muted/50 px-2 py-1 text-[11px]"
                        >
                          <span className="flex items-center gap-1 truncate">
                            <FileText className="size-3 text-emerald-500" />
                            {doc.sourceTitle}
                          </span>
                          <Badge variant="outline">
                            {doc.chunksCount} chunks
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Conversation History */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <History className="size-4 text-emerald-500" />
                  <span>Conversation History</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-xs">
                {history.conversations.length === 0 ? (
                  <p className="text-muted-foreground">
                    No previous AI teacher sessions yet.
                  </p>
                ) : (
                  history.conversations.slice(0, 8).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setActiveConversationId(c.id);
                        const msgs = history.messages.filter(
                          (m) => m.conversation_id === c.id,
                        );
                        const lastAi = [...msgs]
                          .reverse()
                          .find((m) => m.sender === "assistant");
                        if (lastAi) setResponseText(lastAi.content);
                      }}
                      className={cn(
                        "w-full rounded-lg border p-2 text-left transition-colors",
                        activeConversationId === c.id
                          ? "border-emerald-500/60 bg-emerald-500/10 text-foreground"
                          : "border-border/70 text-muted-foreground hover:border-emerald-500/30",
                      )}
                    >
                      <p className="truncate font-medium text-foreground">
                        {c.title}
                      </p>
                      <p className="font-mono text-[10px]">
                        {c.mode} • {c.updated_at.slice(0, 10)}
                      </p>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Output & Teacher Review Column */}
          <div className="space-y-4 lg:col-span-8">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Ask About Student Performance, Missing Work, or Course Content
                </CardTitle>
                <CardDescription className="text-xs">
                  Select a quick inquiry below or write a custom question about your students, grades, or lessons.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {ANALYTICAL_QUICK_PROMPTS.map((item) => (
                    <Button
                      key={item.label}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={loading}
                      onClick={() =>
                        void handleGenerate({
                          mode: item.mode,
                          prompt: item.prompt,
                        })
                      }
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>

                <Textarea
                  rows={3}
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  placeholder="Ask about a specific student's grades, missing assignments, course averages, quiz weaknesses, or generate practice questions..."
                />
                <Button
                  variant="gold"
                  disabled={loading}
                  onClick={() => void handleGenerate()}
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  <span>Ask Learnix Teacher AI</span>
                </Button>
              </CardContent>
            </Card>

            {conversationMessages.length > 0 && !responseText && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Session Messages</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5 text-xs">
                  {conversationMessages.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "rounded-lg border p-3 whitespace-pre-wrap",
                        m.sender === "user"
                          ? "border-emerald-500/30 bg-emerald-500/5"
                          : "border-border/70 bg-muted/30",
                      )}
                    >
                      <p className="mb-1 font-mono text-[10px] uppercase text-muted-foreground">
                        {m.sender}
                      </p>
                      <p className="text-foreground">{m.content}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {responseText && (
              <Card className="border-emerald-500/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    AI Teacher Analysis & Drafts
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div className="whitespace-pre-wrap rounded-lg border border-border/70 bg-muted/30 p-4 leading-relaxed text-foreground">
                    {responseText}
                  </div>

                  {citations.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        Sources:
                      </span>
                      {citations.map((c, i) => (
                        <Badge key={i} variant="outline" className="text-[10px]">
                          {c.sourceTitle}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {draftQuestions.length > 0 && (
                    <div className="space-y-3 border-t border-border/70 pt-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-foreground">
                          Review & Approve Generated Questions (
                          {draftQuestions.length})
                        </p>
                        {courseExams.length > 0 && (
                          <select
                            className={cn(fieldBase, "h-8 w-64 text-xs")}
                            value={targetExamId || courseExams[0]?.id || ""}
                            onChange={(e) => setTargetExamId(e.target.value)}
                          >
                            {courseExams.map((ex) => (
                              <option key={ex.id} value={ex.id}>
                                Target Quiz: {ex.title}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      {draftQuestions.map((dq, idx) => {
                        const imported = approvedIndices.includes(idx);
                        return (
                          <div
                            key={idx}
                            className="space-y-2 rounded-xl border border-border/80 bg-background p-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className="uppercase">
                                  {dq.questionType.replace("_", " ")}
                                </Badge>
                                <Badge variant="gold" className="uppercase">
                                  {dq.difficulty}
                                </Badge>
                                <Badge variant="outline">{dq.points} pts</Badge>
                              </div>

                              {imported ? (
                                <Badge variant="gold" className="gap-1">
                                  <CheckCircle2 className="size-3" />
                                  Imported to Quiz
                                </Badge>
                              ) : (
                                <Button
                                  variant="gold"
                                  size="sm"
                                  disabled={isPending}
                                  onClick={() =>
                                    handleApproveAndImportQuestion(dq, idx)
                                  }
                                >
                                  <Plus className="size-3.5" />
                                  <span>Approve & Import</span>
                                </Button>
                              )}
                            </div>

                            <p className="font-semibold text-foreground">
                              Question {idx + 1}:{" "}
                              {sanitizeQuizQuestionPrompt(dq.prompt)}
                            </p>
                            {dq.options.length > 0 && (
                              <ul className="space-y-1 pl-2 text-muted-foreground">
                                {dq.options.map((opt, oIdx) => (
                                  <li
                                    key={oIdx}
                                    className={
                                      opt.isCorrect
                                        ? "font-semibold text-emerald-600 dark:text-emerald-400"
                                        : ""
                                    }
                                  >
                                    {getOptionLetter(oIdx)}.{" "}
                                    {sanitizeQuizOptionText(opt.optionText)}{" "}
                                    {opt.isCorrect ? "(Correct)" : ""}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
