"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Layers,
  PlayCircle,
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

  const handleContinue = (course: EnrolledOrbitCourse) => {
    const continueHref = course.firstLessonId
      ? `/student/courses/${course.firstLessonId}`
      : `/student/courses?courseId=${course.id}`;
    router.push(continueHref);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          {/* التعديل هنا: غيرنا #C99A22 لـ #10b981 */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[#10b981]/40 bg-[#10b981]/10 px-3 py-1 text-xs font-semibold text-[#10b981]">
            <BookOpen className="size-3.5" aria-hidden="true" />
            <span>My Enrolled Courses</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            My Enrolled Courses
          </h1>
        </div>

        <Button asChild variant="outline" size="sm" className="bg-white/20 backdrop-blur-md dark:bg-[#121a19]">
          <Link href="/student/courses">
            {/* التعديل هنا */}
            <BookOpen className="size-4 text-[#10b981]" aria-hidden="true" />
            <span>Explore Courses</span>
          </Link>
        </Button>
      </div>

      {enrolledCourses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No Enrolled Courses"
          description="You are not enrolled in any courses yet. Explore the course catalog to add courses."
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
          {enrolledCourses.map((course) => {
            const isCompleted =
              course.progressPercent >= 100 ||
              course.enrollmentStatus === "completed";

            return (
              <div key={course.id} className="h-[400px] w-full perspective-1000">
                <TiltedCard
                  imageSrc={course.thumbnailUrl}
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
                    <div className="flex h-full w-full flex-col justify-between bg-gradient-to-t from-black/80 via-black/20 to-transparent p-6 text-white backdrop-blur-[2px]">
                      <div className="flex justify-between items-start">
                        {/* التعديل هنا في الـ Badge */}
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
                        <h3 className="text-xl font-bold line-clamp-2">
                          {course.title}
                        </h3>
                        <p className="text-xs text-white/80 flex items-center gap-1.5">
                          <User className="size-3.5" /> {course.teacherName}
                        </p>
                      </div>
                    </div>
                  }
                  backContent={
                    <div className="flex h-full w-full flex-col justify-between bg-white/20 p-6 text-foreground border border-white/20 rounded-2xl backdrop-blur-lg dark:bg-[#121a19] dark:border-[#353644]">
                      <div className="space-y-3">
                        <Badge variant="gold-subtle">
                          {course.category}
                        </Badge>
                        <h3 className="text-lg font-bold line-clamp-2">
                          {course.title}
                        </h3>
                        <p className="line-clamp-4 text-sm text-muted-foreground">
                          {course.description}
                        </p>
                      </div>
                      <div className="space-y-4 border-t border-white/20 pt-4 dark:border-[#353644]">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            {/* التعديل هنا */}
                            <Layers className="size-3.5 text-[#10b981]" />
                            {course.chaptersCount} Chapters
                          </span>
                          <span className="flex items-center gap-1">
                            {/* التعديل هنا */}
                            <Clock className="size-3.5 text-[#10b981]" />
                            {course.estimatedHours}h
                          </span>
                        </div>
                        <Button
                          onClick={() => handleContinue(course)}
                          variant="gold"
                          className="w-full justify-center gap-2"
                        >
                          <PlayCircle className="size-4" />
                          Continue Learning
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