"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Film,
  FolderOpen,
  Layers,
  MessageSquare,
  PlayCircle,
  Sparkles,
  Star,
  User,
} from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TiltedCard } from "@/components/ui/TiltedCard";
import {
  studentSaveCourseReviewAction,
  studentSaveTeacherReviewAction,
  studentToggleLessonCompletionAction,
} from "@/services/student/actions";
import type { StudentCoursesData } from "@/services/student/queries";

const FALLBACK_COURSE_IMAGE = "/learnix-hero.jpg";

interface MyLearningOrbitClientProps {
  data: StudentCoursesData;
}

export function MyLearningOrbitClient({ data }: MyLearningOrbitClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const selectedCourseId = searchParams.get("courseId") || "";
  const activeCourse = useMemo(
    () => data.enrolledCourses.find((c) => c.id === selectedCourseId) ?? null,
    [data.enrolledCourses, selectedCourseId],
  );

  // Completed-course inline review form state
  const existingCourseRev = useMemo(
    () =>
      activeCourse
        ? data.myCourseReviews.find((r) => r.course_id === activeCourse.id) ??
          null
        : null,
    [activeCourse, data.myCourseReviews],
  );
  const existingTeacherRev = useMemo(
    () =>
      activeCourse
        ? data.myTeacherReviews.find((r) => r.course_id === activeCourse.id) ??
          null
        : null,
    [activeCourse, data.myTeacherReviews],
  );

  const [courseRating, setCourseRating] = useState<number>(
    existingCourseRev?.rating ?? 5,
  );
  const [teacherRating, setTeacherRating] = useState<number>(
    existingTeacherRev?.rating ?? 5,
  );
  const [reviewComment, setReviewComment] = useState<string>(
    existingCourseRev?.comment ?? "",
  );
  const [improvementSuggestions, setImprovementSuggestions] = useState<string>(
    existingCourseRev?.improvement_suggestions ?? "",
  );

  function openCourseWorkspace(courseId: string) {
    const cRev = data.myCourseReviews.find((r) => r.course_id === courseId);
    const tRev = data.myTeacherReviews.find((r) => r.course_id === courseId);
    setCourseRating(cRev?.rating ?? 5);
    setTeacherRating(tRev?.rating ?? 5);
    setReviewComment(cRev?.comment ?? "");
    setImprovementSuggestions(cRev?.improvement_suggestions ?? "");
    router.push(`/student/my-learning?courseId=${courseId}`);
  }

  function handleToggleLessonComplete(
    courseId: string,
    lessonId: string,
    nextCompleted: boolean,
  ) {
    startTransition(async () => {
      const res = await studentToggleLessonCompletionAction({
        courseId,
        lessonId,
        completed: nextCompleted,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        nextCompleted ? "Lesson marked as completed!" : "Lesson marked incomplete.",
      );
      router.refresh();
    });
  }

  function handleSaveCombinedReview() {
    if (!activeCourse) return;
    startTransition(async () => {
      const [cRes, tRes] = await Promise.all([
        studentSaveCourseReviewAction({
          courseId: activeCourse.id,
          rating: courseRating,
          comment: reviewComment,
          improvementSuggestions,
        }),
        studentSaveTeacherReviewAction({
          courseId: activeCourse.id,
          teacherId: activeCourse.teacher_id,
          rating: teacherRating,
          comment: reviewComment,
          improvementSuggestions,
        }),
      ]);

      if (!cRes.ok) {
        toast.error(cRes.error);
        return;
      }
      if (!tRes.ok) {
        toast.error(tRes.error);
        return;
      }

      toast.success("Course and instructor review saved!");
      router.refresh();
    });
  }

  // ---------------------------------------------------------------------------
  // VIEW A: FULL ENROLLED COURSE WORKSPACE (Overview, Sections, Lessons, Videos, PDFs, Resources, Progress, Reviews)
  // ---------------------------------------------------------------------------
  if (activeCourse) {
    const courseChapters = data.chapters.filter(
      (ch) => ch.course_id === activeCourse.id,
    );
    const courseLessons = data.lessons.filter(
      (l) => l.course_id === activeCourse.id,
    );
    const courseResources = data.learningResources.filter(
      (r) => r.courseId === activeCourse.id,
    );
    const completedLessonIds = new Set(
      data.lessonProgress
        .filter((lp) => lp.course_id === activeCourse.id && lp.is_completed)
        .map((lp) => lp.lesson_id),
    );
    const courseReviewsList = data.approvedReviews.filter(
      (r) => r.courseId === activeCourse.id,
    );
    const isCompleted =
      activeCourse.progressPercent >= 100 ||
      activeCourse.enrollmentStatus === "completed";
    const firstIncompleteLesson =
      courseLessons.find((l) => !completedLessonIds.has(l.id)) ??
      courseLessons[0] ??
      null;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/student/my-learning")}
            className="-ml-2"
          >
            <ArrowLeft className="size-4" />
            <span>Back to My Courses</span>
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link
                href={`/messages?userId=${activeCourse.teacher_id}&courseId=${activeCourse.id}`}
              >
                <MessageSquare className="size-3.5 text-gold-foreground" />
                <span>Message Instructor</span>
              </Link>
            </Button>
            {firstIncompleteLesson && (
              <Button asChild variant="gold" size="sm">
                <Link href={`/student/courses/${firstIncompleteLesson.id}`}>
                  <PlayCircle className="size-4" />
                  <span>
                    {completedLessonIds.size > 0
                      ? "Resume Lesson"
                      : "Start First Lesson"}
                  </span>
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Course Overview Header */}
        <Card className="overflow-hidden border-border/70 bg-white/20 backdrop-blur-lg dark:bg-[#121a19]">
          <CardContent className="grid gap-6 p-6 lg:grid-cols-12">
            <div className="lg:col-span-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  activeCourse.thumbnail_url?.trim() || FALLBACK_COURSE_IMAGE
                }
                alt={activeCourse.title}
                className="h-48 w-full rounded-xl border border-border object-cover"
              />
            </div>
            <div className="flex flex-col justify-between gap-4 lg:col-span-8">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="gold-subtle">{activeCourse.category}</Badge>
                  <Badge variant="outline" className="font-mono text-xs">
                    {activeCourse.code}
                  </Badge>
                  {isCompleted && (
                    <Badge variant="gold">
                      <Award className="mr-1 size-3" />
                      Completed
                    </Badge>
                  )}
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {activeCourse.title}
                </h1>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {activeCourse.description ||
                    activeCourse.subtitle ||
                    "Complete the sections, videos, PDFs, and resources below to master this course."}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-muted-foreground">
                    Instructor: <strong className="text-foreground">{activeCourse.teacherName}</strong> •{" "}
                    {completedLessonIds.size}/{courseLessons.length} lessons completed
                  </span>
                  <span className="font-mono font-bold text-emerald-500">
                    {activeCourse.progressPercent}%
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-950">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{
                      width: `${Math.min(100, activeCourse.progressPercent)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sections & Lessons + Supplementary Resources */}
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Layers className="size-4 text-gold-foreground" />
                  <span>
                    Course Sections & Lessons ({courseChapters.length} sections,{" "}
                    {courseLessons.length} lessons)
                  </span>
                </CardTitle>
                <CardDescription>
                  Open videos, PDF documents, and articles, or mark completed lessons to save your progress.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {courseChapters.length === 0 && courseLessons.length === 0 ? (
                  <EmptyState
                    icon={BookOpen}
                    title="Curriculum in preparation"
                    description="Your instructor has not published lessons in this course yet."
                  />
                ) : (
                  courseChapters.map((chapter) => {
                    const chLessons = courseLessons.filter(
                      (l) => l.chapter_id === chapter.id,
                    );
                    return (
                      <div
                        key={chapter.id}
                        className="rounded-xl border border-border/80 bg-card/60 p-4"
                      >
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-bold text-foreground">
                              Section {chapter.position}: {chapter.title}
                            </h3>
                            {chapter.description && (
                              <p className="text-xs text-muted-foreground">
                                {chapter.description}
                              </p>
                            )}
                          </div>
                          <Badge variant="outline" className="text-[11px]">
                            {chLessons.length} lessons
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          {chLessons.map((lesson) => {
                            const done = completedLessonIds.has(lesson.id);
                            const TypeIcon =
                              lesson.content_type === "video"
                                ? Film
                                : FileText;
                            return (
                              <div
                                key={lesson.id}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/60 p-3 text-xs"
                              >
                                <div className="flex min-w-0 items-center gap-3">
                                  <button
                                    type="button"
                                    disabled={isPending}
                                    onClick={() =>
                                      handleToggleLessonComplete(
                                        activeCourse.id,
                                        lesson.id,
                                        !done,
                                      )
                                    }
                                    title={
                                      done
                                        ? "Completed — click to undo"
                                        : "Mark lesson as completed"
                                    }
                                    className="shrink-0 text-emerald-500 transition-transform hover:scale-110"
                                  >
                                    {done ? (
                                      <CheckCircle2 className="size-5 fill-emerald-500/20" />
                                    ) : (
                                      <Circle className="size-5 text-muted-foreground hover:text-emerald-500" />
                                    )}
                                  </button>
                                  <div className="min-w-0">
                                    <p className="truncate font-semibold text-foreground">
                                      {lesson.position}. {lesson.title}
                                    </p>
                                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                                      <span className="inline-flex items-center gap-1 capitalize">
                                        <TypeIcon className="size-3 text-gold-foreground" />
                                        {lesson.content_type}
                                      </span>
                                      {lesson.duration_seconds > 0 && (
                                        <span>
                                          • {Math.max(1, Math.round(lesson.duration_seconds / 60))} min
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <Button asChild variant="gold-outline" size="sm">
                                  <Link href={`/student/courses/${lesson.id}`}>
                                    <span>Open Lesson</span>
                                    <ArrowRight className="size-3.5" />
                                  </Link>
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Learning Resources + Course Review Form on Completion */}
          <div className="space-y-6 lg:col-span-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FolderOpen className="size-4 text-gold-foreground" />
                  <span>Learning Resources ({courseResources.length})</span>
                </CardTitle>
                <CardDescription>
                  Downloadable PDFs, slides, reference links, and study files.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5 text-xs">
                {courseResources.length === 0 ? (
                  <p className="text-muted-foreground">
                    Lesson-specific PDFs and videos are available inside each lesson viewer.
                  </p>
                ) : (
                  courseResources.map((res) => {
                    const href = res.signedUrl || res.externalUrl;
                    return (
                      <div
                        key={res.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border/70 p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">
                            {res.title}
                          </p>
                          <p className="text-[11px] capitalize text-muted-foreground">
                            {res.resourceType}
                            {res.description ? ` • ${res.description}` : ""}
                          </p>
                        </div>
                        {href && (
                          <Button asChild variant="outline" size="sm">
                            <a href={href} target="_blank" rel="noreferrer">
                              {res.signedUrl ? (
                                <Download className="size-3.5" />
                              ) : (
                                <ExternalLink className="size-3.5" />
                              )}
                            </a>
                          </Button>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* Student Course & Teacher Review Form (Shown when course is 100% completed!) */}
            {isCompleted ? (
              <Card className="border-emerald-500/50 bg-emerald-500/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Star className="size-4 fill-amber-400 text-amber-400" />
                    <span>
                      {existingCourseRev
                        ? "Edit Your Course & Teacher Review"
                        : "Rate This Course & Instructor"}
                    </span>
                  </CardTitle>
                  <CardDescription>
                    Congratulations on completing 100% of this course! Share your rating and optional improvement suggestions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <Label>Course Rating (1 to 5)</Label>
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4, 5].map((st) => (
                        <Button
                          key={st}
                          type="button"
                          size="sm"
                          variant={courseRating >= st ? "gold" : "outline"}
                          onClick={() => setCourseRating(st)}
                        >
                          ★ {st}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>
                      Instructor Rating ({activeCourse.teacherName})
                    </Label>
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4, 5].map((st) => (
                        <Button
                          key={st}
                          type="button"
                          size="sm"
                          variant={teacherRating >= st ? "gold" : "outline"}
                          onClick={() => setTeacherRating(st)}
                        >
                          ★ {st}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Written Comment</Label>
                    <Textarea
                      rows={3}
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="What did you enjoy most about this course and instructor?"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Optional Improvement Suggestions</Label>
                    <Textarea
                      rows={2}
                      value={improvementSuggestions}
                      onChange={(e) =>
                        setImprovementSuggestions(e.target.value)
                      }
                      placeholder="Any topics or resources that could make this course even better?"
                    />
                  </div>

                  <Button
                    variant="gold"
                    size="sm"
                    disabled={isPending}
                    onClick={handleSaveCombinedReview}
                    className="w-full justify-center"
                  >
                    {existingCourseRev ? "Update Review" : "Submit Review"}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Star className="size-4 text-gold-foreground" />
                    <span>Course Reviews ({courseReviewsList.length})</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Complete 100% of lessons ({activeCourse.progressPercent}% done) to unlock the course rating form.
                  </CardDescription>
                </CardHeader>
                {courseReviewsList.length > 0 && (
                  <CardContent className="space-y-2 text-xs">
                    {courseReviewsList.slice(0, 4).map((rev) => (
                      <div
                        key={rev.id}
                        className="rounded-lg border border-border/70 p-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">
                            {rev.studentName}
                          </span>
                          <span className="text-amber-500">
                            {"★".repeat(rev.rating)}
                          </span>
                        </div>
                        {rev.comment && (
                          <p className="mt-1 text-muted-foreground">
                            {rev.comment}
                          </p>
                        )}
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VIEW B: MY ENROLLED COURSES GRID (ONLY STUDENT'S OWN COURSES)
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#10b981]/40 bg-[#10b981]/10 px-3 py-1 text-xs font-semibold text-[#10b981]">
            <BookOpen className="size-3.5" aria-hidden="true" />
            <span>My Courses ({data.enrolledCourses.length})</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            My Enrolled Courses
          </h1>
        </div>

        <Button
          asChild
          variant="outline"
          size="sm"
          className="bg-white/20 backdrop-blur-md dark:bg-[#121a19]"
        >
          <Link href="/student/courses">
            <BookOpen className="size-4 text-[#10b981]" aria-hidden="true" />
            <span>Explore Courses</span>
          </Link>
        </Button>
      </div>

      {data.enrolledCourses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No Enrolled Courses"
          description="You are not enrolled in any courses yet. Explore the course catalog to enroll."
          actions={
            <Button asChild variant="gold" size="sm">
              <Link href="/student/courses">
                <Sparkles className="size-4" aria-hidden="true" />
                <span>Explore Courses</span>
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {data.enrolledCourses.map((course) => {
            const chaptersCount = data.chapters.filter(
              (ch) => ch.course_id === course.id,
            ).length;
            const lessonsCount = data.lessons.filter(
              (l) => l.course_id === course.id,
            ).length;
            const isCompleted =
              course.progressPercent >= 100 ||
              course.enrollmentStatus === "completed";
            const thumb =
              course.thumbnail_url && course.thumbnail_url.trim()
                ? course.thumbnail_url.trim()
                : FALLBACK_COURSE_IMAGE;

            return (
              <div
                key={course.id}
                className="perspective-1000 h-[400px] w-full"
              >
                <TiltedCard
                  imageSrc={thumb}
                  altText={course.title}
                  containerHeight="100%"
                  containerWidth="100%"
                  imageHeight="100%"
                  imageWidth="100%"
                  rotateAmplitude={8}
                  scaleOnHover={1.02}
                  showTooltip={false}
                  displayOverlayContent={true}
                  overlayContent={
                    <div className="flex h-full w-full flex-col justify-between bg-gradient-to-t from-black/85 via-black/25 to-transparent p-6 text-white backdrop-blur-[2px]">
                      <div className="flex items-start justify-between">
                        <Badge className="border border-[#10b981]/60 bg-white/10 font-mono text-[10px] font-semibold text-[#10b981] backdrop-blur-md">
                          {course.code}
                        </Badge>
                        <Badge
                          variant={isCompleted ? "gold" : "outline"}
                          className={
                            isCompleted
                              ? ""
                              : "border-white/25 bg-white/10 text-white backdrop-blur-md"
                          }
                        >
                          {isCompleted && (
                            <CheckCircle2 className="mr-1 size-3" />
                          )}
                          {course.progressPercent}%
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <h3 className="line-clamp-2 text-xl font-bold">
                          {course.title}
                        </h3>
                        <p className="flex items-center gap-1.5 text-xs text-white/80">
                          <User className="size-3.5" /> {course.teacherName}
                        </p>
                      </div>
                    </div>
                  }
                  backContent={
                    <div className="flex h-full w-full flex-col justify-between rounded-2xl border border-white/20 bg-white/20 p-6 text-foreground backdrop-blur-lg dark:border-[#353644] dark:bg-[#121a19]">
                      <div className="space-y-3">
                        <Badge variant="gold-subtle">{course.category}</Badge>
                        <h3 className="line-clamp-2 text-lg font-bold">
                          {course.title}
                        </h3>
                        <p className="line-clamp-4 text-sm text-muted-foreground">
                          {course.description ||
                            course.subtitle ||
                            "Structured sections, lessons, videos, PDFs, and resources."}
                        </p>
                      </div>
                      <div className="space-y-4 border-t border-white/20 pt-4 dark:border-[#353644]">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Layers className="size-3.5 text-[#10b981]" />
                            {chaptersCount} Sections • {lessonsCount} Lessons
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="size-3.5 text-[#10b981]" />
                            {Number(course.estimated_hours ?? 0)}h
                          </span>
                        </div>
                        <Button
                          type="button"
                          data-no-flip="true"
                          onClick={(e) => {
                            e.stopPropagation();
                            openCourseWorkspace(course.id);
                          }}
                          variant="gold"
                          className="w-full justify-center gap-2"
                        >
                          <PlayCircle className="size-4" />
                          <span>
                            {isCompleted ? "Open & Review Course" : "Open Course"}
                          </span>
                          <ArrowRight className="ml-1 size-4" />
                        </Button>
                      </div>
                    </div>
                  }
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
