"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  FileText,
  History,
  Lightbulb,
  Loader2,
  MessageSquarePlus,
  Mic,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";

import type { GeneratedDraftQuestion } from "@/app/api/ai/teacher/route";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  getOptionLetter,
  sanitizeQuizOptionText,
  sanitizeQuizQuestionPrompt,
} from "@/lib/quiz-format";
import { cn } from "@/lib/utils";
import { aiDeleteConversationAction } from "@/services/ai/actions"; // <-- تمت الإضافة
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

const DARK_GLASS_SHELL =
  "border-white/10 bg-[#0F1115]/75 text-foreground backdrop-blur-xl shadow-[0_10px_34px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)]";

const DARK_GLASS_CARD =
  "border-white/10 bg-[#0F1115]/60 backdrop-blur-md transition-all duration-200 hover:border-emerald-400/40 hover:bg-[#131822]/75";

const DARK_GLASS_COMPOSER =
  "rounded-2xl border border-white/15 bg-[#131720]/80 p-2.5 backdrop-blur-xl shadow-[0_8px_28px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.08)] transition-all duration-200 focus-within:border-emerald-400/50 focus-within:bg-[#151B26]/90 focus-within:shadow-[0_10px_32px_rgba(16,185,129,0.14),inset_0_1px_0_rgba(110,231,183,0.16)]";

const DARK_GLASS_PILL =
  "border-white/12 bg-[#0F1115]/65 text-foreground hover:border-emerald-400/40 hover:bg-[#18202C]/80";

function getEpochMs(): number {
  return Date.now();
}

const ANALYTICAL_QUICK_PROMPTS: Array<{
  label: string;
  mode: TeacherAiMode;
  prompt: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    label: "Individual Student Performance",
    mode: "performance_analyzer",
    prompt:
      "Summarize individual student performance across this course, highlighting top performers and struggling learners.",
    icon: User,
  },
  {
    label: "Low Grades & At-Risk Students",
    mode: "performance_analyzer",
    prompt:
      "Which enrolled students currently have low quiz or assignment grades and need immediate support?",
    icon: AlertCircle,
  },
  {
    label: "Missing Assignments",
    mode: "assignment_assistant",
    prompt:
      "Identify students with missing or unsubmitted assignments in this course and suggest an outreach plan.",
    icon: FileText,
  },
  {
    label: "Course & Quiz Averages",
    mode: "performance_analyzer",
    prompt:
      "Analyze course completion averages, quiz performance trends, and overall grade distribution.",
    icon: BarChart3,
  },
  {
    label: "Difficult Topics Detector",
    mode: "weakness_detector",
    prompt:
      "Which topics or questions are students struggling with most in quizzes and assignments, and how should I reteach them?",
    icon: Lightbulb,
  },
  {
    label: "Course Analytics & Action Plan",
    mode: "learning_recommendations",
    prompt:
      "Provide a data-backed course analytics summary and concrete teaching recommendations for next week.",
    icon: Sparkles,
  },
];

interface ChatTurn {
  id: string;
  sender: "user" | "assistant";
  content: string;
  voiceUrl?: string | null;
  voiceDurationSeconds?: number | null;
  citations?: AiCitation[];
  draftQuestions?: GeneratedDraftQuestion[];
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return tokens.map((token, idx) => {
    if (token.startsWith("**") && token.endsWith("**") && token.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    }
    if (token.startsWith("`") && token.endsWith("`") && token.length > 2) {
      return (
        <code
          key={idx}
          className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[12px] text-emerald-300"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    if (token.startsWith("*") && token.endsWith("*") && token.length > 2) {
      return (
        <em key={idx} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    }
    return token;
  });
}

function FormattedMarkdownContent({ content }: { content: string }) {
  const segments = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-3 text-sm leading-relaxed" dir="auto">
      {segments.map((segment, segIdx) => {
        if (segment.startsWith("```") && segment.endsWith("```")) {
          const rawCode = segment.slice(3, -3);
          const firstNewline = rawCode.indexOf("\n");
          const lang =
            firstNewline !== -1 ? rawCode.slice(0, firstNewline).trim() : "";
          const codeBody =
            firstNewline !== -1 ? rawCode.slice(firstNewline + 1) : rawCode;

          return (
            <div
              key={segIdx}
              dir="ltr"
              className="overflow-hidden rounded-xl border border-white/10 bg-[#0A0C10]/85"
            >
              {lang && (
                <div className="border-b border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] text-muted-foreground uppercase">
                  {lang}
                </div>
              )}
              <pre className="overflow-x-auto p-3.5 font-mono text-xs leading-relaxed text-foreground">
                <code>{codeBody.trim()}</code>
              </pre>
            </div>
          );
        }

        const lines = segment.split("\n");
        const blocks: React.ReactNode[] = [];
        let bulletItems: string[] = [];
        let numberedItems: string[] = [];

        const flushLists = (keyPrefix: string) => {
          if (bulletItems.length > 0) {
            blocks.push(
              <ul
                key={`${keyPrefix}-ul`}
                className="list-disc space-y-1.5 ps-5 text-sm text-foreground/95"
              >
                {bulletItems.map((item, i) => (
                  <li key={i}>{renderInlineMarkdown(item)}</li>
                ))}
              </ul>,
            );
            bulletItems = [];
          }
          if (numberedItems.length > 0) {
            blocks.push(
              <ol
                key={`${keyPrefix}-ol`}
                className="list-decimal space-y-1.5 ps-5 text-sm text-foreground/95"
              >
                {numberedItems.map((item, i) => (
                  <li key={i}>{renderInlineMarkdown(item)}</li>
                ))}
              </ol>,
            );
            numberedItems = [];
          }
        };

        lines.forEach((rawLine, lineIdx) => {
          const trimmed = rawLine.trim();
          if (!trimmed) {
            flushLists(`${segIdx}-${lineIdx}`);
            return;
          }

          if (trimmed.startsWith("### ")) {
            flushLists(`${segIdx}-${lineIdx}`);
            blocks.push(
              <h3
                key={`${segIdx}-${lineIdx}`}
                className="pt-1 text-base font-bold tracking-tight text-foreground"
              >
                {renderInlineMarkdown(trimmed.slice(4))}
              </h3>,
            );
            return;
          }

          if (trimmed.startsWith("## ")) {
            flushLists(`${segIdx}-${lineIdx}`);
            blocks.push(
              <h2
                key={`${segIdx}-${lineIdx}`}
                className="pt-1 text-lg font-bold tracking-tight text-foreground"
              >
                {renderInlineMarkdown(trimmed.slice(3))}
              </h2>,
            );
            return;
          }

          if (trimmed.startsWith("# ")) {
            flushLists(`${segIdx}-${lineIdx}`);
            blocks.push(
              <h1
                key={`${segIdx}-${lineIdx}`}
                className="pt-1 text-xl font-bold tracking-tight text-foreground"
              >
                {renderInlineMarkdown(trimmed.slice(2))}
              </h1>,
            );
            return;
          }

          const bulletMatch = trimmed.match(/^[-*•]\s+(.*)/);
          if (bulletMatch) {
            if (numberedItems.length > 0) flushLists(`${segIdx}-${lineIdx}`);
            bulletItems.push(bulletMatch[1] ?? "");
            return;
          }

          const numberedMatch = trimmed.match(/^\d+\.\s+(.*)/);
          if (numberedMatch) {
            if (bulletItems.length > 0) flushLists(`${segIdx}-${lineIdx}`);
            numberedItems.push(numberedMatch[1] ?? "");
            return;
          }

          flushLists(`${segIdx}-${lineIdx}`);
          blocks.push(
            <p key={`${segIdx}-${lineIdx}`} className="text-foreground/95">
              {renderInlineMarkdown(trimmed)}
            </p>,
          );
        });

        flushLists(`${segIdx}-end`);
        return (
          <div key={segIdx} className="space-y-2.5">
            {blocks}
          </div>
        );
      })}
    </div>
  );
}

export function TeacherAiAssistantClient({
  coursesData,
  gradingData,
  history,
}: TeacherAiAssistantClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    coursesData.courses[0]?.id ?? "",
  );
  const [selectedLessonId, setSelectedLessonId] = useState<string>("all");
  const [targetExamId, setTargetExamId] = useState<string>(
    gradingData.exams[0]?.id ?? "",
  );
  const [mode, setMode] = useState<TeacherAiMode>("performance_analyzer");
  const [questionCount, setQuestionCount] = useState("5");
  const [difficultyMix, setDifficultyMix] = useState<
    "balanced" | "foundational" | "advanced"
  >("balanced");

  const [promptInput, setPromptInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [approvedIndices, setApprovedIndices] = useState<number[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null); // <-- تمت الإضافة

  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [localTurns, setLocalTurns] = useState<ChatTurn[]>([]);

  // Voice recording state for Teacher AI Assistant
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [spokenTranscript, setSpokenTranscript] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const speechRecognitionRef = useRef<{ stop: () => void } | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStartMsRef = useRef<number>(0);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {
          // Ignore speech recognition stop errors on unmount
        }
      }
    };
  }, []);

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

  const selectedCourse = useMemo(
    () =>
      selectedCourseId
        ? (coursesData.courses.find((c) => c.id === selectedCourseId) ?? null)
        : null,
    [coursesData.courses, selectedCourseId],
  );

  function selectConversation(convId: string) {
    const conv = history.conversations.find((c) => c.id === convId);
    if (conv) {
      if (conv.course_id) setSelectedCourseId(conv.course_id);
      if (conv.mode) setMode(conv.mode as TeacherAiMode);
    }

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
      }));
    setLocalTurns(msgs);
    setHistoryOpen(false);
  }

  function startNewConversation() {
    setActiveConversationId(null);
    setLocalTurns([]);
    setErrorBanner(null);
    setHistoryOpen(false);
    setApprovedIndices([]);
  }

  // <-- تمت الإضافة: دالة الحذف
  async function handleDeleteConversation(
    e: React.MouseEvent,
    convId: string,
  ) {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this conversation?")) {
      return;
    }
    setDeletingId(convId);
    try {
      const res = await aiDeleteConversationAction(convId);
      if (!res.ok) {
        toast.error(res.error || "Failed to delete conversation.");
        return;
      }
      toast.success("Conversation deleted.");
      if (activeConversationId === convId) {
        startNewConversation();
      }
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

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

  async function startVoiceRecording() {
    if (!selectedCourseId) {
      toast.error("Select a course first.");
      return;
    }
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      toast.error("Voice recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMime =
        typeof MediaRecorder !== "undefined" &&
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : typeof MediaRecorder !== "undefined" &&
              MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : "";

      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];
      recordingStartMsRef.current = getEpochMs();
      setRecordingSeconds(0);
      setSpokenTranscript("");
      setIsRecordingVoice(true);

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          recordedChunksRef.current.push(ev.data);
        }
      };

      recorder.start(250);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds(
          Math.max(
            0,
            Math.floor((getEpochMs() - recordingStartMsRef.current) / 1000),
          ),
        );
      }, 500);

      // Optional browser SpeechRecognition live transcript preview
      const win = window as unknown as {
        SpeechRecognition?: new () => {
          continuous: boolean;
          interimResults: boolean;
          onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
          start: () => void;
          stop: () => void;
        };
        webkitSpeechRecognition?: new () => {
          continuous: boolean;
          interimResults: boolean;
          onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
          start: () => void;
          stop: () => void;
        };
      };
      const SpeechCtor = win.SpeechRecognition || win.webkitSpeechRecognition;
      if (SpeechCtor) {
        try {
          const rec = new SpeechCtor();
          rec.continuous = true;
          rec.interimResults = true;
          rec.onresult = (ev) => {
            const parts: string[] = [];
            for (let i = 0; i < ev.results.length; i++) {
              const item = ev.results[i]?.[0]?.transcript;
              if (item) parts.push(item);
            }
            setSpokenTranscript(parts.join(" ").trim());
          };
          rec.start();
          speechRecognitionRef.current = rec;
        } catch {
          // Continue with server-side Whisper audio transcription
        }
      }
    } catch {
      toast.error(
        "Microphone access denied. Allow microphone permissions to send voice messages.",
      );
    }
  }

  function cleanupVoiceRecording() {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        // Ignore
      }
      speechRecognitionRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
    setIsRecordingVoice(false);
    setRecordingSeconds(0);
  }

  function cancelVoiceRecording() {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    recordedChunksRef.current = [];
    setSpokenTranscript("");
    cleanupVoiceRecording();
  }

  async function finishAndSendVoicePrompt() {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    const elapsedSeconds = Math.max(
      1,
      Math.round((getEpochMs() - recordingStartMsRef.current) / 1000),
    );
    const capturedTranscript = spokenTranscript.trim();

    const audioBlob = await new Promise<Blob>((resolve) => {
      if (recorder.state === "inactive") {
        const mime = (recorder.mimeType || "audio/webm").split(";")[0] || "audio/webm";
        resolve(new Blob(recordedChunksRef.current, { type: mime }));
        return;
      }
      recorder.onstop = () => {
        const mime = (recorder.mimeType || "audio/webm").split(";")[0] || "audio/webm";
        resolve(new Blob(recordedChunksRef.current, { type: mime }));
      };
      recorder.stop();
    });

    cleanupVoiceRecording();
    setSpokenTranscript("");

    if (audioBlob.size < 200) {
      toast.error("Voice recording was too short.");
      return;
    }

    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = typeof reader.result === "string" ? reader.result : "";
        const commaIdx = res.indexOf(",");
        resolve(commaIdx >= 0 ? res.slice(commaIdx + 1) : res);
      };
      reader.onerror = () => reject(new Error("Failed to read audio."));
      reader.readAsDataURL(audioBlob);
    });

    const localAudioUrl = URL.createObjectURL(audioBlob);
    const baseMime = (audioBlob.type || "audio/webm").split(";")[0] || "audio/webm";
    const ext = baseMime.includes("ogg")
      ? "ogg"
      : baseMime.includes("mp4")
        ? "m4a"
        : "webm";

    const combinedText = [promptInput.trim(), capturedTranscript]
      .filter(Boolean)
      .join(" ")
      .trim();

    await handleGenerate({
      prompt:
        combinedText ||
        "Please listen to my voice message and respond to my teaching request.",
      voiceUrl: localAudioUrl,
      voiceDurationSeconds: elapsedSeconds,
      audioAttachment: {
        fileName: `teacher_voice_${getEpochMs()}.${ext}`,
        mimeType: baseMime,
        base64Data,
      },
    });
  }

  async function handleGenerate(override?: {
    mode?: TeacherAiMode;
    prompt?: string;
    voiceUrl?: string;
    voiceDurationSeconds?: number;
    audioAttachment?: {
      fileName: string;
      mimeType: string;
      base64Data: string;
    };
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
    if (override?.prompt && !override?.audioAttachment) {
      setPromptInput(override.prompt);
    }

    if (!prompt && !override?.prompt && !override?.audioAttachment) return;

    const optimisticUserContent = override?.audioAttachment
      ? override.prompt &&
        override.prompt !==
          "Please listen to my voice message and respond to my teaching request."
        ? `🎤 Voice message: "${override.prompt}"`
        : "🎤 Voice message"
      : prompt;
    const optimisticId = `user-${crypto.randomUUID()}`;
    setLocalTurns((prev) => [
      ...prev,
      {
        id: optimisticId,
        sender: "user",
        content: optimisticUserContent,
        voiceUrl: override?.voiceUrl ?? null,
        voiceDurationSeconds: override?.voiceDurationSeconds ?? null,
      },
    ]);

    setPromptInput("");
    setErrorBanner(null);
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
          audioAttachment: override?.audioAttachment ?? null,
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
        const msg = json.error ?? "AI generation failed.";
        setErrorBanner(msg);
        toast.error(msg);
        setLocalTurns((prev) => prev.filter((t) => t.id !== optimisticId));
        return;
      }

      if (json.data.conversationId) {
        setActiveConversationId(json.data.conversationId);
      }

      setLocalTurns((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: "assistant",
          content: json.data!.content,
          citations: json.data!.citations ?? [],
          draftQuestions: json.data!.draftQuestions ?? [],
        },
      ]);
      router.refresh();
    } catch {
      const msg = "Failed to reach Learnix AI Teacher backend.";
      setErrorBanner(msg);
      toast.error(msg);
      setLocalTurns((prev) => prev.filter((t) => t.id !== optimisticId));
    } finally {
      setLoading(false);
    }
  }

  function handleApproveAndImportQuestion(
    draft: GeneratedDraftQuestion,
    index: number,
    turnId: string,
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
    <div
      className={cn(
        "flex h-[calc(100dvh-7.5rem)] min-h-[560px] w-full flex-col overflow-hidden rounded-2xl border",
        DARK_GLASS_SHELL,
      )}
    >
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0F1115]/60 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-500/15 text-emerald-400 shadow-2xs">
            <Sparkles className="size-4" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-foreground sm:text-lg">
                AI Teacher Assistant
              </h1>
              <Badge
                variant="outline"
                className="hidden border-emerald-400/30 bg-emerald-500/10 text-[10px] text-emerald-300 sm:inline-flex"
              >
                Authorized Teacher Scope
              </Badge>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              Structured intelligence workbench for exam generation, PDF
              synthesis, and performance diagnostics.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="gold"
            size="sm"
            onClick={startNewConversation}
          >
            <MessageSquarePlus className="size-3.5" />
            <span>New Session</span>
          </Button>

          <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={DARK_GLASS_PILL}
              >
                <History className="size-3.5 text-emerald-400" />
                <span className="hidden sm:inline">History</span>
                {history.conversations.length > 0 && (
                  <Badge
                    variant="outline"
                    className="ms-0.5 border-white/15 bg-white/5 px-1.5 py-0 text-[10px]"
                  >
                    {history.conversations.length}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="flex w-80 flex-col border-white/10 bg-[#0F1115]/95 p-0 backdrop-blur-xl sm:max-w-sm"
            >
              <SheetHeader className="border-b border-white/10 px-5 py-4 text-start">
                <div className="flex items-center justify-between pe-6">
                  <SheetTitle className="flex items-center gap-2 text-base">
                    <History className="size-4 text-emerald-400" />
                    <span>Conversation History</span>
                  </SheetTitle>
                </div>
                <SheetDescription className="text-xs">
                  Resume previous AI teacher sessions or start a new one.
                </SheetDescription>
              </SheetHeader>

              <div className="border-b border-white/10 px-4 py-2.5">
                <Button
                  type="button"
                  variant="gold"
                  size="sm"
                  fullWidth
                  onClick={startNewConversation}
                >
                  <MessageSquarePlus className="size-3.5" />
                  <span>Start New Session</span>
                </Button>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {history.conversations.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    <History className="mx-auto mb-2 size-6 opacity-40" />
                    <p>No previous sessions yet.</p>
                  </div>
                ) : (
                  history.conversations.map((conv) => {
                    const isActive = activeConversationId === conv.id;
                    return (
                      <div // <-- تم التعديل: من button إلى div
                        key={conv.id}
                        onClick={() => selectConversation(conv.id)}
                        className={cn(
                          "group relative flex w-full cursor-pointer flex-col rounded-xl border p-3 text-start text-xs transition-colors",
                          isActive
                            ? "border-emerald-400/50 bg-emerald-500/15 font-medium text-foreground"
                            : "border-white/10 bg-[#0F1115]/60 text-muted-foreground hover:border-emerald-400/35 hover:bg-[#161B24]/80 hover:text-foreground",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className="truncate font-medium text-foreground pe-6"
                            dir="auto"
                          >
                            {conv.title}
                          </p>
                          {/* <-- تمت الإضافة: زر الحذف */}
                          <button
                            type="button"
                            disabled={deletingId === conv.id}
                            onClick={(e) => handleDeleteConversation(e, conv.id)}
                            className="absolute end-2 top-2 rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-destructive/15 hover:text-destructive group-hover:opacity-100 disabled:opacity-50"
                            title="Delete Conversation"
                          >
                            {deletingId === conv.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="size-3.5" />
                            )}
                          </button>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2 font-mono text-[10px] opacity-75">
                          <span className="truncate">{conv.mode}</span>
                          <span>{conv.updated_at.slice(0, 10)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col">
          {localTurns.length === 0 ? (
            <div className="my-auto flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-emerald-400/35 bg-emerald-500/15 text-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.16)]">
                <Sparkles className="size-7" aria-hidden="true" />
              </div>

              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                How can I assist your teaching today?
              </h2>
              <p className="mt-2 max-w-lg text-sm text-muted-foreground">
                Generate quizzes, analyze student performance, or detect
                difficult topics based on your course data.
              </p>

              <div className="mt-8 grid w-full max-w-3xl gap-3 sm:grid-cols-2">
                {ANALYTICAL_QUICK_PROMPTS.map((card, index) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={card.label}
                      type="button"
                      disabled={loading}
                      onClick={() =>
                        void handleGenerate({
                          mode: card.mode,
                          prompt: card.prompt,
                        })
                      }
                      className={cn(
                        "group flex items-start gap-3.5 rounded-xl border p-4 text-start disabled:pointer-events-none disabled:opacity-50",
                        DARK_GLASS_CARD,
                      )}
                    >
                      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-emerald-400/25 bg-emerald-500/15 text-emerald-400 transition-colors group-hover:bg-emerald-500/25">
                        <Icon className="size-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">
                          {card.label}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {card.prompt}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-6 pb-4">
              {localTurns.map((turn) => {
                const isUser = turn.sender === "user";
                return (
                  <div
                    key={turn.id}
                    className={cn(
                      "flex gap-3.5",
                      isUser ? "justify-end" : "justify-start",
                    )}
                  >
                    {!isUser && (
                      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl border border-emerald-400/35 bg-emerald-500/15 text-emerald-400">
                        <Sparkles className="size-4" aria-hidden="true" />
                      </div>
                    )}

                    <div
                      className={cn(
                        "max-w-[88%] rounded-2xl px-4 py-3.5 sm:max-w-[85%]",
                        isUser
                          ? "space-y-2.5 border border-emerald-400/25 bg-emerald-950/60 text-sm text-foreground shadow-2xs backdrop-blur-md"
                          : "w-full space-y-3 border border-white/10 bg-[#131720]/75 text-foreground shadow-2xs backdrop-blur-md",
                      )}
                    >
                      {isUser ? (
                        <div className="space-y-2">
                          <p
                            className="whitespace-pre-wrap text-sm leading-relaxed"
                            dir="auto"
                          >
                            {turn.content}
                          </p>
                          {turn.voiceUrl && (
                            <audio
                              controls
                              preload="metadata"
                              src={turn.voiceUrl}
                              className="h-9 w-full min-w-[200px] max-w-[280px]"
                            />
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <FormattedMarkdownContent content={turn.content} />

                          {turn.citations && turn.citations.length > 0 && (
                            <div className="space-y-1.5 border-t border-white/10 pt-2.5">
                              <p className="text-[11px] font-semibold text-emerald-400">
                                Cited Sources:
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {turn.citations.map((cit, idx) => (
                                  <Badge
                                    key={idx}
                                    variant="outline"
                                    className="border-white/15 bg-[#0F1115]/60 text-[10px]"
                                  >
                                    <FileText className="mr-1 size-2.5 text-emerald-400" />
                                    {cit.sourceTitle}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {turn.draftQuestions &&
                            turn.draftQuestions.length > 0 && (
                              <div className="space-y-3 border-t border-white/10 pt-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-sm font-semibold text-foreground">
                                    Review & Approve Questions (
                                    {turn.draftQuestions.length})
                                  </p>
                                  {courseExams.length > 0 && (
                                    <select
                                      className={cn(
                                        "h-8 rounded-lg border border-white/10 bg-[#0F1115] px-2 text-xs text-foreground",
                                      )}
                                      value={
                                        targetExamId || courseExams[0]?.id || ""
                                      }
                                      onChange={(e) =>
                                        setTargetExamId(e.target.value)
                                      }
                                    >
                                      {courseExams.map((ex) => (
                                        <option key={ex.id} value={ex.id}>
                                          Target Quiz: {ex.title}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </div>

                                <div className="space-y-3">
                                  {turn.draftQuestions.map((dq, idx) => {
                                    const imported =
                                      approvedIndices.includes(idx);
                                    return (
                                      <div
                                        key={idx}
                                        className="space-y-2 rounded-xl border border-white/10 bg-[#0F1115]/60 p-3"
                                      >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <div className="flex items-center gap-1.5">
                                            <Badge
                                              variant="outline"
                                              className="border-white/15 bg-white/5 uppercase"
                                            >
                                              {dq.questionType.replace(
                                                "_",
                                                " ",
                                              )}
                                            </Badge>
                                            <Badge
                                              variant="gold"
                                              className="uppercase"
                                            >
                                              {dq.difficulty}
                                            </Badge>
                                            <Badge
                                              variant="outline"
                                              className="border-white/15 bg-white/5"
                                            >
                                              {dq.points} pts
                                            </Badge>
                                          </div>

                                          {imported ? (
                                            <Badge
                                              variant="gold"
                                              className="gap-1"
                                            >
                                              <CheckCircle2 className="size-3" />
                                              Imported to Quiz
                                            </Badge>
                                          ) : (
                                            <Button
                                              variant="gold"
                                              size="sm"
                                              disabled={isPending}
                                              onClick={() =>
                                                handleApproveAndImportQuestion(
                                                  dq,
                                                  idx,
                                                  turn.id,
                                                )
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
                                          <ul className="space-y-1 pl-2 text-xs text-muted-foreground">
                                            {dq.options.map((opt, oIdx) => (
                                              <li
                                                key={oIdx}
                                                className={
                                                  opt.isCorrect
                                                    ? "font-semibold text-emerald-400"
                                                    : ""
                                                }
                                              >
                                                {getOptionLetter(oIdx)}.{" "}
                                                {sanitizeQuizOptionText(
                                                  opt.optionText,
                                                )}{" "}
                                                {opt.isCorrect
                                                  ? "(Correct)"
                                                  : ""}
                                              </li>
                                            ))}
                                          </ul>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                        </div>
                      )}
                    </div>

                    {isUser && (
                      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-[#131720]/80 text-muted-foreground">
                        <User className="size-4" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                );
              })}

              {loading && (
                <div className="flex items-start gap-3.5">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl border border-emerald-400/35 bg-emerald-500/15 text-emerald-400">
                    <Loader2 className="size-4 animate-spin" />
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[#131720]/75 px-4 py-3 text-xs text-muted-foreground backdrop-blur-md">
                    Analyzing course data & generating response...
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-white/10 bg-[#0F1115]/65 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto w-full max-w-4xl space-y-2.5">
          {errorBanner && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-destructive/50 bg-destructive/15 px-3.5 py-2 text-xs text-destructive">
              <div className="flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                <span>{errorBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorBanner(null)}
                className="rounded p-0.5 hover:bg-destructive/20"
                aria-label="Dismiss error"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {courseDocs.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">
                Course RAG Documents:
              </span>
              {courseDocs.slice(0, 4).map((doc) => (
                <Badge
                  key={doc.sourceTitle}
                  variant="outline"
                  className="max-w-48 truncate border-white/15 bg-[#0F1115]/60 text-[10px]"
                >
                  <FileText className="mr-1 size-2.5 shrink-0 text-emerald-400" />
                  <span className="truncate">{doc.sourceTitle}</span>
                </Badge>
              ))}
            </div>
          )}

          <div className={DARK_GLASS_COMPOSER}>
            {isRecordingVoice && (
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-xs">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="size-2.5 shrink-0 animate-pulse rounded-full bg-rose-500" />
                  <span className="font-semibold text-emerald-300">
                    Recording voice message •{" "}
                    {Math.floor(recordingSeconds / 60)}:
                    {String(recordingSeconds % 60).padStart(2, "0")}
                  </span>
                  {spokenTranscript && (
                    <span className="truncate text-muted-foreground">
                      — &ldquo;{spokenTranscript}&rdquo;
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={cancelVoiceRecording}
                    className="h-7 border-white/15 px-2.5 text-xs"
                  >
                    <Trash2 className="size-3.5 text-rose-400" />
                    <span>Cancel</span>
                  </Button>
                  <Button
                    type="button"
                    variant="gold"
                    size="sm"
                    onClick={() => void finishAndSendVoicePrompt()}
                    className="h-7 px-2.5 text-xs"
                  >
                    <Send className="size-3.5" />
                    <span>Send Voice</span>
                  </Button>
                </div>
              </div>
            )}

            <textarea
              rows={2}
              dir="auto"
              value={promptInput}
              disabled={loading || isRecordingVoice}
              onChange={(e) => setPromptInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleGenerate();
                }
              }}
              placeholder="Ask about student performance, missing work, difficult topics, generate quizzes, or send a voice message..."
              className="max-h-40 min-h-[48px] w-full resize-none bg-transparent px-2 py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground/80 disabled:cursor-not-allowed disabled:opacity-60"
            />

            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={loading}
                      className={cn(
                        "h-8 max-w-52 gap-1.5 rounded-xl px-2.5 text-xs sm:max-w-64",
                        DARK_GLASS_PILL,
                      )}
                    >
                      <BookOpen className="size-3.5 shrink-0 text-emerald-400" />
                      <span className="truncate">
                        {selectedCourse
                          ? selectedCourse.title
                          : "Select Course Context"}
                      </span>
                      <ChevronDown className="size-3 shrink-0 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="w-72 border-white/10 bg-[#0F1115]/95 backdrop-blur-xl"
                  >
                    <DropdownMenuLabel>Course Context</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup
                      value={selectedCourseId}
                      onValueChange={(val) => {
                        setSelectedCourseId(val);
                        setSelectedLessonId("all");
                      }}
                    >
                      {coursesData.courses.map((c) => (
                        <DropdownMenuRadioItem key={c.id} value={c.id}>
                          <span className="truncate">{c.title}</span>
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={loading}
                      className={cn(
                        "h-8 max-w-52 gap-1.5 rounded-xl px-2.5 text-xs sm:max-w-64",
                        DARK_GLASS_PILL,
                      )}
                    >
                      <Sparkles className="size-3.5 shrink-0 text-emerald-400" />
                      <span className="truncate">
                        {mode.replace(/_/g, " ")}
                      </span>
                      <ChevronDown className="size-3 shrink-0 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="w-64 border-white/10 bg-[#0F1115]/95 backdrop-blur-xl"
                  >
                    <DropdownMenuLabel>AI Mode</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup
                      value={mode}
                      onValueChange={(val) => setMode(val as TeacherAiMode)}
                    >
                      <DropdownMenuRadioItem value="performance_analyzer">
                        Performance Analyzer
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="weakness_detector">
                        Difficult Topics Detector
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="assignment_assistant">
                        Assignment Assistant
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="learning_recommendations">
                        Teaching Recommendations
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="exam_generator">
                        AI Quiz Generator
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="question_generator">
                        AI Question Generator
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="pdf_questions">
                        PDF Question Generator
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="lesson_questions">
                        Lesson Question Generator
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="teaching_plan">
                        Teaching Plan Assistant
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                {courseLessons.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={loading}
                        className={cn(
                          "h-8 max-w-44 gap-1.5 rounded-xl px-2.5 text-xs",
                          DARK_GLASS_PILL,
                        )}
                      >
                        <BookOpen className="size-3.5 shrink-0 text-emerald-400" />
                        <span className="truncate">
                          {selectedLessonId === "all"
                            ? "All Lessons"
                            : courseLessons.find(
                                (l) => l.id === selectedLessonId,
                              )?.title || "Select Lesson"}
                        </span>
                        <ChevronDown className="size-3 shrink-0 opacity-60" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-64 border-white/10 bg-[#0F1115]/95 backdrop-blur-xl"
                    >
                      <DropdownMenuLabel>Target Lesson</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuRadioGroup
                        value={selectedLessonId}
                        onValueChange={setSelectedLessonId}
                      >
                        <DropdownMenuRadioItem value="all">
                          All Course Lessons & PDFs
                        </DropdownMenuRadioItem>
                        {courseLessons.map((l) => (
                          <DropdownMenuRadioItem key={l.id} value={l.id}>
                            {l.position}. {l.title}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                <div className="relative">
                  <input
                    type="file"
                    accept=".pdf,.txt,.md"
                    disabled={uploadingPdf || loading}
                    onChange={handleUploadPdf}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    title="Upload Course PDF"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingPdf || loading}
                    className={cn(
                      "h-8 gap-1.5 rounded-xl px-2.5 text-xs",
                      DARK_GLASS_PILL,
                    )}
                  >
                    {uploadingPdf ? (
                      <Loader2 className="size-3.5 animate-spin text-emerald-400" />
                    ) : (
                      <Upload className="size-3.5 text-emerald-400" />
                    )}
                    <span className="hidden sm:inline">Upload PDF</span>
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loading || isRecordingVoice}
                  onClick={() => void startVoiceRecording()}
                  title="Send Voice Message to AI Assistant"
                  className={cn("h-8 rounded-xl px-2.5 text-xs", DARK_GLASS_PILL)}
                >
                  <Mic className="size-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Voice</span>
                </Button>

                <Button
                  type="button"
                  variant="gold"
                  size="sm"
                  disabled={loading || isRecordingVoice || !promptInput.trim()}
                  onClick={() => void handleGenerate()}
                  className="h-8 rounded-xl px-3.5"
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                  <span>Ask AI</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}