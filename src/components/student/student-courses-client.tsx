"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  Search,
  Star,
  Tag,
  User,
  Users,
} from "lucide-react";

import { useLocale } from "@/components/i18n/locale-provider";
import { CoursesCatalogSection } from "@/components/student/courses-catalog-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { CatalogCourseItem } from "@/hooks/use-courses-catalog";
import { getStudentDictionary } from "@/i18n/student-dictionaries";
import { studentEnrollInCourseAction } from "@/services/student/actions";
import type { StudentCoursesData } from "@/services/student/queries";

interface StudentCoursesClientProps {
  data: StudentCoursesData;
}

const DARK_GLASS_MODAL =
  "max-h-[85dvh] overflow-y-auto border-white/10 bg-[#0F1115]/80 text-foreground backdrop-blur-xl shadow-[0_14px_40px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] dark:border-white/10 dark:bg-[#0F1115]/80 sm:max-w-2xl";

const DARK_GLASS_BOX =
  "border-white/10 bg-[#0F1115]/55 backdrop-blur-md";

export function StudentCoursesClient({ data }: StudentCoursesClientProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const t = getStudentDictionary(locale);
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [inspectedCourse, setInspectedCourse] =
    useState<CatalogCourseItem | null>(null);

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
      const unit = c.duration_unit === "days" ? "day" : "hour";
      const revs = data.approvedReviews.filter((r) => r.courseId === c.id);
      return {
        id: c.id,
        code: c.code,
        title: c.title,
        subtitle: c.subtitle,
        description:
          c.description ||
          c.subtitle ||
          "Comprehensive academic course with structured modules, interactive lessons, and smart assessments.",
        thumbnail_url: c.thumbnail_url ?? null,
        image_url:
          c.thumbnail_url && c.thumbnail_url.trim()
            ? c.thumbnail_url.trim()
            : "/learnix-hero.jpg",
        category: c.category || "General",
        price: null,
        duration:
          hours > 0
            ? `${hours} ${hours === 1 ? unit : `${unit}s`}`
            : "Self-paced",
        estimated_hours: hours,
        teacher_id: c.teacher_id,
        teacher: {
          id: c.teacher_id,
          full_name: c.teacherName,
          avatar_url: c.teacherAvatarUrl,
        },
        ratingAvg: c.ratingAvg,
        reviewCount: c.reviewCount,
        enrollmentCount: c.enrollmentCount,
        approvedReviews: revs,
      };
    });
  }, [
    data.enrolledCourses,
    data.availablePublishedCourses,
    data.approvedReviews,
  ]);

  function handleEnroll(courseId: string) {
    if (enrolledCourseIdSet.has(courseId)) {
      router.push(`/student/my-learning?courseId=${courseId}`);
      return;
    }

    startTransition(async () => {
      try {
        const res = await studentEnrollInCourseAction({ courseId });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success(t.common.enrolledToast);
        setInspectedCourse(null);
        router.push(`/student/my-learning?courseId=${courseId}`);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to enroll in course.",
        );
      }
    });
  }

  const isInspectedEnrolled = inspectedCourse
    ? enrolledCourseIdSet.has(inspectedCourse.id)
    : false;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Explore Courses
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Discover published courses, inspect approved student reviews, and enroll instantly.
          </p>
        </div>

        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by course, category, or instructor..."
            className="border-white/10 bg-[#0F1115]/75 pl-9 backdrop-blur-md dark:bg-[#0F1115]/75"
          />
        </div>
      </div>

      <CoursesCatalogSection
        initialCourses={initialCatalogCourses}
        availableCategories={data.categories}
        enrolledCourseIds={enrolledCourseIdSet}
        isSubmitting={isPending}
        searchQuery={search}
        onSearchQueryChange={setSearch}
        onInspectCourse={(course) => setInspectedCourse(course)}
        onSelectCourse={(course, isEnrolled) => {
          if (isEnrolled) {
            router.push(`/student/my-learning?courseId=${course.id}`);
            return;
          }
          handleEnroll(course.id);
        }}
      />

      {/* Course Details & Approved Reviews Modal */}
      <Dialog
        open={Boolean(inspectedCourse)}
        onOpenChange={(open) => {
          if (!open) setInspectedCourse(null);
        }}
      >
        <DialogContent className={DARK_GLASS_MODAL}>
          {inspectedCourse && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="gold-subtle">
                    <Tag className="mr-1 size-3" />
                    {inspectedCourse.category}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-white/15 bg-[#0F1115]/60 font-mono text-xs"
                  >
                    {inspectedCourse.code}
                  </Badge>
                  {isInspectedEnrolled && (
                    <Badge variant="gold">
                      <CheckCircle2 className="mr-1 size-3" />
                      Enrolled
                    </Badge>
                  )}
                </div>
                <DialogTitle className="pt-1 text-xl">
                  {inspectedCourse.title}
                </DialogTitle>
                <DialogDescription>
                  {inspectedCourse.subtitle || "Published Learnix Curriculum"}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-2">
                {/* Cover Banner */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={inspectedCourse.image_url}
                  alt={inspectedCourse.title}
                  className="h-48 w-full rounded-xl border border-white/10 object-cover"
                />

                {/* Key Metadata */}
                <div
                  className={`grid grid-cols-3 gap-3 rounded-xl border p-3 text-xs ${DARK_GLASS_BOX}`}
                >
                  <div className="flex items-center gap-2">
                    <User className="size-4 text-[#C99A22]" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground">
                        Instructor
                      </p>
                      <p className="truncate font-semibold text-foreground">
                        {inspectedCourse.teacher.full_name || "Instructor"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-[#C99A22]" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">
                        Duration
                      </p>
                      <p className="font-semibold text-foreground">
                        {inspectedCourse.duration}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="size-4 text-[#C99A22]" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">
                        Enrollment & Rating
                      </p>
                      <p className="font-semibold text-foreground">
                        {inspectedCourse.enrollmentCount ?? 0} students •{" "}
                        {(inspectedCourse.reviewCount ?? 0) > 0
                          ? `${inspectedCourse.ratingAvg}★`
                          : "New"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-sm font-semibold text-foreground">
                    Course Description
                  </h4>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                    {inspectedCourse.description}
                  </p>
                </div>

                {/* Approved Reviews */}
                <div className="space-y-2.5 border-t border-white/10 pt-4">
                  <div className="flex items-center justify-between">
                    <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <Star className="size-4 fill-amber-400 text-amber-400" />
                      <span>
                        Approved Student Reviews (
                        {inspectedCourse.approvedReviews?.length ?? 0})
                      </span>
                    </h4>
                  </div>

                  {!inspectedCourse.approvedReviews ||
                    inspectedCourse.approvedReviews.length === 0 ? (
                    <p
                      className={`rounded-lg border p-3 text-xs text-muted-foreground ${DARK_GLASS_BOX}`}
                    >
                      No reviews published for this course yet.
                    </p>
                  ) : (
                    <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                      {inspectedCourse.approvedReviews.map((rev) => (
                        <div
                          key={rev.id}
                          className={`rounded-lg border p-3 text-xs ${DARK_GLASS_BOX}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-foreground">
                              {rev.studentName}
                            </span>
                            <span className="font-mono text-amber-400">
                              {"★".repeat(rev.rating)}
                            </span>
                          </div>
                          <p className="mt-1 text-muted-foreground">
                            {rev.comment || "Rated this course."}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  className="border-white/15 bg-[#0F1115]/60 hover:bg-[#0F1115]/80"
                  onClick={() => setInspectedCourse(null)}
                >
                  Close
                </Button>
                {isInspectedEnrolled ? (
                  <Button
                    variant="gold"
                    onClick={() => {
                      const cid = inspectedCourse.id;
                      setInspectedCourse(null);
                      router.push(`/student/my-learning?courseId=${cid}`);
                    }}
                  >
                    Open in My Courses
                  </Button>
                ) : (
                  <Button
                    variant="gold"
                    disabled={isPending}
                    onClick={() => handleEnroll(inspectedCourse.id)}
                  >
                    Enroll in Course
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}