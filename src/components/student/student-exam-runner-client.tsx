"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  Camera,
  CheckCircle2,
  Clock,
  Lock,
  MessageSquare,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";

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
import { Textarea } from "@/components/ui/input";
import { getStudentDictionary } from "@/i18n/student-dictionaries";
import {
  getOptionLetter,
  sanitizeQuizOptionText,
  sanitizeQuizQuestionPrompt,
} from "@/lib/quiz-format";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  studentLogExamViolationAction,
  studentSaveExamAnswerAction,
  studentStartExamAttemptAction,
  studentSubmitExamAttemptAction,
} from "@/services/student/actions";
import type { StudentExamRunnerData } from "@/services/student/queries";

interface StudentExamRunnerClientProps {
  data: StudentExamRunnerData;
}

interface LocalAnswerState {
  selectedOptionId: string | null;
  selectedOptionIds: string[];
  answerText: string;
}

function formatSecondsToClock(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function StudentExamRunnerClient({
  data,
}: StudentExamRunnerClientProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const t = getStudentDictionary(locale);
  const [isPending, startTransition] = useTransition();

  // Pre-exam consent & camera readiness
  const [cameraConsent, setCameraConsent] = useState(false);
  const [guardianConsent, setGuardianConsent] = useState(false);
  const [cameraVerified, setCameraVerified] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Active exam runner state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSavingAnswer, setIsSavingAnswer] = useState(false);
  const [lastSavedIso, setLastSavedIso] = useState<string | null>(null);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [isPaused, setIsPaused] = useState<boolean>(
    Boolean(data.activeAttempt?.is_paused),
  );
  const [pausedReason, setPausedReason] = useState<string | null>(
    data.activeAttempt?.paused_reason ?? null,
  );
  const [pausedAtIso, setPausedAtIso] = useState<string | null>(
    data.activeAttempt?.paused_at ?? null,
  );
  const [localViolationCount, setLocalViolationCount] = useState(
    data.activeAttempt?.violations_count ?? 0,
  );
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => {
    if (
      data.activeAttempt?.is_paused &&
      typeof data.activeAttempt.remaining_seconds === "number"
    ) {
      return Math.max(0, data.activeAttempt.remaining_seconds);
    }
    return data.exam.duration_minutes * 60;
  });

  const autoSubmitTriggeredRef = useRef(false);
  const pauseInFlightRef = useRef(false);
  const hadFullscreenRef = useRef(false);
  const remainingSecondsRef = useRef<number>(remainingSeconds);
  useEffect(() => {
    remainingSecondsRef.current = remainingSeconds;
  }, [remainingSeconds]);

  const [answersMap, setAnswersMap] = useState<Record<string, LocalAnswerState>>(
    () => {
      const init: Record<string, LocalAnswerState> = {};
      for (const ans of data.savedAnswers) {
        init[ans.question_id] = {
          selectedOptionId: ans.selected_option_id,
          selectedOptionIds: ans.selected_option_ids ?? [],
          answerText: ans.answer_text ?? "",
        };
      }
      return init;
    },
  );

  const activeAttempt = data.activeAttempt;
  const currentQuestion = data.questions[currentIndex] ?? null;
  const answersMapRef = useRef(answersMap);
  const currentQuestionRef = useRef(currentQuestion);
  useEffect(() => {
    answersMapRef.current = answersMap;
  }, [answersMap]);
  useEffect(() => {
    currentQuestionRef.current = currentQuestion;
  }, [currentQuestion]);

  // Sync server pause/resume state when attempt snapshot changes
  const attemptSyncKey = activeAttempt
    ? `${activeAttempt.id}:${Boolean(activeAttempt.is_paused)}:${activeAttempt.paused_at ?? ""}:${activeAttempt.remaining_seconds ?? ""}`
    : "none";
  const [prevAttemptSyncKey, setPrevAttemptSyncKey] = useState(attemptSyncKey);
  if (prevAttemptSyncKey !== attemptSyncKey) {
    setPrevAttemptSyncKey(attemptSyncKey);
    if (activeAttempt) {
      setIsPaused(Boolean(activeAttempt.is_paused));
      setPausedReason(activeAttempt.paused_reason ?? null);
      setPausedAtIso(activeAttempt.paused_at ?? null);
      if (
        activeAttempt.is_paused &&
        typeof activeAttempt.remaining_seconds === "number"
      ) {
        setRemainingSeconds(Math.max(0, activeAttempt.remaining_seconds));
      }
    }
  }

  useEffect(() => {
    if (!isPaused) {
      pauseInFlightRef.current = false;
    }
  }, [isPaused]);

  useEffect(() => {
    if (!activeAttempt) return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`learnix-exam-attempt-${activeAttempt.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "exam_attempts",
          filter: `id=eq.${activeAttempt.id}`,
        },
        (payload) => {
          const updated = payload.new as {
            is_paused?: boolean;
            status?: string;
            resume_status?: string;
          };
          if (updated.is_paused === false && updated.resume_status === "approved") {
            toast.success(
              "Your instructor approved resuming your examination!",
            );
            setIsPaused(false);
            pauseInFlightRef.current = false;
          } else if (updated.status === "invalidated") {
            toast.error("Your examination attempt was closed by your instructor.");
          }
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeAttempt, router]);

  const stopCameraStream = useCallback(() => {
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        track.stop();
      }
      mediaStreamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const requestCameraStream = useCallback(async () => {
    setCameraError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "Camera hardware API is unavailable in this browser environment.",
      );
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 } },
        audio: false,
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraVerified(true);
      setCameraActive(true);
      return true;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Camera permission was denied or no webcam was detected.";
      setCameraError(msg);
      return false;
    }
  }, []);

  // Activate camera strictly during active exam session when enabled & consented
  useEffect(() => {
    if (
      activeAttempt &&
      data.exam.camera_monitoring_enabled &&
      activeAttempt.camera_consent_granted &&
      !mediaStreamRef.current
    ) {
      void requestCameraStream();
    }
    return () => {
      stopCameraStream();
    };
  }, [
    activeAttempt,
    data.exam.camera_monitoring_enabled,
    requestCameraStream,
    stopCameraStream,
  ]);

  const recordViolation = useCallback(
    async (
      violationType: string,
      severity: "low" | "medium" | "high" | "critical",
      details: Record<string, unknown> = {},
      pauseExam = false,
    ) => {
      if (!activeAttempt) return;
      if (pauseExam && (isPaused || pauseInFlightRef.current)) return;

      const timestampIso = new Date().toISOString();
      const snapshotRemaining = remainingSecondsRef.current;

      if (pauseExam) {
        pauseInFlightRef.current = true;
        // 1. Save current answer progress BEFORE pausing the attempt on the server
        const q = currentQuestionRef.current;
        const curAns = q ? answersMapRef.current[q.id] : undefined;
        if (
          q &&
          curAns &&
          (Boolean(curAns.selectedOptionId) ||
            curAns.selectedOptionIds.length > 0 ||
            curAns.answerText.trim().length > 0)
        ) {
          await studentSaveExamAnswerAction({
            examId: data.exam.id,
            attemptId: activeAttempt.id,
            questionId: q.id,
            selectedOptionId: curAns.selectedOptionId,
            selectedOptionIds: curAns.selectedOptionIds,
            answerText: curAns.answerText || null,
          });
          setLastSavedIso(timestampIso);
        }

        // 2. Immediately halt & lock the exam client-side awaiting teacher approval
        setIsPaused(true);
        setPausedReason(violationType);
        setPausedAtIso(timestampIso);
      }

      setLocalViolationCount((c) => c + 1);
      await studentLogExamViolationAction({
        attemptId: activeAttempt.id,
        violationType,
        severity,
        pauseExam,
        remainingSeconds: snapshotRemaining,
        details: {
          ...details,
          clientTimestamp: timestampIso,
        },
      });
    },
    [activeAttempt, data.exam.id, isPaused],
  );

  const handleFinalSubmit = useCallback(
    async (dueToExpiration = false) => {
      if (!activeAttempt || isPaused) return;
      stopCameraStream();
      startTransition(async () => {
        const res = await studentSubmitExamAttemptAction({
          examId: data.exam.id,
          attemptId: activeAttempt.id,
        });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success(
          dueToExpiration
            ? t.exams.timeExpiredToast
            : t.exams.submittedSuccessToast,
        );
        setSubmitDialogOpen(false);
        router.refresh();
      });
    },
    [
      activeAttempt,
      data.exam.id,
      isPaused,
      router,
      stopCameraStream,
      t.exams.submittedSuccessToast,
      t.exams.timeExpiredToast,
    ],
  );

  // Countdown timer & automatic submission on expiration (halted while paused)
  useEffect(() => {
    if (!activeAttempt || isPaused) return;
    const updateRemaining = () => {
      const diffMs =
        new Date(activeAttempt.expires_at).getTime() - Date.now();
      const nextSec = Math.max(0, Math.floor(diffMs / 1000));
      setRemainingSeconds(nextSec);

      if (nextSec <= 0 && !autoSubmitTriggeredRef.current) {
        autoSubmitTriggeredRef.current = true;
        void handleFinalSubmit(true);
      }
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [activeAttempt, isPaused, handleFinalSubmit]);

  // Browser security monitoring: tab switching, focus loss, fullscreen exit, camera disconnect, copy/cut/shortcut blocking
  useEffect(() => {
    if (!activeAttempt || isPaused) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        void recordViolation(
          "tab_switch",
          "high",
          { visibilityState: document.visibilityState },
          true,
        );
      }
    };

    const handleWindowBlur = () => {
      void recordViolation("window_focus_lost", "high", {}, true);
    };

    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        hadFullscreenRef.current = true;
      } else if (hadFullscreenRef.current) {
        hadFullscreenRef.current = false;
        void recordViolation("fullscreen_exit", "high", {}, true);
      }
    };

    const handleCopyOrCut = (e: ClipboardEvent) => {
      e.preventDefault();
      toast.warning("Copying examination content is disabled.");
      void recordViolation("copy_attempt", "medium", { eventType: e.type }, false);
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        ["p", "c", "s"].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
        toast.warning(
          "Printing and copying shortcuts are disabled during active examinations.",
        );
        void recordViolation(
          "prohibited_shortcut",
          "medium",
          { key: e.key },
          false,
        );
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    const tracks = mediaStreamRef.current?.getVideoTracks() ?? [];
    const handleCameraEnded = () => {
      if (data.exam.camera_monitoring_enabled) {
        void recordViolation("camera_disconnected", "high", {}, true);
      }
    };
    tracks.forEach((tr) => tr.addEventListener("ended", handleCameraEnded));

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("copy", handleCopyOrCut);
    document.addEventListener("cut", handleCopyOrCut);
    document.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      tracks.forEach((tr) => tr.removeEventListener("ended", handleCameraEnded));
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("copy", handleCopyOrCut);
      document.removeEventListener("cut", handleCopyOrCut);
      document.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [
    activeAttempt,
    isPaused,
    data.exam.camera_monitoring_enabled,
    recordViolation,
  ]);

  // Persist answer to backend immediately (auto-save)
  const persistAnswer = useCallback(
    async (questionId: string, nextAnswer: LocalAnswerState) => {
      if (!activeAttempt) return;
      setIsSavingAnswer(true);
      const res = await studentSaveExamAnswerAction({
        examId: data.exam.id,
        attemptId: activeAttempt.id,
        questionId,
        selectedOptionId: nextAnswer.selectedOptionId,
        selectedOptionIds: nextAnswer.selectedOptionIds,
        answerText: nextAnswer.answerText || null,
      });
      setIsSavingAnswer(false);
      if (res.ok) {
        setLastSavedIso(res.data.savedAt);
      } else {
        toast.error(res.error);
      }
    },
    [activeAttempt, data.exam.id],
  );

  function handleSelectSingleOption(questionId: string, optionId: string) {
    const next: LocalAnswerState = {
      selectedOptionId: optionId,
      selectedOptionIds: [optionId],
      answerText: "",
    };
    setAnswersMap((prev) => ({ ...prev, [questionId]: next }));
    void persistAnswer(questionId, next);
  }

  function handleToggleMultipleOption(questionId: string, optionId: string) {
    const current = answersMap[questionId] ?? {
      selectedOptionId: null,
      selectedOptionIds: [],
      answerText: "",
    };
    const exists = current.selectedOptionIds.includes(optionId);
    const nextIds = exists
      ? current.selectedOptionIds.filter((id) => id !== optionId)
      : [...current.selectedOptionIds, optionId];

    const next: LocalAnswerState = {
      selectedOptionId: nextIds[0] ?? null,
      selectedOptionIds: nextIds,
      answerText: "",
    };
    setAnswersMap((prev) => ({ ...prev, [questionId]: next }));
    void persistAnswer(questionId, next);
  }

  function handleEssayTextChange(questionId: string, text: string) {
    const next: LocalAnswerState = {
      selectedOptionId: null,
      selectedOptionIds: [],
      answerText: text,
    };
    setAnswersMap((prev) => ({ ...prev, [questionId]: next }));
  }

  function handleStartExam() {
    if (data.exam.camera_monitoring_enabled) {
      if (!cameraConsent || !guardianConsent) {
        toast.error(
          "Please confirm both camera monitoring and student/guardian privacy consent checkboxes.",
        );
        return;
      }
    }

    startTransition(async () => {
      const res = await studentStartExamAttemptAction({
        examId: data.exam.id,
        cameraConsentGranted: cameraConsent,
        guardianConsentConfirmed: guardianConsent,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  // Difficulty & weak topic breakdown for Results View
  const difficultyBreakdown = useMemo(() => {
    const levels: Array<"easy" | "medium" | "hard"> = ["easy", "medium", "hard"];
    return levels.map((lvl) => {
      const qs = data.questions.filter((q) => q.difficulty === lvl);
      const earned = qs.reduce((sum, q) => {
        const ans = data.savedAnswers.find((a) => a.question_id === q.id);
        return sum + Number(ans?.points_awarded ?? 0);
      }, 0);
      const max = qs.reduce((sum, q) => sum + q.points, 0);
      const pct = max > 0 ? Math.round((earned / max) * 100) : 0;
      return { difficulty: lvl, count: qs.length, earned, max, pct };
    });
  }, [data.questions, data.savedAnswers]);

  // ---------------------------------------------------------------------------
  // VIEW 1: ACTIVE EXAMINATION RUNNER (WITH WATERMARK, TIMER, CAMERA, DETERRENCE)
  // ---------------------------------------------------------------------------
  if (activeAttempt) {
    const answeredCount = Object.values(answersMap).filter(
      (a) =>
        Boolean(a.selectedOptionId) ||
        a.selectedOptionIds.length > 0 ||
        a.answerText.trim().length > 0,
    ).length;

    const currentAnswer = currentQuestion
      ? answersMap[currentQuestion.id] ?? {
          selectedOptionId: null,
          selectedOptionIds: [],
          answerText: "",
        }
      : null;

    const watermarkText = `${data.studentName} • ${data.studentEmail}`;

    // Paused Exam Gate: Questions are NOT rendered in the DOM until the instructor approves resuming
    if (isPaused) {
      return (
        <div className="mx-auto max-w-xl py-10">
          <Card className="border-destructive/50 bg-[#0F1115]/90 text-foreground shadow-xl backdrop-blur-xl">
            <CardHeader className="text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-destructive/40 bg-destructive/15 text-destructive">
                <Lock className="size-7" />
              </div>
              <CardTitle className="mt-3 text-xl">
                Examination Paused — Instructor Approval Required
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed">
                A browser monitoring event (
                <strong className="text-foreground">
                  {(pausedReason || "focus_change").replace(/_/g, " ")}
                </strong>
                ) was recorded
                {pausedAtIso
                  ? ` at ${pausedAtIso.slice(11, 19)} UTC`
                  : ""}. Your current answers ({answeredCount} /{" "}
                {data.questions.length}) and remaining timer (
                {formatSecondsToClock(remainingSeconds)}) have been saved, and
                your instructor has been notified.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="rounded-xl border border-white/10 bg-[#141922] p-3.5 text-muted-foreground">
                You cannot resume this examination until your instructor reviews
                and approves your attempt. This page updates automatically in
                real time as soon as approval is granted.
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <Button
                  type="button"
                  variant="gold"
                  size="sm"
                  onClick={() => router.refresh()}
                >
                  <RefreshCw className="size-3.5" />
                  <span>Check Approval Status</span>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link
                    href={`/messages?userId=${data.course.teacher_id}&courseId=${data.course.id}`}
                  >
                    <MessageSquare className="size-3.5" />
                    <span>Message Instructor</span>
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="relative select-none space-y-6 print:hidden">
        {/* Dynamic Security Watermark Overlay */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-10 overflow-hidden opacity-[0.06]"
        >
          <div className="grid h-full w-full -rotate-12 grid-cols-2 gap-16 p-12 text-center font-mono text-xs font-bold text-foreground">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center justify-center">
                {watermarkText}
              </div>
            ))}
          </div>
        </div>

        {/* Sticky Exam Header Bar: Timer, Auto-Save, Camera Indicator, Submit */}
        <Card className="relative z-20 border-gold-primary/50 bg-card/95 backdrop-blur">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={isSavingAnswer ? "outline" : "gold"}>
                  <Save className="mr-1 size-3" />
                  {isSavingAnswer ? t.exams.savingBadge : t.exams.autoSavedBadge}
                </Badge>
                {localViolationCount > 0 && (
                  <Badge variant="destructive">
                    <ShieldAlert className="mr-1 size-3" />
                    Alerts Logged: {localViolationCount}
                  </Badge>
                )}
              </div>
              <h1 className="mt-1 text-base font-bold text-foreground sm:text-lg">
                {data.exam.title}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {data.exam.camera_monitoring_enabled && (
                <Badge
                  variant={cameraActive ? "destructive" : "outline"}
                  className="gap-1.5 px-3 py-1"
                >
                  <Camera className="size-3.5" />
                  <span>
                    {cameraActive
                      ? t.exams.cameraActiveIndicator
                      : "Camera Standby"}
                  </span>
                </Badge>
              )}

              <div className="flex items-center gap-2 rounded-lg border border-gold-primary/50 bg-gold-primary/10 px-3 py-1.5 font-mono text-sm font-bold text-foreground">
                <Clock className="size-4 text-gold-foreground" />
                <span>{formatSecondsToClock(remainingSeconds)}</span>
              </div>

              <Button
                variant="gold"
                size="sm"
                onClick={() => setSubmitDialogOpen(true)}
              >
                <Send className="size-3.5" />
                <span>{t.exams.submitExamButton}</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main Exam Grid: Question Card + Navigation & Live Camera Sidebar */}
        <div className="relative z-20 grid gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-8">
            {currentQuestion && currentAnswer ? (
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant="gold" className="font-mono">
                      Question {currentIndex + 1}:
                    </Badge>
                    {lastSavedIso && (
                      <span className="font-mono text-[11px] text-muted-foreground">
                        Saved {lastSavedIso.slice(11, 19)}
                      </span>
                    )}
                  </div>
                  <CardTitle className="mt-3 text-base leading-relaxed">
                    {sanitizeQuizQuestionPrompt(currentQuestion.prompt, {
                      courseCode: data.course.code,
                      courseTitle: data.course.title,
                      subjectName: data.course.category,
                    })}
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  {currentQuestion.mediaUrl && (
                    <div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={currentQuestion.mediaUrl}
                        alt="Exam question diagram"
                        className="max-h-72 rounded-lg border border-border object-contain"
                      />
                    </div>
                  )}

                  {/* Single Choice & True/False */}
                  {(currentQuestion.questionType === "single_choice" ||
                    currentQuestion.questionType === "true_false") && (
                    <div className="space-y-2.5">
                      {currentQuestion.options.map((opt, optIdx) => {
                        const selected =
                          currentAnswer.selectedOptionId === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() =>
                              handleSelectSingleOption(
                                currentQuestion.id,
                                opt.id,
                              )
                            }
                            className={
                              selected
                                ? "flex w-full items-center gap-3 rounded-xl border-2 border-gold-primary bg-gold-primary/10 p-3.5 text-left text-sm font-medium text-foreground transition"
                                : "flex w-full items-center gap-3 rounded-xl border border-border/80 bg-background p-3.5 text-left text-sm text-foreground hover:border-gold-primary/50"
                            }
                          >
                            <span
                              className={
                                selected
                                  ? "size-4 shrink-0 rounded-full border-4 border-gold-primary bg-background"
                                  : "size-4 shrink-0 rounded-full border border-muted-foreground"
                              }
                            />
                            <span className="font-semibold text-gold-foreground">
                              {getOptionLetter(optIdx)}.
                            </span>
                            <span>{sanitizeQuizOptionText(opt.optionText)}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Multiple Choice (Multiple Correct) */}
                  {currentQuestion.questionType === "multiple_choice" && (
                    <div className="space-y-2.5">
                      {currentQuestion.options.map((opt, optIdx) => {
                        const selected =
                          currentAnswer.selectedOptionIds.includes(opt.id);
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() =>
                              handleToggleMultipleOption(
                                currentQuestion.id,
                                opt.id,
                              )
                            }
                            className={
                              selected
                                ? "flex w-full items-center gap-3 rounded-xl border-2 border-gold-primary bg-gold-primary/10 p-3.5 text-left text-sm font-medium text-foreground"
                                : "flex w-full items-center gap-3 rounded-xl border border-border/80 bg-background p-3.5 text-left text-sm text-foreground hover:border-gold-primary/50"
                            }
                          >
                            <input
                              type="checkbox"
                              readOnly
                              checked={selected}
                            />
                            <span className="font-semibold text-gold-foreground">
                              {getOptionLetter(optIdx)}.
                            </span>
                            <span>{sanitizeQuizOptionText(opt.optionText)}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Essay / Short Answer */}
                  {(currentQuestion.questionType === "essay" ||
                    currentQuestion.questionType === "short_answer") && (
                    <div className="space-y-2">
                      <Textarea
                        rows={7}
                        value={currentAnswer.answerText}
                        onChange={(e) =>
                          handleEssayTextChange(
                            currentQuestion.id,
                            e.target.value,
                          )
                        }
                        onBlur={() =>
                          void persistAnswer(currentQuestion.id, currentAnswer)
                        }
                        placeholder="Write your detailed response here. Your answer auto-saves when you move away or click Save..."
                      />
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            void persistAnswer(
                              currentQuestion.id,
                              currentAnswer,
                            )
                          }
                        >
                          <Save className="size-3.5" />
                          <span>Save Written Response</span>
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Previous / Next Question Navigation */}
                  <div className="flex items-center justify-between border-t border-border/70 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentIndex === 0}
                      onClick={() =>
                        setCurrentIndex((i) => Math.max(0, i - 1))
                      }
                    >
                      <ArrowLeft className="size-3.5" />
                      <span>Previous</span>
                    </Button>

                    {currentIndex < data.questions.length - 1 ? (
                      <Button
                        variant="gold"
                        size="sm"
                        onClick={() =>
                          setCurrentIndex((i) =>
                            Math.min(data.questions.length - 1, i + 1),
                          )
                        }
                      >
                        <span>Next Question</span>
                        <ArrowRight className="size-3.5" />
                      </Button>
                    ) : (
                      <Button
                        variant="gold"
                        size="sm"
                        onClick={() => setSubmitDialogOpen(true)}
                      >
                        <Send className="size-3.5" />
                        <span>{t.exams.submitExamButton}</span>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  No questions found in this examination.
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Sidebar: Question Navigator + Camera Proctoring Monitor */}
          <div className="space-y-4 lg:col-span-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  Question Navigator ({answeredCount} / {data.questions.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-5 gap-2">
                {data.questions.map((q, idx) => {
                  const ans = answersMap[q.id];
                  const isAnswered =
                    Boolean(ans?.selectedOptionId) ||
                    (ans?.selectedOptionIds.length ?? 0) > 0 ||
                    (ans?.answerText.trim().length ?? 0) > 0;
                  const isCurrent = idx === currentIndex;

                  return (
                    <Button
                      key={q.id}
                      type="button"
                      size="sm"
                      variant={
                        isCurrent ? "gold" : isAnswered ? "secondary" : "outline"
                      }
                      onClick={() => setCurrentIndex(idx)}
                      className="font-mono text-xs"
                    >
                      {idx + 1}
                    </Button>
                  );
                })}
              </CardContent>
            </Card>

            {data.exam.camera_monitoring_enabled && (
              <Card className="border-gold-primary/40">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-xs">
                    <Camera className="size-4 text-gold-foreground" />
                    <span>{t.exams.cameraActiveIndicator}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="aspect-video w-full rounded-lg border border-border bg-black object-cover"
                  />
                  {cameraError && (
                    <p className="text-xs text-destructive">{cameraError}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Focus changes and repeated tab switches are logged for instructor review. Browser indicators assist integrity review and do not automatically invalidate your progress.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Submission Confirmation Dialog */}
        <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t.exams.submitConfirmHeading}</DialogTitle>
              <DialogDescription>
                {t.exams.submitConfirmDescription}
              </DialogDescription>
            </DialogHeader>
            <p className="text-xs text-muted-foreground">
              Answered: <strong>{answeredCount}</strong> of{" "}
              <strong>{data.questions.length}</strong> questions.
            </p>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setSubmitDialogOpen(false)}
              >
                {t.common.cancel}
              </Button>
              <Button
                variant="gold"
                disabled={isPending}
                onClick={() => void handleFinalSubmit(false)}
              >
                {t.exams.submitExamButton}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW 2: RESULTS & WEAK-TOPIC DIAGNOSTIC VIEW (AFTER SUBMISSION)
  // ---------------------------------------------------------------------------
  const canStartAnotherAttempt = data.attemptsUsed < data.exam.max_attempts;

  if (data.latestCompletedAttempt && !canStartAnotherAttempt) {
    return (
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Button asChild variant="ghost" size="sm" className="-ml-2">
              <Link href="/student/exams">
                <ArrowLeft className="size-4" />
                <span>Back to Examinations</span>
              </Link>
            </Button>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
              {data.exam.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t.exams.resultSummaryHeading}
            </p>
          </div>
        </div>

        {!data.publishedResult ? (
          <Card className="border-gold-primary/40 bg-gold-primary/5">
            <CardContent className="flex items-center gap-3 p-6 text-sm">
              <Lock className="size-5 shrink-0 text-gold-foreground" />
              <p className="text-foreground">
                {t.exams.resultPendingPublicationNotice}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Score Summary Card */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="border-gold-primary/60 bg-gold-primary/5">
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground">Final Grade</p>
                  <p className="mt-1 text-3xl font-bold text-foreground">
                    {Number(data.publishedResult.score_percent).toFixed(1)}%
                  </p>
                  <Badge
                    variant={
                      data.publishedResult.passed ? "gold" : "destructive"
                    }
                    className="mt-2"
                  >
                    {data.publishedResult.passed ? "Passed" : "Needs Revision"}
                  </Badge>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground">Earned Marks</p>
                  <p className="mt-1 text-3xl font-bold text-foreground">
                    {Number(data.publishedResult.earned_points)} /{" "}
                    {Number(data.publishedResult.total_points)}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Passing Score: {Number(data.exam.passing_score)}%
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground">
                    Teacher Feedback
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    {data.publishedResult.feedback ||
                      "Auto-graded upon submission."}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Difficulty & Weak Topics Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t.exams.weakTopicsHeading}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                {difficultyBreakdown.map((item) => (
                  <div
                    key={item.difficulty}
                    className="rounded-xl border border-border/80 p-4 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="uppercase">
                        {item.difficulty}
                      </Badge>
                      <span className="font-mono font-bold text-foreground">
                        {item.pct}%
                      </span>
                    </div>
                    <p className="mt-2 text-muted-foreground">
                      {item.earned} / {item.max} marks ({item.count} questions)
                    </p>
                    {item.count > 0 && item.pct < 70 && (
                      <p className="mt-1.5 text-destructive">
                        Recommended for targeted revision.
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Answer Breakdown where Allowed */}
            {data.exam.allow_answer_review && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {t.exams.answerBreakdownHeading}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  {data.questions.map((q, qIdx) => {
                    const ans = data.savedAnswers.find(
                      (a) => a.question_id === q.id,
                    );
                    const earned = Number(ans?.points_awarded ?? 0);
                    const isFull = earned >= q.points;

                    return (
                      <div
                        key={q.id}
                        className="rounded-xl border border-border/80 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {isFull ? (
                              <CheckCircle2 className="size-4 text-emerald-500" />
                            ) : (
                              <XCircle className="size-4 text-destructive" />
                            )}
                            <span className="font-semibold text-foreground">
                              Question {qIdx + 1}:{" "}
                              {sanitizeQuizQuestionPrompt(q.prompt, {
                                courseCode: data.course.code,
                                courseTitle: data.course.title,
                                subjectName: data.course.category,
                              })}
                            </span>
                          </div>
                          <Badge variant={isFull ? "gold" : "outline"}>
                            {earned} / {q.points} pts
                          </Badge>
                        </div>

                        {q.options.length > 0 && (
                          <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
                            {q.options.map((opt, optIdx) => {
                              const picked =
                                ans?.selected_option_id === opt.id ||
                                (ans?.selected_option_ids ?? []).includes(
                                  opt.id,
                                );
                              return (
                                <div
                                  key={opt.id}
                                  className={
                                    opt.isCorrect
                                      ? "rounded-lg border border-emerald-500/60 bg-emerald-500/10 p-2 font-medium text-foreground"
                                      : picked
                                        ? "rounded-lg border border-destructive/60 bg-destructive/10 p-2 text-foreground"
                                        : "rounded-lg border border-border/60 p-2 text-muted-foreground"
                                  }
                                >
                                  {getOptionLetter(optIdx)}.{" "}
                                  {sanitizeQuizOptionText(opt.optionText)}{" "}
                                  {opt.isCorrect && (
                                    <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                                      (Correct Answer)
                                    </span>
                                  )}
                                  {picked && !opt.isCorrect && (
                                    <span className="font-mono text-[10px] text-destructive">
                                      (Your Selection)
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {ans?.answer_text && (
                          <p className="mt-2 rounded-lg bg-muted/40 p-2.5 text-muted-foreground">
                            <strong className="text-foreground">
                              Your Response:{" "}
                            </strong>
                            {ans.answer_text}
                          </p>
                        )}

                        {ans?.teacher_feedback && (
                          <p className="mt-2 text-gold-foreground">
                            <strong>Teacher Feedback: </strong>
                            {ans.teacher_feedback}
                          </p>
                        )}

                        {q.explanation && (
                          <p className="mt-2 text-muted-foreground">
                            <strong className="text-foreground">
                              Explanation:{" "}
                            </strong>
                            {q.explanation}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW 3: PRE-EXAM INSTRUCTIONS, PRIVACY NOTICE, CAMERA CONSENT & START GATE
  // ---------------------------------------------------------------------------
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/student/exams">
          <ArrowLeft className="size-4" />
          <span>Back to Examinations</span>
        </Link>
      </Button>

      <Card className="border-gold-primary/50">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge variant="gold">
              Attempt {data.attemptsUsed + 1} of {data.exam.max_attempts}
            </Badge>
          </div>
          <CardTitle className="mt-2 text-2xl">{data.exam.title}</CardTitle>
          <CardDescription>
            {data.exam.description || t.exams.instructionsHeading}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 text-xs">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-border p-3 text-center">
              <p className="text-base font-bold text-foreground">
                {data.exam.duration_minutes} min
              </p>
              <p className="text-muted-foreground">{t.exams.durationLabel}</p>
            </div>
            <div className="rounded-lg border border-border p-3 text-center">
              <p className="text-base font-bold text-foreground">
                {Number(data.exam.total_points)}
              </p>
              <p className="text-muted-foreground">{t.exams.marksLabel}</p>
            </div>
            <div className="rounded-lg border border-border p-3 text-center">
              <p className="text-base font-bold text-foreground">
                {Number(data.exam.passing_score)}%
              </p>
              <p className="text-muted-foreground">
                {t.exams.passingScoreLabel}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3 text-center">
              <p className="text-base font-bold text-foreground">
                {data.exam.version_count}
              </p>
              <p className="text-muted-foreground">Exam Versions</p>
            </div>
          </div>

          {data.exam.instructions && (
            <div className="rounded-xl border border-border/80 bg-muted/30 p-4">
              <p className="font-semibold text-foreground">
                {t.exams.instructionsHeading}
              </p>
              <p className="mt-1.5 whitespace-pre-wrap text-muted-foreground">
                {data.exam.instructions}
              </p>
            </div>
          )}

          {/* Browser Deterrence & Technical Transparency Notice */}
          <div className="rounded-xl border border-gold-primary/40 bg-gold-primary/5 p-4">
            <p className="flex items-center gap-2 font-semibold text-foreground">
              <ShieldCheck className="size-4 text-gold-foreground" />
              <span>{t.exams.privacyNoticeHeading}</span>
            </p>
            <p className="mt-1.5 leading-relaxed text-muted-foreground">
              {t.exams.privacyNoticeBody}
            </p>
            <p className="mt-2 flex items-start gap-2 text-[11px] text-muted-foreground">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-gold-foreground" />
              <span>{t.exams.browserLimitationNotice}</span>
            </p>
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">
              Data Retention Policy: Session monitoring metadata is retained for{" "}
              {data.exam.retention_days} days and deleted per institutional policy.
            </p>
          </div>

          {/* Camera Verification & Explicit Consent Controls */}
          {data.exam.camera_monitoring_enabled && (
            <div className="space-y-3 rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-semibold text-foreground">
                  <Camera className="size-4 text-gold-foreground" />
                  <span>{t.exams.cameraRequiredBadge}</span>
                </span>
                {cameraVerified ? (
                  <Badge variant="gold">{t.exams.cameraVerifiedBadge}</Badge>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void requestCameraStream()}
                  >
                    <Camera className="size-3.5" />
                    <span>{t.exams.verifyCameraButton}</span>
                  </Button>
                )}
              </div>

              {cameraError && (
                <p className="text-xs text-destructive">{cameraError}</p>
              )}

              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={
                  cameraActive
                    ? "aspect-video max-h-44 rounded-lg border border-border bg-black object-cover"
                    : "hidden"
                }
              />

              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={cameraConsent}
                  onChange={(e) => setCameraConsent(e.target.checked)}
                />
                <span className="text-foreground">
                  {t.exams.cameraConsentCheckboxLabel}
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={guardianConsent}
                  onChange={(e) => setGuardianConsent(e.target.checked)}
                />
                <span className="text-foreground">
                  {t.exams.guardianConsentCheckboxLabel}
                </span>
              </label>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            {data.latestCompletedAttempt && data.publishedResult ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Award className="size-4 text-gold-foreground" />
                <span>
                  Previous Score:{" "}
                  <strong className="text-foreground">
                    {Number(data.publishedResult.score_percent).toFixed(1)}%
                  </strong>
                </span>
              </div>
            ) : (
              <div />
            )}

            <Button
              variant="gold"
              size="lg"
              disabled={
                isPending ||
                (data.exam.camera_monitoring_enabled &&
                  (!cameraConsent || !guardianConsent))
              }
              onClick={handleStartExam}
            >
              <ShieldCheck className="size-4" />
              <span>{t.exams.confirmStartExamButton}</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
