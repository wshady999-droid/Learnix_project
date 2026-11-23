"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Bookmark,
  BookOpen,
  CheckCircle2,
  FileText,
  Film,
  HelpCircle,
  Layers,
  PlayCircle,
  Presentation,
  Search,
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
import { Input, fieldBase } from "@/components/ui/input";
import { getStudentDictionary } from "@/i18n/student-dictionaries";
import { cn } from "@/lib/utils";
import {
  studentEnrollInCourseAction,
  studentToggleFavoriteLessonAction,
} from "@/services/student/actions";
import type { StudentCoursesData } from "@/services/student/queries";

interface StudentCoursesClientProps {
  data: StudentCoursesData;
}

export function StudentCoursesClient({ data }: StudentCoursesClientProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const t = getStudentDictionary(locale);
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<
    "enrolled" | "catalog" | "favorites"
  >("enrolled");
  const [search, setSearch] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    data.enrolledCourses[0]?.id ?? "",
  );

  const activeCourseId = selectedCourseId || data.enrolledCourses[0]?.id || "";
  const progressMap = useMemo(
    () => new Map(data.lessonProgress.map((p) => [p.lesson_id, p])),
    [data.lessonProgress],
  );
  const favoriteLessonIds = useMemo(
    () =>
      new Set(
        data.favorites
          .map((f) => f.lesson_id)
          .filter((id): id is string => Boolean(id)),
      ),
    [data.favorites],
  );

  const filteredEnrolledCourses = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.enrolledCourses;
    return data.enrolledCourses.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (c.subtitle ?? "").toLowerCase().includes(q),
    );
  }, [data.enrolledCourses, search]);

  const activeCourseChapters = useMemo(
    () => data.chapters.filter((ch) => ch.course_id === activeCourseId),
    [data.chapters, activeCourseId],
  );

  const activeCourseLessons = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data.lessons.filter((l) => l.course_id === activeCourseId);
    if (!q) return list;
    return list.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        (l.summary ?? "").toLowerCase().includes(q),
    );
  }, [data.lessons, activeCourseId, search]);

  const favoritedLessons = useMemo(
    () => data.lessons.filter((l) => favoriteLessonIds.has(l.id)),
    [data.lessons, favoriteLessonIds],
  );

  function handleEnroll(courseId: string) {
    startTransition(async () => {
      const res = await studentEnrollInCourseAction({ courseId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t.common.enrolledToast);
      setSelectedCourseId(courseId);
      setActiveTab("enrolled");
      router.refresh();
    });
  }

  function handleToggleFavorite(courseId: string, lessonId: string) {
    startTransition(async () => {
      const res = await studentToggleFavoriteLessonAction({
        courseId,
        lessonId,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t.courses.favoritedToast);
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t.courses.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.courses.subtitle}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={activeTab === "enrolled" ? "gold" : "outline"}
            size="sm"
            onClick={() => setActiveTab("enrolled")}
          >
            {t.courses.tabEnrolled} ({data.enrolledCourses.length})
          </Button>
          <Button
            variant={activeTab === "catalog" ? "gold" : "outline"}
            size="sm"
            onClick={() => setActiveTab("catalog")}
          >
            {t.courses.tabCatalog} ({data.availablePublishedCourses.length})
          </Button>
          <Button
            variant={activeTab === "favorites" ? "gold" : "outline"}
            size="sm"
            onClick={() => setActiveTab("favorites")}
          >
            {t.courses.tabFavorites} ({favoritedLessons.length})
          </Button>
        </div>

        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.courses.searchCourseContentPlaceholder}
            className="pl-9"
          />
        </div>
      </div>

      {/* TAB 1: ENROLLED COURSES & CHAPTER / LESSON EXPLORER */}
      {activeTab === "enrolled" && (
        <div className="space-y-6">
          {filteredEnrolledCourses.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title={t.common.noRecordsTitle}
              description={t.common.noRecordsDescription}
              actions={
                <Button
                  variant="gold"
                  size="sm"
                  onClick={() => setActiveTab("catalog")}
                >
                  {t.courses.tabCatalog}
                </Button>
              }
            />
          ) : (
            <>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {filteredEnrolledCourses.map((course) => {
                  const isSelected = course.id === activeCourseId;
                  const chCount = data.chapters.filter(
                    (ch) => ch.course_id === course.id,
                  ).length;
                  const lCount = data.lessons.filter(
                    (l) => l.course_id === course.id,
                  ).length;
                  const firstLesson = data.lessons.find(
                    (l) => l.course_id === course.id,
                  );

                  return (
                    <Card
                      key={course.id}
                      className={
                        isSelected
                          ? "border-gold-primary/60 shadow-md"
                          : "border-border/80"
                      }
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            {course.code}
                          </Badge>
                          <Badge
                            variant={
                              course.progressPercent >= 100
                                ? "gold"
                                : "outline"
                            }
                          >
                            {course.progressPercent}%
                          </Badge>
                        </div>
                        <CardTitle className="mt-2 text-base">
                          {course.title}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {course.teacherName}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3 text-xs">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-gold-metallic transition-all"
                            style={{
                              width: `${Math.min(100, course.progressPercent)}%`,
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>
                            {chCount} {t.courses.chaptersCountLabel}
                          </span>
                          <span>
                            {lCount} {t.courses.lessonsCountLabel}
                          </span>
                        </div>
                      </CardContent>
                      <CardFooter className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                        <Button
                          variant={isSelected ? "gold" : "outline"}
                          size="sm"
                          onClick={() => setSelectedCourseId(course.id)}
                        >
                          <Layers className="size-3.5" />
                          <span>Browse Chapters</span>
                        </Button>
                        {firstLesson && (
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/student/courses/${firstLesson.id}`}>
                              <PlayCircle className="size-3.5" />
                              <span>{t.common.open}</span>
                            </Link>
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>

              {/* Chapter & Lesson Accordion Explorer */}
              <Card>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {t.courses.selectCoursePrompt}
                    </CardTitle>
                  </div>
                  <select
                    className={cn(fieldBase, "h-9 w-72")}
                    value={activeCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                  >
                    {data.enrolledCourses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.title}
                      </option>
                    ))}
                  </select>
                </CardHeader>
                <CardContent className="space-y-4">
                  {activeCourseChapters.length === 0 ? (
                    <EmptyState
                      icon={Layers}
                      title={t.common.noRecordsTitle}
                      description="No published chapters in this course yet."
                    />
                  ) : (
                    activeCourseChapters.map((chapter) => {
                      const lessonsInChapter = activeCourseLessons.filter(
                        (l) => l.chapter_id === chapter.id,
                      );

                      return (
                        <div
                          key={chapter.id}
                          className="rounded-xl border border-border/80 bg-card/60 p-4"
                        >
                          <div className="border-b border-border/60 pb-2.5">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="font-mono text-xs"
                              >
                                #{chapter.position}
                              </Badge>
                              <h3 className="font-semibold text-foreground">
                                {chapter.title}
                              </h3>
                            </div>
                            {chapter.description && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {chapter.description}
                              </p>
                            )}
                          </div>

                          <div className="mt-3 space-y-2">
                            {lessonsInChapter.map((lesson) => {
                              const prog = progressMap.get(lesson.id);
                              const isFav = favoriteLessonIds.has(lesson.id);

                              return (
                                <div
                                  key={lesson.id}
                                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/80 p-3 text-xs"
                                >
                                  <div className="flex items-center gap-2.5">
                                    {lesson.content_type === "video" && (
                                      <Film className="size-4 text-gold-foreground" />
                                    )}
                                    {lesson.content_type === "pdf" && (
                                      <FileText className="size-4 text-gold-foreground" />
                                    )}
                                    {lesson.content_type === "presentation" && (
                                      <Presentation className="size-4 text-gold-foreground" />
                                    )}
                                    {lesson.content_type === "article" && (
                                      <BookOpen className="size-4 text-gold-foreground" />
                                    )}
                                    {lesson.content_type === "quiz" && (
                                      <HelpCircle className="size-4 text-gold-foreground" />
                                    )}
                                    <div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-semibold text-foreground">
                                          {lesson.position}. {lesson.title}
                                        </span>
                                        <Badge
                                          variant="outline"
                                          className="uppercase"
                                        >
                                          {lesson.content_type}
                                        </Badge>
                                        {prog?.is_completed && (
                                          <Badge variant="gold">
                                            <CheckCircle2 className="mr-1 size-3" />
                                            {t.common.completed}
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="mt-0.5 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                                        <span>
                                          {Math.max(
                                            1,
                                            Math.round(
                                              lesson.duration_seconds / 60,
                                            ),
                                          )}{" "}
                                          min
                                        </span>
                                        {prog &&
                                          prog.last_position_seconds > 0 && (
                                            <span className="font-mono text-gold-foreground">
                                              {t.courses.resumeFromSecondLabel}{" "}
                                              {prog.last_position_seconds}s
                                            </span>
                                          )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant={isFav ? "gold" : "ghost"}
                                      size="sm"
                                      disabled={isPending}
                                      onClick={() =>
                                        handleToggleFavorite(
                                          lesson.course_id,
                                          lesson.id,
                                        )
                                      }
                                    >
                                      <Bookmark className="size-3.5" />
                                    </Button>
                                    <Button asChild variant="gold" size="sm">
                                      <Link
                                        href={`/student/courses/${lesson.id}`}
                                      >
                                        <PlayCircle className="size-3.5" />
                                        <span>
                                          {t.courses.openLessonViewerButton}
                                        </span>
                                      </Link>
                                    </Button>
                                  </div>
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
            </>
          )}
        </div>
      )}

      {/* TAB 2: AVAILABLE PUBLISHED COURSES CATALOG */}
      {activeTab === "catalog" && (
        <div>
          {data.availablePublishedCourses.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title={t.common.noRecordsTitle}
              description="You are enrolled in all currently published courses."
            />
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {data.availablePublishedCourses.map((course) => (
                <Card key={course.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="font-mono text-xs">
                        {course.code}
                      </Badge>
                      <Badge variant="gold">{course.estimated_hours}h</Badge>
                    </div>
                    <CardTitle className="mt-2 text-base">
                      {course.title}
                    </CardTitle>
                    <CardDescription>{course.teacherName}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    <p className="line-clamp-3">
                      {course.subtitle ||
                        course.description ||
                        "Published academic course."}
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button
                      variant="gold"
                      size="sm"
                      className="w-full"
                      disabled={isPending}
                      onClick={() => handleEnroll(course.id)}
                    >
                      {t.common.enrollNow}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SAVED FAVORITE LESSONS */}
      {activeTab === "favorites" && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            {favoritedLessons.length === 0 ? (
              <EmptyState
                icon={Bookmark}
                title={t.common.noRecordsTitle}
                description="Click the bookmark icon on any lesson to save it here for quick revision."
              />
            ) : (
              favoritedLessons.map((lesson) => (
                <div
                  key={lesson.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/80 p-3 text-xs"
                >
                  <div>
                    <p className="font-semibold text-foreground">
                      {lesson.title}
                    </p>
                    <p className="text-muted-foreground">
                      {lesson.summary || lesson.content_type}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={() =>
                        handleToggleFavorite(lesson.course_id, lesson.id)
                      }
                    >
                      <Bookmark className="size-3.5 text-gold-foreground" />
                    </Button>
                    <Button asChild variant="gold" size="sm">
                      <Link href={`/student/courses/${lesson.id}`}>
                        <PlayCircle className="size-3.5" />
                        <span>{t.courses.openLessonViewerButton}</span>
                      </Link>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
