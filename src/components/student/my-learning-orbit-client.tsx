"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Layers,
  Orbit,
  PlayCircle,
  RefreshCw,
  Sparkles,
  User,
  ArrowRight,
  Tag,
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import OrbitImages from "@/components/ui/OrbitImages";
import { TiltedCard } from "@/components/ui/TiltedCard";
import { getStudentDictionary } from "@/i18n/student-dictionaries";
import type { StudentCoursesData } from "@/services/student/queries";

const FALLBACK_COURSE_IMAGE = "/learnix-hero.jpg";

export interface EnrolledOrbitCourse {
  id: string;
  code: string;
  title: string;
  subtitle: string | null;
  category: string;
  thumbnailUrl: string;
  teacherName: string;
  progressPercent: number;
  enrollmentStatus: string;
  estimatedHours: number;
  chaptersCount: number;
  lessonsCount: number;
  firstLessonId: string | null;
  description?: string;
}

interface MyLearningOrbitClientProps {
  data: StudentCoursesData;
}

export function MyLearningOrbitClient({ data }: MyLearningOrbitClientProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const t = getStudentDictionary(locale);

  const enrolledCourses = useMemo<EnrolledOrbitCourse[]>(() => {
    return data.enrolledCourses.map((course) => {
      const chaptersCount = data.chapters.filter(
        (ch) => ch.course_id === course.id,
      ).length;
      const courseLessons = data.lessons.filter(
        (l) => l.course_id === course.id,
      );
      const firstLesson = courseLessons[0] ?? null;
      const thumb =
        course.thumbnail_url && course.thumbnail_url.trim()
          ? course.thumbnail_url.trim()
          : FALLBACK_COURSE_IMAGE;

      return {
        id: course.id,
        code: course.code,
        title: course.title,
        subtitle: course.subtitle,
        category: course.category || "General",
        thumbnailUrl: thumb,
        teacherName: course.teacherName || "Learnix Instructor",
        progressPercent: Number(course.progressPercent ?? 0),
        enrollmentStatus: course.enrollmentStatus,
        estimatedHours: Number(course.estimated_hours ?? 0),
        chaptersCount,
        lessonsCount: courseLessons.length,
        firstLessonId: firstLesson?.id ?? null,
        description: course.subtitle || "No description available.",
      };
    });
  }, [data.enrolledCourses, data.chapters, data.lessons]);

  const [selectedCourse, setSelectedCourse] = useState<EnrolledOrbitCourse | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [orbitResetKey, setOrbitResetKey] = useState(0);

  const orbitImageUrls = useMemo(
    () => enrolledCourses.map((course) => course.thumbnailUrl),
    [enrolledCourses],
  );

  const handleItemClick = (index: number) => {
    const course = enrolledCourses[index];
    if (course) {
      setSelectedCourse(course);
      setDialogOpen(true);
    }
  };

  const handleContinue = () => {
    if (selectedCourse) {
      const continueHref = selectedCourse.firstLessonId
        ? `/student/courses/${selectedCourse.firstLessonId}`
        : `/student/courses?courseId=${selectedCourse.id}`;
      router.push(continueHref);
      setDialogOpen(false);
    }
  };

  const handleResetOrbit = () => {
    setOrbitResetKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#C99A22]/40 bg-[#C99A22]/10 px-3 py-1 text-xs font-semibold text-[#C99A22]">
            <Orbit className="size-3.5" aria-hidden="true" />
            <span>My Learning Orbit</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            My Enrolled Courses
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your active curriculum orbit and lesson progress across enrolled courses.
          </p>
        </div>

        <Button asChild variant="outline" size="sm">
          <Link href="/student/courses">
            <BookOpen className="size-4 text-[#C99A22]" aria-hidden="true" />
            <span>Explore Courses</span>
          </Link>
        </Button>
      </div>

      {enrolledCourses.length === 0 ? (
        <EmptyState
          icon={Orbit}
          title="Your Learning Orbit is Empty"
          description="You are not enrolled in any courses yet. Explore the course catalog to add courses to your learning orbit."
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
        <>
          <Card className="relative overflow-hidden border-border bg-card shadow-md dark:border-[#C99A22]/25 dark:bg-gradient-to-b dark:from-[#121318] dark:via-[#0E0F14] dark:to-[#0A0B0F]">
            <button
              type="button"
              onClick={handleResetOrbit}
              aria-label="Reset orbit"
              title="Reset orbit"
              className="absolute top-4 right-4 z-30 inline-flex size-9 items-center justify-center rounded-lg border border-border bg-background/90 text-foreground shadow-sm transition hover:border-[#C99A22] hover:text-[#C99A22] dark:border-border/60 dark:bg-background/70 dark:text-muted-foreground"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
            </button>

            <CardContent className="flex flex-col items-center justify-center px-4 py-8">
              <div dir="ltr" className="w-full max-w-5xl">
                <OrbitImages
                  key={orbitResetKey}
                  images={orbitImageUrls}
                  shape="ellipse"
                  baseWidth={1400}
                  radiusX={540}
                  radiusY={155}
                  rotation={-8}
                  duration={45}
                  itemSize={128}
                  itemRadius={24}
                  depth={0.75}
                  showPath={true}
                  pathColor="rgba(180, 134, 20, 0.45)"
                  pathWidth={1.5}
                  onItemClick={handleItemClick}
                  hoverSpeed={0.15}
                  draggable={true}
                  clickToFront={true}
                />
              </div>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Hover over the orbit to slow down, drag to rotate, or click any course card to open details.
              </p>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                Enrolled Courses ({enrolledCourses.length})
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {enrolledCourses.map((course) => {
                const isCompleted =
                  course.progressPercent >= 100 ||
                  course.enrollmentStatus === "completed";
                const continueHref = course.firstLessonId
                  ? `/student/courses/${course.firstLessonId}`
                  : `/student/courses?courseId=${course.id}`;

                return (
                  <Card
                    key={course.id}
                    className="flex flex-col justify-between overflow-hidden border-border/80 transition-all hover:border-[#C99A22]/50"
                  >
                    <div>
                      <div className="relative h-36 w-full overflow-hidden border-b border-border/60 bg-muted">
                        <img
                          src={course.thumbnailUrl || FALLBACK_COURSE_IMAGE}
                          alt={course.title}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

                        <div className="absolute top-3 left-3 flex items-center gap-1.5">
                          <Badge className="border border-[#C99A22]/60 bg-[#11131F]/85 font-mono text-[10px] font-semibold text-[#C99A22] backdrop-blur-md">
                            {course.code}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="border-white/25 bg-black/60 text-[10px] text-white backdrop-blur-md"
                          >
                            {course.category}
                          </Badge>
                        </div>

                        <div className="absolute top-3 right-3">
                          <Badge
                            variant={isCompleted ? "gold" : "outline"}
                            className={
                              isCompleted
                                ? ""
                                : "border-white/25 bg-black/65 text-white backdrop-blur-md"
                            }
                          >
                            {isCompleted && (
                              <CheckCircle2 className="mr-1 size-3" />
                            )}
                            {course.progressPercent}%
                          </Badge>
                        </div>
                      </div>

                      <CardHeader className="pb-2">
                        <CardTitle className="line-clamp-1 text-base">
                          {course.title}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-1.5 text-xs">
                          <User
                            className="size-3.5 text-[#C99A22]"
                            aria-hidden="true"
                          />
                          <span className="truncate">{course.teacherName}</span>
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="space-y-3 text-xs">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>{t.courses.progressLabel}</span>
                            <span className="font-mono font-semibold text-foreground">
                              {course.progressPercent}%
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full bg-gold-metallic transition-all duration-300"
                              style={{
                                width: `${Math.min(100, Math.max(0, course.progressPercent))}%`,
                              }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Layers
                              className="size-3.5 text-[#C99A22]"
                              aria-hidden="true"
                            />
                            {course.chaptersCount} {t.courses.chaptersCountLabel} •{" "}
                            {course.lessonsCount} {t.courses.lessonsCountLabel}
                          </span>
                          {course.estimatedHours > 0 && (
                            <span className="inline-flex items-center gap-1 font-mono">
                              <Clock
                                className="size-3.5 text-[#C99A22]"
                                aria-hidden="true"
                              />
                              {course.estimatedHours}h
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </div>

                    <CardFooter className="border-t border-border/60 pt-3">
                      <Button
                        asChild
                        variant="gold"
                        size="sm"
                        className="w-full justify-center gap-2"
                      >
                        <Link href={continueHref}>
                          <PlayCircle className="size-4" aria-hidden="true" />
                          <span>{t.common.continueLearning}</span>
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md border-none bg-transparent p-0 shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>{selectedCourse?.title}</DialogTitle>
            <DialogDescription>Course Details</DialogDescription>
          </DialogHeader>
          {selectedCourse && (
            <div className="mx-auto w-full max-w-[380px]">
              <TiltedCard
                imageSrc={selectedCourse.thumbnailUrl}
                altText={selectedCourse.title}
                containerHeight="450px"
                containerWidth="100%"
                imageHeight="100%"
                imageWidth="100%"
                rotateAmplitude={10}
                scaleOnHover={1.02}
                showTooltip={false}
                displayOverlayContent={true}
                overlayContent={
                  <div className="flex h-full w-full flex-col justify-between bg-gradient-to-t from-[#090A10]/95 via-[#090A10]/55 to-black/30 p-6 text-white">
                    <div className="flex justify-between">
                      <Badge className="border border-[#C99A22]/60 bg-[#11131F]/85 text-[#C99A22]">
                        <Tag className="mr-1 size-3" />{" "}
                        {selectedCourse.category}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold">
                        {selectedCourse.title}
                      </h3>
                      <p className="text-xs text-white/80">
                        {selectedCourse.code} • {selectedCourse.teacherName}
                      </p>
                    </div>
                  </div>
                }
                backContent={
                  <div className="flex h-full w-full flex-col justify-between bg-[#17181A] p-6 text-white">
                    <div className="space-y-3">
                      <Badge variant="gold-subtle">
                        {selectedCourse.category}
                      </Badge>
                      <h3 className="text-lg font-bold">
                        {selectedCourse.title}
                      </h3>
                      <p className="line-clamp-4 text-sm text-muted-foreground">
                        {selectedCourse.description}
                      </p>
                    </div>
                    <div className="space-y-4 border-t border-[#252630] pt-4">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="size-3.5" />{" "}
                          {selectedCourse.teacherName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5" />{" "}
                          {selectedCourse.estimatedHours}h
                        </span>
                      </div>
                      <Button
                        onClick={handleContinue}
                        variant="gold"
                        className="w-full"
                      >
                        Continue Learning
                        <ArrowRight className="ml-2 size-4" />
                      </Button>
                    </div>
                  </div>
                }
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}