"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BookOpen,
  FileText,
  History,
  Loader2,
  Lock,
  MessageSquarePlus,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input, Textarea, fieldBase } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getStudentDictionary } from "@/i18n/student-dictionaries";
import { cn } from "@/lib/utils";
import { aiSubmitMessageFeedbackAction } from "@/services/ai/actions";
import type { AiCitation } from "@/services/ai/engine";
import type { AiWorkspaceHistoryData } from "@/services/ai/queries";
import type { StudentCoursesData } from "@/services/student/queries";

interface StudentAiAssistantClientProps {
  data: StudentCoursesData;
  history: AiWorkspaceHistoryData;
}

type StudentAiMode =
  | "chat"
  | "pdf_discussion"
  | "lesson_explanation"
  | "summary"
  | "flashcards"
  | "practice_quiz"
  | "difficult_topic"
  | "terminology_translation"
  | "study_plan";

interface ChatTurn {
  id: string;
  sender: "user" | "assistant";
  content: string;
  citations?: AiCitation[];
  feedbackRating?: number | null;
}

export function StudentAiAssistantClient({
  data,
  history,
}: StudentAiAssistantClientProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const t = getStudentDictionary(locale);
  const [isPending, startTransition] = useTransition();

  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    data.enrolledCourses[0]?.id ?? "",
  );
  const [selectedLessonId, setSelectedLessonId] = useState<string>("all");
  const [mode, setMode] = useState<StudentAiMode>("chat");
  const [targetLanguage, setTargetLanguage] = useState<
    "en" | "ar" | "de" | "it" | "fr"
  >(locale);
  const [promptInput, setPromptInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(history.conversations[0]?.id ?? null);

  const [localTurns, setLocalTurns] = useState<ChatTurn[]>(() => {
    const initialConvId = history.conversations[0]?.id;
    if (!initialConvId) return [];
    return history.messages
      .filter((m) => m.conversation_id === initialConvId)
      .map((m) => ({
        id: m.id,
        sender: m.sender === "user" ? "user" : "assistant",
        content: m.content,
        citations: Array.isArray(m.citations)
          ? (m.citations as unknown as AiCitation[])
          : [],
        feedbackRating: m.feedback_rating,
      }));
  });

  const courseLessons = useMemo(
    () => data.lessons.filter((l) => l.course_id === selectedCourseId),
    [data.lessons, selectedCourseId],
  );

  const courseDocs = useMemo(
    () =>
      history.indexedDocuments.filter((d) => d.courseId === selectedCourseId),
    [history.indexedDocuments, selectedCourseId],
  );

  function selectConversation(convId: string) {
    setActiveConversationId(convId);
    setErrorBanner(null);
    const msgs = history.messages
      .filter((m) => m.conversation_id === convId)
      .map((m) => ({
        id: m.id,
        sender: (m.sender === "user" ? "user" : "assistant") as
          | "user"
          | "assistant",
        content: m.content,
        citations: Array.isArray(m.citations)
          ? (m.citations as unknown as AiCitation[])
          : [],
        feedbackRating: m.feedback_rating,
      }));
    setLocalTurns(msgs);
  }

  function startNewConversation() {
    setActiveConversationId(null);
    setLocalTurns([]);
    setErrorBanner(null);
  }

  async function handleUploadPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedCourseId) return;

    setUploadingPdf(true);
    setErrorBanner(null);
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
        const msg = json.error ?? "Failed to index document.";
        setErrorBanner(msg);
        toast.error(msg);
        return;
      }

      toast.success(
        `Indexed "${json.data?.fileName}" (${json.data?.chunksIndexed} chunks) for grounded AI study.`,
      );
      router.refresh();
    } catch {
      toast.error("Network error while uploading PDF.");
    } finally {
      setUploadingPdf(false);
      e.target.value = "";
    }
  }

  async function handleSendPrompt() {
    if (!selectedCourseId) {
      toast.error("Enroll in and select a course first.");
      return;
    }
    if (!promptInput.trim()) return;

    const userText = promptInput.trim();
    setPromptInput("");
    setErrorBanner(null);
    setSending(true);

    const optimisticId = `user-${Date.now()}`;
    setLocalTurns((prev) => [
      ...prev,
      { id: optimisticId, sender: "user", content: userText },
    ]);

    try {
      const res = await fetch("/api/ai/student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConversationId,
          courseId: selectedCourseId,
          lessonId: selectedLessonId === "all" ? null : selectedLessonId,
          mode,
          prompt: userText,
          targetLanguage,
        }),
      });

      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        data?: {
          conversationId: string;
          messageId: string | null;
          content: string;
          citations: AiCitation[];
        };
      };

      if (!res.ok || !json.ok || !json.data) {
        const msg = json.error ?? "AI request failed.";
        setErrorBanner(msg);
        toast.error(msg);
        return;
      }

      if (json.data.conversationId) {
        setActiveConversationId(json.data.conversationId);
      }

      setLocalTurns((prev) => [
        ...prev,
        {
          id: json.data!.messageId ?? `ai-${Date.now()}`,
          sender: "assistant",
          content: json.data!.content,
          citations: json.data!.citations ?? [],
          feedbackRating: null,
        },
      ]);
      router.refresh();
    } catch {
      setErrorBanner("Unable to reach Learnix AI backend. Please try again.");
    } finally {
      setSending(false);
    }
  }

  function handleFeedback(messageId: string, rating: -1 | 1) {
    startTransition(async () => {
      const res = await aiSubmitMessageFeedbackAction({ messageId, rating });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setLocalTurns((prev) =>
        prev.map((turn) =>
          turn.id === messageId ? { ...turn, feedbackRating: rating } : turn,
        ),
      );
      toast.success("Thank you for rating this AI response.");
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
        <Badge variant="gold" className="gap-1.5 px-3 py-1">
          <Sparkles className="size-3.5" />
          <span>Grounded Course RAG • Active</span>
        </Badge>
      </div>

      {/* Active Official Exam Lock Banner */}
      {history.hasActiveOfficialExam && (
        <Card className="border-destructive/60 bg-destructive/10">
          <CardContent className="flex items-center gap-3 py-4 text-xs text-foreground">
            <Lock className="size-5 shrink-0 text-destructive" />
            <p>
              <strong>Official Exam Lock Active:</strong> You currently have an
              in-progress official examination. Learnix AI Study Assistant is
              restricted until you submit your exam.
            </p>
          </CardContent>
        </Card>
      )}

      {data.enrolledCourses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={t.common.noRecordsTitle}
          description="Enroll in a course first to unlock personalized course-grounded AI tutoring."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Sidebar: Course/Lesson Scope, PDF Upload & Conversation History */}
          <div className="space-y-4 lg:col-span-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  Course Context & PDF Knowledge
                </CardTitle>
                <CardDescription className="text-xs">
                  AI strictly answers from your enrolled course & uploaded PDFs.
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
                    {data.enrolledCourses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label>{t.aiAssistant.selectLessonLabel}</Label>
                  <select
                    className={cn(fieldBase, "h-9 w-full")}
                    value={selectedLessonId}
                    onChange={(e) => setSelectedLessonId(e.target.value)}
                  >
                    <option value="all">All Enrolled Course Lessons</option>
                    {courseLessons.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.position}. {l.title} ({l.content_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label>Study Mode</Label>
                  <select
                    className={cn(fieldBase, "h-9 w-full")}
                    value={mode}
                    onChange={(e) => setMode(e.target.value as StudentAiMode)}
                  >
                    <option value="chat">Course-Specific Q&A Chat</option>
                    <option value="pdf_discussion">PDF Analysis & Discussion</option>
                    <option value="lesson_explanation">Lesson Explanation</option>
                    <option value="summary">Lesson Summary</option>
                    <option value="flashcards">Flashcards Generator</option>
                    <option value="practice_quiz">Practice Quiz & Answer Explanations</option>
                    <option value="difficult_topic">Difficult Topic Simplifier</option>
                    <option value="terminology_translation">
                      Scientific Terminology Translator
                    </option>
                    <option value="study_plan">Personalized Study Plan</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label>{t.aiAssistant.targetLanguageLabel}</Label>
                  <select
                    className={cn(fieldBase, "h-9 w-full")}
                    value={targetLanguage}
                    onChange={(e) =>
                      setTargetLanguage(
                        e.target.value as "en" | "ar" | "de" | "it" | "fr",
                      )
                    }
                  >
                    <option value="en">English</option>
                    <option value="ar">العربية (Arabic)</option>
                    <option value="de">Deutsch (German)</option>
                    <option value="it">Italiano (Italian)</option>
                    <option value="fr">Français (French)</option>
                  </select>
                </div>

                <div className="space-y-1.5 border-t border-border/70 pt-3">
                  <Label className="flex items-center gap-1.5">
                    <Upload className="size-3.5 text-gold-foreground" />
                    <span>Upload Course PDF / Notes for AI Analysis</span>
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
                          className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1 text-[11px]"
                        >
                          <span className="flex items-center gap-1 truncate">
                            <FileText className="size-3 text-gold-foreground" />
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
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <History className="size-4 text-gold-foreground" />
                  <span>Conversation History</span>
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startNewConversation}
                >
                  <MessageSquarePlus className="size-3.5" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-1.5 text-xs">
                {history.conversations.length === 0 ? (
                  <p className="text-muted-foreground">
                    Your private study sessions appear here.
                  </p>
                ) : (
                  history.conversations.slice(0, 8).map((conv) => (
                    <button
                      key={conv.id}
                      type="button"
                      onClick={() => selectConversation(conv.id)}
                      className={
                        activeConversationId === conv.id
                          ? "w-full rounded-lg border border-gold-primary bg-gold-primary/10 p-2 text-left font-medium text-foreground"
                          : "w-full rounded-lg border border-border/70 p-2 text-left text-muted-foreground hover:bg-muted/50"
                      }
                    >
                      <p className="truncate">{conv.title}</p>
                      <p className="font-mono text-[10px] opacity-75">
                        {conv.mode} • {conv.updated_at.slice(0, 10)}
                      </p>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Main Pane: Live Grounded Chat Window */}
          <Card className="flex flex-col lg:col-span-8">
            <CardHeader className="border-b border-border/70 pb-3">
              <CardTitle className="text-base">
                Personalized AI Study Chat
              </CardTitle>
              <CardDescription className="text-xs">
                Every response cites authorized course materials and admits when
                a topic is not covered.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col justify-between gap-4 pt-4">
              <div className="max-h-[460px] min-h-[300px] space-y-4 overflow-y-auto pr-1">
                {localTurns.length === 0 ? (
                  <div className="flex h-64 flex-col items-center justify-center text-center text-xs text-muted-foreground">
                    <Sparkles className="mb-2 size-8 text-gold-foreground" />
                    <p className="font-medium text-foreground">
                      Ask a question about your enrolled course or uploaded PDF
                    </p>
                    <p className="mt-1 max-w-md">
                      Try requesting a lesson summary, flashcards, practice
                      quiz, scientific terminology translation, or weekly study
                      plan.
                    </p>
                  </div>
                ) : (
                  localTurns.map((turn) => (
                    <div
                      key={turn.id}
                      className={
                        turn.sender === "user"
                          ? "ml-auto max-w-[85%] rounded-2xl bg-charcoal p-3.5 text-xs text-white"
                          : "mr-auto max-w-[92%] space-y-2.5 rounded-2xl border border-border/80 bg-muted/40 p-4 text-xs text-foreground"
                      }
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {turn.content}
                      </p>

                      {turn.sender === "assistant" &&
                        turn.citations &&
                        turn.citations.length > 0 && (
                          <div className="space-y-1 border-t border-border/60 pt-2">
                            <p className="font-semibold text-[11px] text-gold-foreground">
                              Cited Course Sources:
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {turn.citations.map((cit, idx) => (
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className="text-[10px]"
                                >
                                  {cit.sourceTitle}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                      {turn.sender === "assistant" &&
                        !turn.id.startsWith("ai-") && (
                          <div className="flex items-center justify-end gap-1.5 pt-1">
                            <Button
                              variant={
                                turn.feedbackRating === 1 ? "gold" : "ghost"
                              }
                              size="sm"
                              disabled={isPending}
                              onClick={() => handleFeedback(turn.id, 1)}
                            >
                              <ThumbsUp className="size-3" />
                            </Button>
                            <Button
                              variant={
                                turn.feedbackRating === -1
                                  ? "destructive"
                                  : "ghost"
                              }
                              size="sm"
                              disabled={isPending}
                              onClick={() => handleFeedback(turn.id, -1)}
                            >
                              <ThumbsDown className="size-3" />
                            </Button>
                          </div>
                        )}
                    </div>
                  ))
                )}

                {sending && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="size-4 animate-spin text-gold-foreground" />
                    <span>Retrieving course sources & synthesizing answer...</span>
                  </div>
                )}
              </div>

              {errorBanner && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
                  {errorBanner}
                </div>
              )}

              <div className="flex flex-col gap-2 border-t border-border/70 pt-3 sm:flex-row">
                <Textarea
                  rows={2}
                  value={promptInput}
                  disabled={sending || history.hasActiveOfficialExam}
                  onChange={(e) => setPromptInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSendPrompt();
                    }
                  }}
                  placeholder="Ask about a lesson, request flashcards, translate a scientific term, or build a study plan..."
                  className="flex-1"
                />
                <Button
                  variant="gold"
                  disabled={
                    sending ||
                    !promptInput.trim() ||
                    history.hasActiveOfficialExam
                  }
                  onClick={() => void handleSendPrompt()}
                >
                  {sending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  <span>Send</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
