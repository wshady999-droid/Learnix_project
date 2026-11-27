"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  CalendarCheck2,
  ChevronDown,
  FileAudio,
  FileSpreadsheet,
  FileText,
  History,
  Image as ImageIcon,
  Layers,
  Lightbulb,
  Loader2,
  Lock,
  MessageSquare,
  MessageSquarePlus,
  Mic,
  Paperclip,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  User,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

type RecordingState = "idle" | "recording" | "sending" | "processing" | "error";

interface StagedAttachment {
  id: string;
  file: File;
  fileName: string;
  mimeType: string;
  kind: "document" | "image" | "audio";
  sizeBytes: number;
  previewUrl?: string;
}

interface MessageAttachmentDisplay {
  fileName: string;
  mimeType: string;
  kind: "document" | "image" | "audio";
  sizeBytes: number;
  previewUrl?: string;
  isVoiceRecording?: boolean;
}

interface ChatTurn {
  id: string;
  sender: "user" | "assistant";
  content: string;
  citations?: AiCitation[];
  feedbackRating?: number | null;
  attachments?: MessageAttachmentDisplay[];
}

interface BrowserSpeechRecognitionEvent {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      0: { transcript: string };
    };
  };
}

interface BrowserSpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: unknown) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

const DARK_GLASS_SHELL =
  "border-white/10 bg-[#0F1115]/75 text-foreground backdrop-blur-xl shadow-[0_10px_34px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)]";

const DARK_GLASS_CARD =
  "border-white/10 bg-[#0F1115]/60 backdrop-blur-md transition-all duration-200 hover:border-emerald-400/40 hover:bg-[#131822]/75";

const DARK_GLASS_COMPOSER =
  "rounded-2xl border border-white/15 bg-[#131720]/80 p-2.5 backdrop-blur-xl shadow-[0_8px_28px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.08)] transition-all duration-200 focus-within:border-emerald-400/50 focus-within:bg-[#151B26]/90 focus-within:shadow-[0_10px_32px_rgba(16,185,129,0.14),inset_0_1px_0_rgba(110,231,183,0.16)]";

const DARK_GLASS_PILL =
  "border-white/12 bg-[#0F1115]/65 text-foreground hover:border-emerald-400/40 hover:bg-[#18202C]/80";

const SUGGESTION_CARDS: ReadonlyArray<{
  title: string;
  description: string;
  mode: StudentAiMode;
  prompt: string;
  icon: typeof Lightbulb;
}> = [
  {
    title: "Explain a difficult concept",
    description: "Break down complex topics step by step with clear examples",
    mode: "difficult_topic",
    prompt:
      "Can you explain a difficult concept in simple, clear terms with practical examples?",
    icon: Lightbulb,
  },
  {
    title: "Summarize a study material",
    description: "Extract key takeaways and structured study notes",
    mode: "summary",
    prompt:
      "Summarize the most important points, definitions, and takeaways from my study materials.",
    icon: FileText,
  },
  {
    title: "Create flashcards",
    description: "Generate active-recall Q&A cards to reinforce key concepts",
    mode: "flashcards",
    prompt:
      "Create a set of study flashcards with clear questions and answers to help me review.",
    icon: Layers,
  },
  {
    title: "Generate a study plan",
    description: "Build a structured study schedule for upcoming exams",
    mode: "study_plan",
    prompt:
      "Create a personalized study plan and schedule to help me prepare for my upcoming exams.",
    icon: CalendarCheck2,
  },
  {
    title: "Analyze my academic performance",
    description: "Review my real course progress, study hours, and exam grades",
    mode: "chat",
    prompt:
      "Analyze my academic performance and generate a personal study report based on my enrolled courses, study progress, and exam scores.",
    icon: BarChart3,
  },
];

function formatDurationClock(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
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

export function StudentAiAssistantClient({
  data,
  history,
}: StudentAiAssistantClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [mode, setMode] = useState<StudentAiMode>("chat");
  const [promptInput, setPromptInput] = useState("");
  const [stagedAttachments, setStagedAttachments] = useState<
    StagedAttachment[]
  >([]);
  const [sending, setSending] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [waveformLevels, setWaveformLevels] = useState<number[]>(
    () => Array.from({ length: 28 }, () => 14),
  );
  const [liveSpeechPreview, setLiveSpeechPreview] = useState("");

  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [localTurns, setLocalTurns] = useState<ChatTurn[]>([]);

  const docInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speechRecognitionRef = useRef<BrowserSpeechRecognitionInstance | null>(
    null,
  );
  const speechTranscriptRef = useRef<string>("");
  const isRecordingSessionActiveRef = useRef(false);

  const selectedCourse = useMemo(
    () =>
      selectedCourseId
        ? (data.enrolledCourses.find((c) => c.id === selectedCourseId) ?? null)
        : null,
    [data.enrolledCourses, selectedCourseId],
  );

  const courseDocs = useMemo(
    () =>
      selectedCourseId
        ? history.indexedDocuments.filter(
            (d) => d.courseId === selectedCourseId,
          )
        : [],
    [history.indexedDocuments, selectedCourseId],
  );

  useEffect(() => {
    if (localTurns.length > 0 || sending) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [localTurns.length, sending]);

  const releaseMicrophoneResources = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        // Ignore
      }
      speechRecognitionRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        void audioContextRef.current.close();
      } catch {
        // Ignore
      }
      audioContextRef.current = null;
      analyserRef.current = null;
    }
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        track.stop();
      }
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
    isRecordingSessionActiveRef.current = false;
  }, []);

  useEffect(() => {
    return () => {
      releaseMicrophoneResources();
    };
  }, [releaseMicrophoneResources]);

  function parseSavedAttachments(
    payload: unknown,
  ): MessageAttachmentDisplay[] | undefined {
    if (!payload || typeof payload !== "object") return undefined;
    const record = payload as Record<string, unknown>;
    const list = record.attachments;
    if (!Array.isArray(list)) return undefined;
    return list
      .filter((item): item is Record<string, unknown> =>
        Boolean(item && typeof item === "object"),
      )
      .map((item) => ({
        fileName: String(item.fileName ?? "Attachment"),
        mimeType: String(item.mimeType ?? "application/octet-stream"),
        kind:
          item.kind === "image" || item.kind === "audio"
            ? item.kind
            : "document",
        sizeBytes: Number(item.sizeBytes ?? 0),
        isVoiceRecording: Boolean(item.isVoiceRecording),
      }));
  }

  function selectConversation(convId: string) {
    const conv = history.conversations.find((c) => c.id === convId);
    setSelectedCourseId(conv?.course_id ?? "");
    if (conv?.mode) {
      setMode(conv.mode as StudentAiMode);
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
        feedbackRating: m.feedback_rating,
        attachments: parseSavedAttachments(m.structured_payload),
      }));
    setLocalTurns(msgs);
    setHistoryOpen(false);
  }

  function startNewConversation() {
    if (recordingState === "recording") {
      handleCancelRecording();
    }
    setActiveConversationId(null);
    setLocalTurns([]);
    setErrorBanner(null);
    setHistoryOpen(false);
    textareaRef.current?.focus();
  }

  function stageSelectedFiles(
    files: FileList | null,
    expectedKind: "document" | "image" | "audio",
  ) {
    if (!files || files.length === 0) return;
    setErrorBanner(null);

    const nextAttachments: StagedAttachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;

      if (file.size <= 0) {
        toast.error(`File "${file.name}" is empty.`);
        continue;
      }
      if (file.size > 15 * 1024 * 1024) {
        toast.error(`File "${file.name}" exceeds the 15 MB maximum limit.`);
        continue;
      }

      let previewUrl: string | undefined;
      if (expectedKind === "image" || expectedKind === "audio") {
        previewUrl = URL.createObjectURL(file);
      }

      nextAttachments.push({
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        kind: expectedKind,
        sizeBytes: file.size,
        previewUrl,
      });
    }

    setStagedAttachments((prev) => {
      const combined = [...prev, ...nextAttachments];
      if (combined.length > 5) {
        toast.warning("Maximum 5 attachments per message.");
        return combined.slice(0, 5);
      }
      return combined;
    });
  }

  function removeStagedAttachment(id: string) {
    setStagedAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((a) => a.id !== id);
    });
  }

  async function handleStartRecording() {
    if (
      isRecordingSessionActiveRef.current ||
      recordingState === "recording" ||
      recordingState === "sending" ||
      recordingState === "processing" ||
      sending
    ) {
      return;
    }

    setErrorBanner(null);
    speechTranscriptRef.current = "";
    setLiveSpeechPreview("");

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setRecordingState("error");
      const msg =
        "Live voice recording is not supported in this browser environment.";
      setErrorBanner(msg);
      toast.error(msg);
      return;
    }

    try {
      isRecordingSessionActiveRef.current = true;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      const candidateMimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ];
      const chosenMimeType =
        candidateMimeTypes.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";

      const recorder = chosenMimeType
        ? new MediaRecorder(stream, { mimeType: chosenMimeType })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(150);

      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          analyser.smoothingTimeConstant = 0.75;
          source.connect(analyser);
          analyserRef.current = analyser;

          const freqData = new Uint8Array(analyser.frequencyBinCount);
          const updateWaveform = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(freqData);
            const barCount = 28;
            const nextBars: number[] = [];
            for (let i = 0; i < barCount; i++) {
              const binIndex = Math.min(
                freqData.length - 1,
                Math.floor((i / barCount) * (freqData.length * 0.75)),
              );
              const val = freqData[binIndex] ?? 0;
              const pct = Math.max(12, Math.min(100, Math.round((val / 255) * 100)));
              nextBars.push(pct);
            }
            setWaveformLevels(nextBars);
            animationFrameRef.current = requestAnimationFrame(updateWaveform);
          };
          animationFrameRef.current = requestAnimationFrame(updateWaveform);
        }
      } catch {
        // Fallback
      }

      try {
        const SpeechRecConstructor =
          (window as unknown as Record<string, unknown>).SpeechRecognition ||
          (window as unknown as Record<string, unknown>)
            .webkitSpeechRecognition;
        if (typeof SpeechRecConstructor === "function") {
          const recognition = new (SpeechRecConstructor as new () => BrowserSpeechRecognitionInstance)();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
            let combined = "";
            for (let i = 0; i < event.results.length; i++) {
              const res = event.results[i];
              if (res?.[0]?.transcript) {
                combined += `${res[0].transcript} `;
              }
            }
            const cleaned = combined.trim();
            if (cleaned) {
              speechTranscriptRef.current = cleaned;
              setLiveSpeechPreview(cleaned);
            }
          };
          recognition.onerror = () => {};
          recognition.start();
          speechRecognitionRef.current = recognition;
        }
      } catch {}

      setRecordingSeconds(0);
      setRecordingState("recording");
      durationTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      releaseMicrophoneResources();
      setRecordingState("error");
      const msg =
        err instanceof Error && err.name === "NotAllowedError"
          ? "Microphone access was denied. Please allow microphone permission in your browser settings."
          : "Could not access microphone. Please check your audio device.";
      setErrorBanner(msg);
      toast.error(msg);
    }
  }

  function handleCancelRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch {}
    }
    audioChunksRef.current = [];
    speechTranscriptRef.current = "";
    setLiveSpeechPreview("");
    releaseMicrophoneResources();
    setRecordingSeconds(0);
    setRecordingState("idle");
  }

  async function handleSendWhileRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recordingState !== "recording" || sending) {
      return;
    }

    setRecordingState("sending");

    try {
      const mimeType = recorder.mimeType || "audio/webm";

      const finalizedBlob = await new Promise<Blob>((resolve, reject) => {
        const handleStop = () => {
          const blob = new Blob(audioChunksRef.current, { type: mimeType });
          resolve(blob);
        };

        recorder.addEventListener("stop", handleStop, { once: true });
        recorder.addEventListener(
          "error",
          () => reject(new Error("Recording finalization error.")),
          { once: true },
        );

        try {
          if (recorder.state === "recording") {
            recorder.requestData();
            recorder.stop();
          } else {
            handleStop();
          }
        } catch (e) {
          reject(e);
        }
      });

      const capturedTranscript = speechTranscriptRef.current.trim();
      audioChunksRef.current = [];
      speechTranscriptRef.current = "";
      setLiveSpeechPreview("");
      releaseMicrophoneResources();

      if (finalizedBlob.size <= 0) {
        setRecordingState("error");
        setErrorBanner("No audio was captured. Please try recording again.");
        return;
      }

      const ext = mimeType.includes("mp4")
        ? "m4a"
        : mimeType.includes("ogg")
          ? "ogg"
          : "webm";
      const fileName = `voice-message-${Date.now()}.${ext}`;
      const audioFile = new File([finalizedBlob], fileName, {
        type: mimeType.split(";")[0] || "audio/webm",
      });
      const audioPreviewUrl = URL.createObjectURL(finalizedBlob);

      setRecordingState("processing");
      await submitChatTurn({
        voiceFile: audioFile,
        voicePreviewUrl: audioPreviewUrl,
        speechTranscript: capturedTranscript,
      });
      setRecordingState("idle");
      setRecordingSeconds(0);
    } catch {
      releaseMicrophoneResources();
      setRecordingState("error");
      setErrorBanner("Failed to finalize voice recording. Please try again.");
      toast.error("Failed to finalize voice recording.");
    }
  }

  async function submitChatTurn(options?: {
    overridePrompt?: string;
    overrideMode?: StudentAiMode;
    voiceFile?: File;
    voicePreviewUrl?: string;
    speechTranscript?: string;
  }) {
    if (sending || history.hasActiveOfficialExam) return;

    const textPrompt = (options?.overridePrompt ?? promptInput).trim();
    const voiceFile = options?.voiceFile;
    const currentStaged = options?.overridePrompt ? [] : [...stagedAttachments];

    if (!textPrompt && !voiceFile && currentStaged.length === 0) {
      return;
    }

    const effectiveMode = options?.overrideMode ?? mode;
    if (options?.overrideMode) {
      setMode(options.overrideMode);
    }

    if (!options?.overridePrompt) {
      setPromptInput("");
      setStagedAttachments([]);
    }

    setErrorBanner(null);
    setSending(true);

    const optimisticAttachments: MessageAttachmentDisplay[] = [
      ...currentStaged.map((att) => ({
        fileName: att.fileName,
        mimeType: att.mimeType,
        kind: att.kind,
        sizeBytes: att.sizeBytes,
        previewUrl: att.previewUrl,
      })),
      ...(voiceFile
        ? [
            {
              fileName: voiceFile.name,
              mimeType: voiceFile.type || "audio/webm",
              kind: "audio" as const,
              sizeBytes: voiceFile.size,
              previewUrl: options?.voicePreviewUrl,
              isVoiceRecording: true,
            },
          ]
        : []),
    ];

    const optimisticUserContent =
      textPrompt ||
      (options?.speechTranscript
        ? `🎤 ${options.speechTranscript}`
        : voiceFile
          ? "🎤 Voice Message"
          : `Attached: ${optimisticAttachments.map((a) => a.fileName).join(", ")}`);

    const optimisticId = `user-${Date.now()}`;
    setLocalTurns((prev) => [
      ...prev,
      {
        id: optimisticId,
        sender: "user",
        content: optimisticUserContent,
        attachments:
          optimisticAttachments.length > 0 ? optimisticAttachments : undefined,
      },
    ]);

    try {
      const formData = new FormData();
      if (activeConversationId) {
        formData.append("conversationId", activeConversationId);
      }
      if (selectedCourseId) {
        formData.append("courseId", selectedCourseId);
      }
      formData.append("mode", effectiveMode);
      formData.append("prompt", textPrompt);
      if (options?.speechTranscript) {
        formData.append("speechTranscript", options.speechTranscript);
      }

      for (const att of currentStaged) {
        formData.append("files", att.file, att.fileName);
      }
      if (voiceFile) {
        formData.append("files", voiceFile, voiceFile.name);
      }

      const res = await fetch("/api/ai/student", {
        method: "POST",
        body: formData,
      });

      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        data?: {
          conversationId: string;
          messageId: string | null;
          userMessage?: string;
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
    <div
      className={cn(
        "flex h-[calc(100dvh-7.5rem)] min-h-[560px] w-full flex-col overflow-hidden rounded-2xl border",
        DARK_GLASS_SHELL,
      )}
    >
      {/* A. Chat Header */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0F1115]/60 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-500/15 text-emerald-400 shadow-2xs">
            <Sparkles className="size-4" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-foreground sm:text-lg">
                AI Study Assistant
              </h1>
              <Badge
                variant="outline"
                className="hidden border-emerald-400/30 bg-emerald-500/10 text-[10px] text-emerald-300 sm:inline-flex"
              >
                {selectedCourse ? "Grounded Course RAG" : "Personal AI Tutor"}
              </Badge>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {selectedCourse
                ? `${selectedCourse.code} — ${selectedCourse.title}`
                : "General AI Assistant • Multimodal Text, Documents, Images & Voice"}
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
            <span>New Chat</span>
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
                  Resume previous study sessions or start a new chat.
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
                  <span>Start New Chat</span>
                </Button>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-4">
                {history.conversations.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    <MessageSquare className="mx-auto mb-2 size-6 opacity-40" />
                    <p>No previous conversations yet.</p>
                  </div>
                ) : (
                  history.conversations.map((conv) => {
                    const isActive = activeConversationId === conv.id;
                    return (
                      <button
                        key={conv.id}
                        type="button"
                        onClick={() => selectConversation(conv.id)}
                        className={cn(
                          "w-full rounded-xl border p-3 text-start text-xs transition-colors",
                          isActive
                            ? "border-emerald-400/50 bg-emerald-500/15 font-medium text-foreground"
                            : "border-white/10 bg-[#0F1115]/60 text-muted-foreground hover:border-emerald-400/35 hover:bg-[#161B24]/80 hover:text-foreground",
                        )}
                      >
                        <p
                          className="truncate font-medium text-foreground"
                          dir="auto"
                        >
                          {conv.title}
                        </p>
                        <div className="mt-1 flex items-center justify-between gap-2 font-mono text-[10px] opacity-75">
                          <span className="truncate">
                            {conv.course_id ? "Course RAG" : "General AI"}
                          </span>
                          <span>{conv.updated_at.slice(0, 10)}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Active Official Exam Lock Banner */}
      {history.hasActiveOfficialExam && (
        <div className="flex shrink-0 items-center gap-3 border-b border-destructive/50 bg-destructive/15 px-4 py-2.5 text-xs text-foreground sm:px-6">
          <Lock className="size-4 shrink-0 text-destructive" />
          <p>
            <strong>Official Exam Lock Active:</strong> You currently have an
            in-progress official examination. AI Study Assistant is restricted
            until you submit your exam.
          </p>
        </div>
      )}

      {/* B & C. Main Scrollable Chat Viewport */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col">
          {localTurns.length === 0 ? (
            /* B. Welcome Screen */
            <div className="my-auto flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-emerald-400/35 bg-emerald-500/15 text-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.16)]">
                <Sparkles className="size-7" aria-hidden="true" />
              </div>

              <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                How can I help you study today?
              </h2>
              <p className="mt-2 max-w-lg text-sm text-muted-foreground">
                Ask questions about your courses, lessons, study materials, or
                academic progress.
              </p>

              {/* 5 Suggestion Prompts */}
              <div className="mt-8 grid w-full max-w-2xl gap-3 sm:grid-cols-2">
                {SUGGESTION_CARDS.map((card, index) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={card.title}
                      type="button"
                      disabled={sending || history.hasActiveOfficialExam}
                      onClick={() =>
                        void submitChatTurn({
                          overridePrompt: card.prompt,
                          overrideMode: card.mode,
                        })
                      }
                      className={cn(
                        "group flex items-start gap-3.5 rounded-xl border p-4 text-start disabled:pointer-events-none disabled:opacity-50",
                        DARK_GLASS_CARD,
                        index === SUGGESTION_CARDS.length - 1 &&
                          "sm:col-span-2",
                      )}
                    >
                      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-emerald-400/25 bg-emerald-500/15 text-emerald-400 transition-colors group-hover:bg-emerald-500/25">
                        <Icon className="size-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">
                          {card.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {card.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* C. Conversation Area */
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
                        "max-w-[88%] rounded-2xl px-4 py-3.5 sm:max-w-[82%]",
                        isUser
                          ? "space-y-2.5 border border-emerald-400/25 bg-emerald-950/60 text-sm text-foreground shadow-2xs backdrop-blur-md"
                          : "w-full space-y-3 border border-white/10 bg-[#131720]/75 text-foreground shadow-2xs backdrop-blur-md",
                      )}
                    >
                      {turn.attachments && turn.attachments.length > 0 && (
                        <div className="space-y-2">
                          {turn.attachments.map((att, idx) => {
                            if (att.kind === "image" && att.previewUrl) {
                              return (
                                <div
                                  key={idx}
                                  className="overflow-hidden rounded-xl border border-white/10 bg-[#0F1115]/70"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={att.previewUrl}
                                    alt={att.fileName}
                                    className="max-h-60 w-auto rounded-t-xl object-contain"
                                  />
                                  <div className="flex items-center justify-between px-2.5 py-1 text-[11px] text-muted-foreground">
                                    <span className="truncate">
                                      {att.fileName}
                                    </span>
                                    <span>{formatFileSize(att.sizeBytes)}</span>
                                  </div>
                                </div>
                              );
                            }

                            if (att.kind === "audio") {
                              return (
                                <div
                                  key={idx}
                                  className="space-y-1.5 rounded-xl border border-white/10 bg-[#0F1115]/70 p-2.5"
                                >
                                  <div className="flex items-center justify-between gap-2 text-xs">
                                    <span className="flex items-center gap-1.5 truncate font-medium text-foreground">
                                      <FileAudio className="size-3.5 shrink-0 text-emerald-400" />
                                      <span className="truncate">
                                        {att.isVoiceRecording
                                          ? "Voice Recording"
                                          : att.fileName}
                                      </span>
                                    </span>
                                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                                      {formatFileSize(att.sizeBytes)}
                                    </span>
                                  </div>
                                  {att.previewUrl && (
                                    <audio
                                      controls
                                      src={att.previewUrl}
                                      className="h-8 w-full max-w-xs"
                                    />
                                  )}
                                </div>
                              );
                            }

                            return (
                              <div
                                key={idx}
                                className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#0F1115]/70 px-3 py-2 text-xs"
                              >
                                <span className="flex items-center gap-2 truncate font-medium text-foreground">
                                  <FileText className="size-3.5 shrink-0 text-emerald-400" />
                                  <span className="truncate">
                                    {att.fileName}
                                  </span>
                                </span>
                                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                                  {formatFileSize(att.sizeBytes)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {isUser ? (
                        <p
                          className="whitespace-pre-wrap text-sm leading-relaxed"
                          dir="auto"
                        >
                          {turn.content}
                        </p>
                      ) : (
                        <FormattedMarkdownContent content={turn.content} />
                      )}

                      {!isUser &&
                        turn.citations &&
                        turn.citations.length > 0 && (
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

                      {!isUser && !turn.id.startsWith("ai-") && (
                        <div className="flex items-center justify-end gap-1 pt-1">
                          <Button
                            type="button"
                            variant={
                              turn.feedbackRating === 1 ? "gold" : "ghost"
                            }
                            size="icon-sm"
                            disabled={isPending}
                            onClick={() => handleFeedback(turn.id, 1)}
                            aria-label="Helpful response"
                          >
                            <ThumbsUp className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant={
                              turn.feedbackRating === -1
                                ? "destructive"
                                : "ghost"
                            }
                            size="icon-sm"
                            disabled={isPending}
                            onClick={() => handleFeedback(turn.id, -1)}
                            aria-label="Not helpful response"
                          >
                            <ThumbsDown className="size-3.5" />
                          </Button>
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

              {sending && (
                <div className="flex items-start gap-3.5">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl border border-emerald-400/35 bg-emerald-500/15 text-emerald-400">
                    <Loader2 className="size-4 animate-spin" />
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[#131720]/75 px-4 py-3 text-xs text-muted-foreground backdrop-blur-md">
                    {recordingState === "processing"
                      ? "Transcribing voice & generating response..."
                      : selectedCourse
                        ? "Retrieving course sources & synthesizing answer..."
                        : "Analyzing your message & attachments..."}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* D. Bottom Chat Input Area */}
      <div className="shrink-0 border-t border-white/10 bg-[#0F1115]/65 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto w-full max-w-3xl space-y-2.5">
          {errorBanner && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-destructive/50 bg-destructive/15 px-3.5 py-2 text-xs text-destructive">
              <div className="flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                <span>{errorBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setErrorBanner(null);
                  if (recordingState === "error") setRecordingState("idle");
                }}
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

          <input
            ref={docInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.pptx,.xlsx,.txt,.md,.csv"
            className="hidden"
            disabled={sending || history.hasActiveOfficialExam}
            onChange={(e) => {
              stageSelectedFiles(e.target.files, "document");
              e.target.value = "";
            }}
          />
          <input
            ref={imageInputRef}
            type="file"
            multiple
            accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
            className="hidden"
            disabled={sending || history.hasActiveOfficialExam}
            onChange={(e) => {
              stageSelectedFiles(e.target.files, "image");
              e.target.value = "";
            }}
          />
          <input
            ref={audioInputRef}
            type="file"
            multiple
            accept=".mp3,.wav,.m4a,.webm,audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,audio/webm"
            className="hidden"
            disabled={sending || history.hasActiveOfficialExam}
            onChange={(e) => {
              stageSelectedFiles(e.target.files, "audio");
              e.target.value = "";
            }}
          />

          {stagedAttachments.length > 0 && recordingState === "idle" && (
            <div className="flex flex-wrap gap-2.5 rounded-xl border border-white/10 bg-[#131720]/75 p-2.5 backdrop-blur-md">
              {stagedAttachments.map((att) => (
                <div
                  key={att.id}
                  className="relative flex items-center gap-2.5 rounded-lg border border-white/10 bg-[#0F1115]/80 p-2 pe-7 text-xs shadow-2xs"
                >
                  {att.kind === "image" && att.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={att.previewUrl}
                      alt={att.fileName}
                      className="size-11 shrink-0 rounded-md border border-white/10 object-cover"
                    />
                  ) : att.kind === "audio" ? (
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-400">
                      <FileAudio className="size-5" />
                    </div>
                  ) : att.fileName.toLowerCase().endsWith(".xlsx") ? (
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-400">
                      <FileSpreadsheet className="size-5" />
                    </div>
                  ) : (
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-400">
                      <FileText className="size-5" />
                    </div>
                  )}

                  <div className="min-w-0 max-w-48 space-y-1">
                    <p className="truncate font-medium text-foreground">
                      {att.fileName}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Badge
                        variant="outline"
                        className="border-white/15 px-1 py-0 text-[9px] uppercase"
                      >
                        {att.kind}
                      </Badge>
                      <span>{formatFileSize(att.sizeBytes)}</span>
                    </div>
                    {att.kind === "audio" && att.previewUrl && (
                      <audio
                        controls
                        src={att.previewUrl}
                        className="mt-1 h-7 w-44"
                      />
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeStagedAttachment(att.id)}
                    className="absolute end-1.5 top-1.5 rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                    aria-label={`Remove ${att.fileName}`}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {recordingState === "recording" || recordingState === "sending" ? (
            <div className="rounded-2xl border border-emerald-400/50 bg-[#131720]/90 p-3.5 shadow-[0_10px_32px_rgba(16,185,129,0.18)] backdrop-blur-xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex size-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                    <span className="relative inline-flex size-3 rounded-full bg-destructive" />
                  </span>
                  <span className="text-xs font-semibold tracking-wide text-foreground uppercase">
                    {recordingState === "sending"
                      ? "Finalizing Audio..."
                      : "Recording Live"}
                  </span>
                  <span className="rounded-md border border-white/10 bg-[#0F1115]/80 px-2 py-0.5 font-mono text-xs font-bold text-emerald-400">
                    {formatDurationClock(recordingSeconds)}
                  </span>
                </div>

                <div
                  aria-label="Live microphone audio waveform"
                  className="flex h-9 flex-1 items-center justify-center gap-1 overflow-hidden px-2"
                >
                  {waveformLevels.map((lvl, idx) => (
                    <span
                      key={idx}
                      style={{ height: `${lvl}%` }}
                      className="w-1 shrink-0 rounded-full bg-emerald-400 transition-[height] duration-75"
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={recordingState === "sending"}
                    onClick={handleCancelRecording}
                    className="h-8 gap-1.5 rounded-xl border-destructive/50 bg-[#0F1115]/70 text-destructive hover:bg-destructive/15"
                  >
                    <X className="size-3.5" />
                    <span>Cancel</span>
                  </Button>

                  <Button
                    type="button"
                    variant="gold"
                    size="sm"
                    disabled={recordingState === "sending"}
                    onClick={() => void handleSendWhileRecording()}
                    className="h-8 gap-1.5 rounded-xl px-3.5"
                  >
                    {recordingState === "sending" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Send className="size-3.5" />
                    )}
                    <span>Send</span>
                  </Button>
                </div>
              </div>

              {liveSpeechPreview && (
                <p
                  dir="auto"
                  className="mt-2 truncate border-t border-white/10 pt-1.5 text-xs text-muted-foreground"
                >
                  <span className="font-semibold text-emerald-400">
                    Live Speech:{" "}
                  </span>
                  {liveSpeechPreview}
                </p>
              )}
            </div>
          ) : (
            /* Distinct Midnight-Slate Glass Composer Container */
            <div className={DARK_GLASS_COMPOSER}>
              <textarea
                ref={textareaRef}
                rows={2}
                dir="auto"
                value={promptInput}
                disabled={sending || history.hasActiveOfficialExam}
                onChange={(e) => setPromptInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submitChatTurn();
                  }
                }}
                placeholder="Ask anything about your courses, lessons, or study materials..."
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
                        disabled={sending || history.hasActiveOfficialExam}
                        className={cn(
                          "h-8 gap-1.5 rounded-xl px-2.5 text-xs",
                          DARK_GLASS_PILL,
                        )}
                        aria-label="Attach files"
                      >
                        <Paperclip className="size-3.5 text-emerald-400" />
                        <span className="hidden sm:inline">Attach</span>
                        <ChevronDown className="size-3 opacity-60" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-56 border-white/10 bg-[#0F1115]/95 backdrop-blur-xl"
                    >
                      <DropdownMenuLabel>Attach Study File</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => docInputRef.current?.click()}
                      >
                        <FileText className="size-4 text-emerald-400" />
                        <div className="flex flex-col">
                          <span className="text-xs font-medium">
                            Upload Document
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            PDF, DOCX, PPTX, XLSX, TXT
                          </span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => imageInputRef.current?.click()}
                      >
                        <ImageIcon className="size-4 text-emerald-400" />
                        <div className="flex flex-col">
                          <span className="text-xs font-medium">
                            Upload Image
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            PNG, JPG, JPEG, WEBP
                          </span>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => audioInputRef.current?.click()}
                      >
                        <FileAudio className="size-4 text-emerald-400" />
                        <div className="flex flex-col">
                          <span className="text-xs font-medium">
                            Upload Audio
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            MP3, WAV, M4A, WEBM
                          </span>
                        </div>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={sending}
                        className={cn(
                          "h-8 max-w-52 gap-1.5 rounded-xl px-2.5 text-xs sm:max-w-64",
                          DARK_GLASS_PILL,
                        )}
                      >
                        {selectedCourse ? (
                          <BookOpen className="size-3.5 shrink-0 text-emerald-400" />
                        ) : (
                          <Sparkles className="size-3.5 shrink-0 text-emerald-400" />
                        )}
                        <span className="truncate">
                          {selectedCourse
                            ? `${selectedCourse.code} — ${selectedCourse.title}`
                            : "General AI Assistant"}
                        </span>
                        <ChevronDown className="size-3 shrink-0 opacity-60" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-72 border-white/10 bg-[#0F1115]/95 backdrop-blur-xl"
                    >
                      <DropdownMenuLabel>
                        Optional Course Context
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuRadioGroup
                        value={selectedCourseId}
                        onValueChange={setSelectedCourseId}
                      >
                        <DropdownMenuRadioItem value="">
                          <span className="font-medium text-foreground">
                            General AI Assistant
                          </span>
                        </DropdownMenuRadioItem>
                        {data.enrolledCourses.length > 0 && (
                          <DropdownMenuSeparator />
                        )}
                        {data.enrolledCourses.map((c) => (
                          <DropdownMenuRadioItem key={c.id} value={c.id}>
                            <span className="truncate">
                              <strong className="font-mono text-xs">
                                {c.code}
                              </strong>{" "}
                              — {c.title}
                            </span>
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={sending || history.hasActiveOfficialExam}
                    onClick={() => void handleStartRecording()}
                    title="Record voice message"
                    aria-label="Record voice message"
                    className={cn(
                      "h-8 gap-1.5 rounded-xl px-2.5 text-xs",
                      DARK_GLASS_PILL,
                    )}
                  >
                    <Mic className="size-3.5 text-emerald-400" />
                    <span className="hidden sm:inline">Voice</span>
                  </Button>

                  <Button
                    type="button"
                    variant="gold"
                    size="sm"
                    disabled={
                      sending ||
                      (!promptInput.trim() && stagedAttachments.length === 0) ||
                      history.hasActiveOfficialExam
                    }
                    onClick={() => void submitChatTurn()}
                    className="h-8 rounded-xl px-3.5"
                  >
                    {sending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-3.5" />
                    )}
                    <span>Send</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}