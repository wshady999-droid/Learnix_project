"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search } from "lucide-react";

import { useLocale } from "@/components/i18n/locale-provider";
import { CoursesCatalogSection } from "@/components/student/courses-catalog-section";
import { Input } from "@/components/ui/input";
import type { CatalogCourseItem } from "@/hooks/use-courses-catalog";
import { getStudentDictionary } from "@/i18n/student-dictionaries";
import { studentEnrollInCourseAction } from "@/services/student/actions";
import type { StudentCoursesData } from "@/services/student/queries";

interface StudentCoursesClientProps {
  data: StudentCoursesData;
}

export function StudentCoursesClient({ data }: StudentCoursesClientProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const t = getStudentDictionary(locale);
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState("");

  const enrolledCourseIdSet = useMemo(
    () => new Set(data.enrolledCourses.map((c) => c.id)),
    [data.enrolledCourses],
  );

  const initialCatalogCourses = useMemo<CatalogCourseItem[]>(() => {
    const combined = [
      ...data.enrolledCourses,
      ...data.availablePublishedCourses,
    ];
    return combined.map((c) => {
      const hours = Number(c.estimated_hours ?? 0);
      return {
        id: c.id,
        code: c.code,
        title: c.title,
        subtitle: c.subtitle,
        description:
          c.description ||
          c.subtitle ||
          "Comprehensive academic course with structured modules, interactive lessons, and smart examinations.",
        thumbnail_url: c.thumbnail_url ?? null,
        image_url:
          c.thumbnail_url && c.thumbnail_url.trim()
            ? c.thumbnail_url.trim()
            : "/learnix-hero.jpg",
        category: c.category || "General",
        price: null,
        duration:
          hours > 0
            ? `${hours} ${hours === 1 ? "hour" : "hours"}`
            : "Self-paced",
        estimated_hours: hours,
        teacher_id: c.teacher_id,
        teacher: {
          id: c.teacher_id,
          full_name: c.teacherName,
          avatar_url: null,
        },
      };
    });
  }, [data.enrolledCourses, data.availablePublishedCourses]);

  function handleEnroll(courseId: string) {
    startTransition(async () => {
      try {
        const res = await studentEnrollInCourseAction({ courseId });
        if (!res.ok) {
          console.error("[studentEnrollInCourseAction] error:", res.error);
          toast.error(res.error);
          return;
        }
        toast.success(t.common.enrolledToast);
        if (res.data.firstLessonId) {
          router.push(`/student/courses/${res.data.firstLessonId}`);
        } else {
          toast.info(
            "You are now enrolled! This course does not have published lessons yet.",
          );
          router.refresh();
        }
      } catch (err) {
        console.error("[handleEnroll] exception:", err);
        toast.error(
          err instanceof Error ? err.message : "Failed to enroll in course.",
        );
      }
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          My Courses
        </h1>

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

      <CoursesCatalogSection
        initialCourses={initialCatalogCourses}
        enrolledCourseIds={enrolledCourseIdSet}
        isSubmitting={isPending}
        searchQuery={search}
        onSearchQueryChange={setSearch}
        onSelectCourse={(course, isEnrolled) => {
          if (isEnrolled) {
            const firstLesson = data.lessons.find(
              (l) => l.course_id === course.id,
            );
            if (firstLesson) {
              router.push(`/student/courses/${firstLesson.id}`);
              return;
            }
          }
          handleEnroll(course.id);
        }}
      />
    </div>
  );
}
