"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Film,
  HelpCircle,
  NotebookPen,
  PlayCircle,
  Trash2,
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
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getStudentDictionary } from "@/i18n/student-dictionaries";
import {
  studentDeleteLessonNoteAction,
  studentSaveLessonNoteAction,
  studentToggleFavoriteLessonAction,
  studentUpdateLessonProgressAction,
} from "@/services/student/actions";
import type { StudentLessonViewerData } from "@/services/student/queries";

interface StudentLessonViewerClientProps {
  data: StudentLessonViewerData;
}

export function StudentLessonViewerClient({
  data,
}: StudentLessonViewerClientProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const t = getStudentDictionary(locale);
  const [isPending, startTransition] = useTransition();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastTrackedSecondRef = useRef<number>(
    Number(data.progress?.last_position_seconds ?? 0),
  );
  const [activeTab, setActiveTab] = useState<
    "overview" | "notes" | "quiz" | "related"
  >("overview");
  const [resumePosition, setResumePosition] = useState(
    String(data.progress?.last_position_seconds ?? 0),
  );
  const [noteContent, setNoteContent] = useState("");
  const [noteTimestamp, setNoteTimestamp] = useState(
    String(data.progress?.last_position_seconds ?? 0),
  );

  function handleVideoLoadedMetadata() {
    const startSec = Number(data.progress?.last_position_seconds ?? 0);
    if (videoRef.current && startSec > 0) {
      videoRef.current.currentTime = startSec;
    }
  }

  function handleSaveResumePosition(markComplete = false) {
    const currentVideoSec = videoRef.current
      ? Math.round(videoRef.current.currentTime)
      : Number(resumePosition) || 0;

    startTransition(async () => {
      const res = await studentUpdateLessonProgressAction({
        courseId: data.course.id,
        lessonId: data.lesson.id,
        lastPositionSeconds: currentVideoSec,
        watchedSecondsDelta: 120,
        isCompleted: markComplete,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success(
        markComplete
          ? t.lessonViewer.lessonCompletedToast
          : t.lessonViewer.positionSavedToast,
      );
      router.refresh();
    });
  }

  function handleToggleFavorite() {
    startTransition(async () => {
      const res = await studentToggleFavoriteLessonAction({
        courseId: data.course.id,
        lessonId: data.lesson.id,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t.courses.favoritedToast);
      router.refresh();
    });
  }

  function handleSaveNote() {
    startTransition(async () => {
      const res = await studentSaveLessonNoteAction({
        lessonId: data.lesson.id,
        content: noteContent,
        videoTimestampSeconds: Number(noteTimestamp) || 0,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t.lessonViewer.noteSavedToast);
      setNoteContent("");
      router.refresh();
    });
  }

  function handleDeleteNote(noteId: string) {
    startTransition(async () => {
      const res = await studentDeleteLessonNoteAction({
        noteId,
        lessonId: data.lesson.id,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t.lessonViewer.noteDeletedToast);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Top Bar: Breadcrumb & Completion / Favorite Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/student/courses">
              <ArrowLeft className="size-4" />
              <span>{t.lessonViewer.backToCourses}</span>
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {data.course.code}
            </Badge>
            {data.chapter && (
              <Badge variant="outline">
                {t.lessonViewer.chapterLabel} #{data.chapter.position}:{" "}
                {data.chapter.title}
              </Badge>
            )}
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {data.lesson.position}. {data.lesson.title}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={data.isFavorited ? "gold" : "outline"}
            size="sm"
            disabled={isPending}
            onClick={handleToggleFavorite}
          >
            <Bookmark className="size-3.5" />
            <span>
              {data.isFavorited
                ? t.courses.unfavoriteButton
                : t.courses.favoriteButton}
            </span>
          </Button>

          {data.progress?.is_completed ? (
            <Badge variant="gold" className="gap-1.5 px-3 py-1.5">
              <CheckCircle2 className="size-3.5" />
              <span>{t.lessonViewer.completedBadge}</span>
            </Badge>
          ) : (
            <Button
              variant="gold"
              size="sm"
              disabled={isPending}
              onClick={() => handleSaveResumePosition(true)}
            >
              <CheckCircle2 className="size-4" />
              <span>{t.lessonViewer.markCompleteButton}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Split View: Media Player & Tabs on Left, Curriculum Outline on Right */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          {/* Video / Media Stage */}
          <Card className="overflow-hidden border-border/80">
            <CardContent className="p-0">
              {data.signedVideoUrl ? (
                <video
                  ref={videoRef}
                  src={data.signedVideoUrl}
                  controls
                  onLoadedMetadata={handleVideoLoadedMetadata}
                  onTimeUpdate={() => {
                    if (videoRef.current) {
                      const sec = Math.round(videoRef.current.currentTime);
                      if (sec !== lastTrackedSecondRef.current) {
                        lastTrackedSecondRef.current = sec;
                        setResumePosition(String(sec));
                        setNoteTimestamp(String(sec));
                      }
                    }
                  }}
                  className="aspect-video w-full bg-black"
                />
              ) : (
                <div className="flex aspect-video flex-col items-center justify-center gap-3 bg-gradient-to-br from-charcoal to-black p-6 text-center text-white">
                  <Film className="size-10 text-gold-highlight" />
                  <div className="max-w-md space-y-1">
                    <p className="text-base font-semibold">
                      {data.lesson.title}
                    </p>
                    <p className="text-xs text-neutral-300">
                      {data.lesson.summary ||
                        "Interactive lesson stage. Use the controls below to save your timestamp or download attached learning materials."}
                    </p>
                  </div>
                </div>
              )}

              {/* Video Resume Position Saver Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-muted/40 p-3 text-xs">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-gold-foreground" />
                  <span>{t.courses.resumeFromSecondLabel} (sec):</span>
                  <Input
                    type="number"
                    value={resumePosition}
                    onChange={(e) => setResumePosition(e.target.value)}
                    className="h-8 w-24 font-mono text-xs"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleSaveResumePosition(false)}
                >
                  {t.lessonViewer.saveResumePositionButton}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Previous / Next Lesson Navigation */}
          <div className="flex items-center justify-between gap-2">
            {data.previousLessonId ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/student/courses/${data.previousLessonId}`}>
                  <ArrowLeft className="size-3.5" />
                  <span>{t.lessonViewer.previousLesson}</span>
                </Link>
              </Button>
            ) : (
              <div />
            )}

            {data.nextLessonId && (
              <Button asChild variant="gold" size="sm">
                <Link href={`/student/courses/${data.nextLessonId}`}>
                  <span>{t.lessonViewer.nextLesson}</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            )}
          </div>

          {/* Lesson Tabs: Overview & Attachments, Notes, Practice Quiz, Related Lessons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={activeTab === "overview" ? "gold" : "outline"}
              size="sm"
              onClick={() => setActiveTab("overview")}
            >
              {t.lessonViewer.tabOverviewMaterials}
            </Button>
            <Button
              variant={activeTab === "notes" ? "gold" : "outline"}
              size="sm"
              onClick={() => setActiveTab("notes")}
            >
              {t.lessonViewer.tabPersonalNotes} ({data.notes.length})
            </Button>
            <Button
              variant={activeTab === "quiz" ? "gold" : "outline"}
              size="sm"
              onClick={() => setActiveTab("quiz")}
            >
              {t.lessonViewer.tabPracticeQuiz}
            </Button>
            <Button
              variant={activeTab === "related" ? "gold" : "outline"}
              size="sm"
              onClick={() => setActiveTab("related")}
            >
              {t.lessonViewer.tabRelatedLessons}
            </Button>
          </div>

          {activeTab === "overview" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{data.lesson.title}</CardTitle>
                {data.lesson.summary && (
                  <CardDescription>{data.lesson.summary}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="whitespace-pre-wrap rounded-lg border border-border/70 bg-muted/30 p-4 text-xs leading-relaxed text-foreground">
                  {data.lesson.content_markdown ||
                    data.lesson.summary ||
                    "Review the lesson lecture and attached materials below."}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {data.signedAttachmentUrl && (
                    <Button asChild variant="gold" size="sm">
                      <a
                        href={data.signedAttachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Download className="size-3.5" />
                        <span>{t.lessonViewer.downloadAttachmentButton}</span>
                      </a>
                    </Button>
                  )}

                  {data.lesson.external_resource_url && (
                    <Button asChild variant="outline" size="sm">
                      <a
                        href={data.lesson.external_resource_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="size-3.5" />
                        <span>{t.lessonViewer.openExternalResourceButton}</span>
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "notes" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t.lessonViewer.addNoteTitle}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label>{t.lessonViewer.noteTimestampLabel}</Label>
                    <Input
                      type="number"
                      value={noteTimestamp}
                      onChange={(e) => setNoteTimestamp(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-3">
                    <Label>{t.lessonViewer.tabPersonalNotes}</Label>
                    <Textarea
                      rows={3}
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      placeholder={t.lessonViewer.notePlaceholder}
                    />
                  </div>
                </div>

                <Button
                  variant="gold"
                  size="sm"
                  disabled={isPending}
                  onClick={handleSaveNote}
                >
                  <NotebookPen className="size-3.5" />
                  <span>{t.lessonViewer.saveNoteButton}</span>
                </Button>

                <div className="space-y-2.5 pt-2">
                  {data.notes.length === 0 ? (
                    <EmptyState
                      icon={NotebookPen}
                      title={t.common.noRecordsTitle}
                      description="Your private timestamped lesson notes are saved securely to your student account."
                    />
                  ) : (
                    data.notes.map((note) => (
                      <div
                        key={note.id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-border/80 p-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {note.video_timestamp_seconds !== null && (
                              <Badge variant="gold" className="font-mono">
                                @{note.video_timestamp_seconds}s
                              </Badge>
                            )}
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {note.created_at.slice(0, 16).replace("T", " ")}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap text-foreground">
                            {note.content}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleDeleteNote(note.id)}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "quiz" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t.lessonViewer.practiceQuizHeading}
                </CardTitle>
                <CardDescription>
                  {t.lessonViewer.practiceQuizDescription}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                {data.practiceQuizzes.length === 0 ? (
                  <div className="space-y-3 rounded-lg border border-border/80 p-4">
                    <p className="text-muted-foreground">
                      Need extra practice on <strong>{data.lesson.title}</strong>?
                      Open the AI Study Assistant to generate an instant practice quiz for this lesson.
                    </p>
                    <Button asChild variant="gold" size="sm">
                      <Link href="/student/ai-assistant">
                        <HelpCircle className="size-3.5" />
                        <span>Open AI Practice Quiz Generator</span>
                      </Link>
                    </Button>
                  </div>
                ) : (
                  data.practiceQuizzes.map((qz) => (
                    <div
                      key={qz.id}
                      className="flex items-center justify-between rounded-lg border border-border/80 p-3"
                    >
                      <div>
                        <p className="font-semibold text-foreground">
                          {qz.title}
                        </p>
                        <p className="text-muted-foreground">
                          {qz.summary || "Post-Lesson Quiz"}
                        </p>
                      </div>
                      <Button asChild variant="gold" size="sm">
                        <Link href={`/student/courses/${qz.id}`}>
                          Open Quiz
                        </Link>
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === "related" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t.lessonViewer.tabRelatedLessons}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-xs">
                {data.relatedLessons.length === 0 ? (
                  <p className="text-muted-foreground">
                    No other lessons in this chapter.
                  </p>
                ) : (
                  data.relatedLessons.map((rel) => (
                    <div
                      key={rel.id}
                      className="flex items-center justify-between rounded-lg border border-border/80 p-3"
                    >
                      <div>
                        <p className="font-semibold text-foreground">
                          {rel.position}. {rel.title}
                        </p>
                        <p className="text-muted-foreground">
                          {rel.content_type.toUpperCase()}
                        </p>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/student/courses/${rel.id}`}>
                          <PlayCircle className="size-3.5" />
                          <span>{t.common.open}</span>
                        </Link>
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Full Course Lesson Outline */}
        <Card className="h-fit lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-sm">{data.course.title}</CardTitle>
            <CardDescription className="text-xs">
              {data.courseLessons.length} {t.courses.lessonsCountLabel}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {data.courseLessons.map((item) => {
              const isCurrent = item.id === data.lesson.id;
              const prog = data.courseLessonProgress.find(
                (p) => p.lesson_id === item.id,
              );

              return (
                <Link
                  key={item.id}
                  href={`/student/courses/${item.id}`}
                  className={
                    isCurrent
                      ? "flex items-center justify-between rounded-lg border border-gold-primary bg-gold-primary/10 p-2.5 font-semibold text-foreground"
                      : "flex items-center justify-between rounded-lg border border-border/70 p-2.5 text-muted-foreground hover:bg-muted/50"
                  }
                >
                  <span className="truncate">
                    {item.position}. {item.title}
                  </span>
                  {prog?.is_completed ? (
                    <CheckCircle2 className="size-4 shrink-0 text-gold-foreground" />
                  ) : (
                    <FileText className="size-3.5 shrink-0 opacity-60" />
                  )}
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
