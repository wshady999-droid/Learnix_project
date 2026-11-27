"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Eye,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Tag,
  User,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TiltedCard } from "@/components/ui/TiltedCard";
import {
  useCoursesCatalog,
  type CatalogCourseItem,
} from "@/hooks/use-courses-catalog";
import { COURSE_CATEGORIES } from "@/lib/constants/categories";
import { cn } from "@/lib/utils";

export interface CoursesCatalogSectionProps {
  initialCourses?: CatalogCourseItem[];
  availableCategories?: string[];
  enrolledCourseIds?: ReadonlySet<string>;
  onSelectCourse?: (course: CatalogCourseItem, isEnrolled: boolean) => void;
  onInspectCourse?: (course: CatalogCourseItem, isEnrolled: boolean) => void;
  isSubmitting?: boolean;
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
}

export function CoursesCatalogSection({
  initialCourses,
  availableCategories,
  enrolledCourseIds,
  onSelectCourse,
  onInspectCourse,
  isSubmitting = false,
  searchQuery,
  onSearchQueryChange,
}: CoursesCatalogSectionProps) {
  const { courses, loading, error, refetch } = useCoursesCatalog(initialCourses);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [enrollmentFilter, setEnrollmentFilter] = useState<
    "all" | "enrolled" | "available"
  >("all");
  const [internalSearch, setInternalSearch] = useState<string>("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  const activeSearch =
    searchQuery !== undefined ? searchQuery : internalSearch;

  function handleSearchChange(value: string) {
    if (onSearchQueryChange) {
      onSearchQueryChange(value);
    } else {
      setInternalSearch(value);
    }
  }

  const categories = useMemo(() => {
    const set = new Set<string>(
      availableCategories && availableCategories.length > 0
        ? availableCategories
        : [...COURSE_CATEGORIES],
    );
    for (const c of courses) {
      if (c.category?.trim()) {
        set.add(c.category.trim());
      }
    }
    return ["All", ...Array.from(set)];
  }, [availableCategories, courses]);

  const filteredCourses = useMemo(() => {
    const q = activeSearch.trim().toLowerCase();
    return courses.filter((course) => {
      const isEnrolled = enrolledCourseIds?.has(course.id) ?? false;
      if (enrollmentFilter === "enrolled" && !isEnrolled) return false;
      if (enrollmentFilter === "available" && isEnrolled) return false;

      const matchesCategory =
        selectedCategory === "All" ||
        course.category.trim().toLowerCase() === selectedCategory.toLowerCase();

      if (!matchesCategory) return false;
      if (!q) return true;

      const teacherName = (
        course.teacher.full_name ||
        course.teacher.email ||
        ""
      ).toLowerCase();

      return (
        course.title.toLowerCase().includes(q) ||
        course.code.toLowerCase().includes(q) ||
        course.category.toLowerCase().includes(q) ||
        (course.description ?? "").toLowerCase().includes(q) ||
        teacherName.includes(q)
      );
    });
  }, [courses, selectedCategory, activeSearch, enrollmentFilter, enrolledCourseIds]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    isDraggingRef.current = true;
    startXRef.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeftRef.current = scrollRef.current.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    scrollRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  const stopDrag = () => {
    isDraggingRef.current = false;
  };

  return (
    <section aria-label="Courses Catalog" className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          ref={scrollRef}
          role="tablist"
          aria-label="Course categories"
          className="relative flex w-full cursor-grab items-center gap-2 overflow-x-auto pb-2 active:cursor-grabbing lg:pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onMouseLeave={stopDrag}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={stopDrag}
        >
          {categories.map((category) => {
            const isActive =
              selectedCategory.toLowerCase() === category.toLowerCase();
            return (
              <button
                key={category}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setSelectedCategory(category)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition-all duration-200",
                  isActive
                    ? "border-[#10b981] bg-[#10b981] text-white shadow-[0_4px_14px_rgba(16,185,129,0.35)]"
                    : "border-border bg-white/20 text-muted-foreground backdrop-blur-md hover:border-[#10b981]/60 hover:text-foreground dark:bg-[#121a19]",
                )}
              >
                <Tag
                  className={cn(
                    "size-3.5",
                    isActive ? "text-white" : "text-[#10b981]",
                  )}
                  aria-hidden="true"
                />
                <span>{category}</span>
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {enrolledCourseIds && (
            <div className="inline-flex rounded-xl border border-border bg-white/20 p-1 backdrop-blur-md dark:bg-[#121a19]">
              {(
                [
                  { id: "all", label: "All" },
                  { id: "available", label: "Not Enrolled" },
                  { id: "enrolled", label: "Enrolled" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setEnrollmentFilter(opt.id)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                    enrollmentFilter === opt.id
                      ? "bg-[#10b981] text-white"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {searchQuery === undefined && (
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={activeSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search courses or teachers..."
                className="bg-white/20 pl-9 backdrop-blur-md dark:bg-[#121a19]"
              />
            </div>
          )}
        </div>
      </div>

      {loading && courses.length === 0 && (
        <div
          aria-busy="true"
          aria-label="Loading courses catalog"
          className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="flex h-[390px] flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-white/20 p-5 shadow-sm backdrop-blur-md dark:bg-[#121a19]"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-28 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              <div className="space-y-3">
                <Skeleton className="h-40 w-full rounded-xl" />
                <Skeleton className="h-6 w-3/4" />
                <div className="flex items-center gap-2.5 pt-1">
                  <Skeleton className="size-7 rounded-full" />
                  <Skeleton className="h-4 w-36" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/40 bg-destructive-subtle/40 p-8 text-center"
        >
          <AlertCircle className="size-8 text-destructive" aria-hidden="true" />
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">
              Unable to Load Courses Catalog
            </h3>
            <p className="max-w-md text-xs text-muted-foreground">{error}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            className="mt-1 gap-2 border-[#10b981]/60"
          >
            <RefreshCw className="size-3.5 text-[#10b981]" />
            <span>Retry</span>
          </Button>
        </div>
      )}

      {!loading && !error && filteredCourses.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-white/20 p-12 text-center backdrop-blur-md dark:bg-[#121a19]">
          <span className="inline-flex size-12 items-center justify-center rounded-full border border-[#10b981]/40 bg-[#10b981]/15 text-[#10b981]">
            <BookOpen className="size-6" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">
              No Courses Found
            </h3>
            <p className="max-w-md text-xs text-muted-foreground">
              No published courses matched your current filters.
            </p>
          </div>
          <Button
            variant="gold"
            size="sm"
            onClick={() => {
              setSelectedCategory("All");
              setEnrollmentFilter("all");
              handleSearchChange("");
            }}
          >
            Reset Filters
          </Button>
        </div>
      )}

      {!error && filteredCourses.length > 0 && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredCourses.map((course) => {
            const isEnrolled = enrolledCourseIds?.has(course.id) ?? false;
            const teacherName =
              course.teacher.full_name ||
              course.teacher.email ||
              "Learnix Instructor";
            const coverImageSrc =
              course.thumbnail_url && course.thumbnail_url.trim()
                ? course.thumbnail_url.trim()
                : course.image_url || "/learnix-hero.jpg";

            return (
              <div key={course.id} className="h-[395px] w-full">
                <TiltedCard
                  imageSrc={coverImageSrc}
                  altText={course.title}
                  captionText="Click card to flip for details"
                  containerHeight="395px"
                  containerWidth="100%"
                  imageHeight="100%"
                  imageWidth="100%"
                  rotateAmplitude={10}
                  scaleOnHover={1.02}
                  showTooltip={true}
                  displayOverlayContent={true}
                  overlayContent={
                    <div className="flex h-full w-full flex-col justify-between bg-gradient-to-t from-[#090A10]/95 via-[#090A10]/60 to-black/30 p-5 text-white">
                      <div className="flex items-center justify-between gap-2">
                        <Badge className="border border-[#10b981]/60 bg-[#11131F]/85 px-3 py-1 text-[11px] font-semibold text-[#10b981] backdrop-blur-md">
                          <Tag className="mr-1 size-3" aria-hidden="true" />
                          {course.category}
                        </Badge>

                        {isEnrolled ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/50 bg-emerald-500/90 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs">
                            <CheckCircle2 className="size-3" />
                            Enrolled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm">
                            Available
                          </span>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded bg-[#10b981]/20 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-[#34d399] uppercase">
                              {course.code}
                            </span>
                            {(course.reviewCount ?? 0) > 0 && (
                              <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                                <Star className="size-3 fill-amber-300 text-amber-300" />
                                {course.ratingAvg} ({course.reviewCount})
                              </span>
                            )}
                            {typeof course.enrollmentCount === "number" && (
                              <span className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/85">
                                <Users className="size-3" />
                                {course.enrollmentCount} students
                              </span>
                            )}
                          </div>
                          <h3 className="line-clamp-2 text-lg leading-snug font-bold tracking-tight text-white drop-shadow-xs">
                            {course.title}
                          </h3>
                        </div>

                        <div className="flex items-center justify-between border-t border-white/15 pt-3 text-xs text-white/90">
                          <div className="flex min-w-0 items-center gap-2">
                            {course.teacher.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={course.teacher.avatar_url}
                                alt={teacherName}
                                className="size-6 shrink-0 rounded-full border border-[#10b981]/60 object-cover"
                              />
                            ) : (
                              <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-[#10b981]/50 bg-[#10b981]/20 text-[#10b981]">
                                <User className="size-3.5" aria-hidden="true" />
                              </span>
                            )}
                            <span className="truncate font-medium">
                              {teacherName}
                            </span>
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] text-[#34d399]">
                            <Clock className="size-3" aria-hidden="true" />
                            {course.duration}
                          </span>
                        </div>
                      </div>
                    </div>
                  }
                  backContent={
                    <div className="flex h-full w-full flex-col justify-between border border-white/20 bg-white/25 p-6 text-foreground backdrop-blur-md dark:border-[#353644] dark:bg-[#121a19]">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <Badge
                            variant="gold-subtle"
                            className="border-[#10b981]/40 bg-[#10b981]/15 text-[#047857] dark:text-[#10b981]"
                          >
                            <Sparkles className="mr-1 size-3" aria-hidden="true" />
                            {course.category}
                          </Badge>
                          <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-foreground">
                            <Star className="size-3.5 fill-amber-400 text-amber-400" />
                            {(course.reviewCount ?? 0) > 0
                              ? `${course.ratingAvg}/5 (${course.reviewCount})`
                              : "New"}
                          </span>
                        </div>
                        <h3 className="line-clamp-2 text-base font-bold text-foreground">
                          {course.title}
                        </h3>
                        <p className="line-clamp-4 text-xs leading-relaxed text-muted-foreground">
                          {course.description}
                        </p>
                      </div>

                      <div className="space-y-3 border-t border-white/20 pt-3 dark:border-[#252630]">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5 font-medium">
                            <User
                              className="size-3.5 text-[#10b981]"
                              aria-hidden="true"
                            />
                            <span className="max-w-36 truncate">
                              {teacherName}
                            </span>
                          </span>
                          <span className="inline-flex items-center gap-1.5 font-mono">
                            <Clock
                              className="size-3.5 text-[#10b981]"
                              aria-hidden="true"
                            />
                            <span>{course.duration}</span>
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {onInspectCourse && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              data-no-flip="true"
                              onClick={(e) => {
                                e.stopPropagation();
                                onInspectCourse(course, isEnrolled);
                              }}
                              className="justify-center gap-1.5 text-xs"
                            >
                              <Eye className="size-3.5" />
                              <span>Details</span>
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="gold"
                            size="sm"
                            disabled={isSubmitting}
                            data-no-flip="true"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectCourse?.(course, isEnrolled);
                            }}
                            className={cn(
                              "justify-center gap-1.5 font-semibold",
                              !onInspectCourse && "col-span-2",
                            )}
                          >
                            <span>
                              {isEnrolled ? "Open Course" : "Enroll Now"}
                            </span>
                            <ArrowRight
                              className="size-3.5"
                              aria-hidden="true"
                            />
                          </Button>
                        </div>
                      </div>
                    </div>
                  }
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
