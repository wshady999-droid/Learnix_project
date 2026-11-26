"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
  User,
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

const DEFAULT_CATEGORIES = ["All", ...COURSE_CATEGORIES] as const;

export interface CoursesCatalogSectionProps {
  initialCourses?: CatalogCourseItem[];
  enrolledCourseIds?: ReadonlySet<string>;
  onSelectCourse?: (course: CatalogCourseItem, isEnrolled: boolean) => void;
  isSubmitting?: boolean;
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
}

export function CoursesCatalogSection({
  initialCourses,
  enrolledCourseIds,
  onSelectCourse,
  isSubmitting = false,
  searchQuery,
  onSearchQueryChange,
}: CoursesCatalogSectionProps) {
  const { courses, loading, error, refetch } = useCoursesCatalog(initialCourses);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [internalSearch, setInternalSearch] = useState<string>("");
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const isHoveredRef = useRef(false);
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

  const categories = useMemo(() => [...DEFAULT_CATEGORIES], []);

  const filteredCourses = useMemo(() => {
    const q = activeSearch.trim().toLowerCase();
    return courses.filter((course) => {
      const matchesCategory =
        selectedCategory === "All" ||
        course.category.trim() === selectedCategory;

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
  }, [courses, selectedCategory, activeSearch]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let animationFrameId: number;
    const scrollSpeed = 0.8;

    const scroll = () => {
      if (!isHoveredRef.current && !isDraggingRef.current && el) {
        el.scrollLeft += scrollSpeed;
        if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 1) {
          el.scrollLeft = 0;
        }
      }
      animationFrameId = requestAnimationFrame(scroll);
    };

    animationFrameId = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const handleMouseEnter = () => { isHoveredRef.current = true; };
  const handleMouseLeave = () => {
    isHoveredRef.current = false;
    isDraggingRef.current = false;
  };

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

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  return (
    <section aria-label="Courses Catalog" className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        
        <div
          ref={scrollRef}
          role="tablist"
          aria-label="Course categories"
          className="relative flex w-full items-center gap-2 overflow-x-auto pb-2 lg:pb-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden cursor-grab active:cursor-grabbing"
          style={{
            maskImage: "linear-gradient(to right, transparent, black 5%, black 95%, transparent)",
            WebkitMaskImage: "linear-gradient(to right, transparent, black 5%, black 95%, transparent)",
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
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
                    ? "border-[#10b981] bg-[#10b981] text-white shadow-[0_4px_14px_rgba(16,185,129,0.35)]" // التعديل هنا: غيرنا الذهبي للأخضر
                    : "border-border bg-white/20 backdrop-blur-md text-muted-foreground hover:border-[#10b981]/60 hover:text-foreground dark:bg-[#121a19]",
                )}
              >
                <Tag
                  className={cn(
                    "size-3.5",
                    isActive ? "text-white" : "text-[#10b981]", // التعديل هنا
                  )}
                  aria-hidden="true"
                />
                <span>{category}</span>
              </button>
            );
          })}
        </div>

        {searchQuery === undefined && (
          <div className="relative w-full shrink-0 lg:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={activeSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search courses or teachers..."
              className="pl-9 bg-white/20 backdrop-blur-md dark:bg-[#121a19]"
            />
          </div>
        )}
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
              className="flex h-[380px] flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-white/20 backdrop-blur-md dark:bg-[#121a19] p-5 shadow-sm"
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
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-white/20 backdrop-blur-md dark:bg-[#121a19] p-12 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-full border border-[#10b981]/40 bg-[#10b981]/15 text-[#10b981]">
            <BookOpen className="size-6" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">
              No Courses Found
            </h3>
            <p className="max-w-md text-xs text-muted-foreground">
              {selectedCategory !== "All" || activeSearch.trim()
                ? `No published courses matched "${selectedCategory}"${activeSearch.trim() ? ` and "${activeSearch.trim()}"` : ""}.`
                : "No published courses are available in the catalog right now."}
            </p>
          </div>
          {(selectedCategory !== "All" || activeSearch.trim()) && (
            <Button
              variant="gold"
              size="sm"
              onClick={() => {
                setSelectedCategory("All");
                handleSearchChange("");
              }}
            >
              Reset Filters
            </Button>
          )}
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
            const priceLabel =
              course.price === null || course.price === 0
                ? "Free"
                : `$${course.price.toFixed(2)}`;

            const coverImageSrc =
              course.thumbnail_url && course.thumbnail_url.trim()
                ? course.thumbnail_url.trim()
                : course.image_url || "/learnix-hero.jpg";

            return (
              <div key={course.id} className="h-[380px] w-full">
                <TiltedCard
                  imageSrc={coverImageSrc}
                  altText={course.title}
                  captionText="Click card to flip for details"
                  containerHeight="380px"
                  containerWidth="100%"
                  imageHeight="100%"
                  imageWidth="100%"
                  rotateAmplitude={10}
                  scaleOnHover={1.02}
                  showTooltip={true}
                  displayOverlayContent={true}
                  overlayContent={
                    <div className="flex h-full w-full flex-col justify-between bg-gradient-to-t from-[#090A10]/95 via-[#090A10]/55 to-black/30 p-5 text-white">
                      <div className="flex items-center justify-between gap-2">
                        <Badge className="border border-[#10b981]/60 bg-[#11131F]/85 px-3 py-1 text-[11px] font-semibold text-[#10b981] backdrop-blur-md">
                          <Tag className="mr-1 size-3" aria-hidden="true" />
                          {course.category}
                        </Badge>
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-[#10b981]/20 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-[#34d399] uppercase">
                              {course.code}
                            </span>
                            {isEnrolled && (
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                                <CheckCircle2 className="size-3" />
                                Enrolled
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
                    <div className="flex h-full w-full flex-col justify-between bg-white/20 p-6 text-foreground backdrop-blur-md border border-white/20 dark:bg-[#121a19] dark:border-[#353644]">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <Badge
                            variant="gold-subtle"
                            className="border-[#10b981]/40 bg-[#10b981]/15 text-[#047857] dark:text-[#10b981]"
                          >
                            <Sparkles className="mr-1 size-3" aria-hidden="true" />
                            {course.category}
                          </Badge>
                          <span className="rounded-full border border-[#10b981]/45 bg-[#10b981]/15 px-3 py-0.5 font-mono text-xs font-bold text-[#047857] dark:text-[#34d399]">
                            {priceLabel}
                          </span>
                        </div>
                        <h3 className="line-clamp-2 text-base font-bold text-foreground">
                          {course.title}
                        </h3>
                        <p className="line-clamp-5 text-xs leading-relaxed text-muted-foreground">
                          {course.description}
                        </p>
                      </div>
                      <div className="space-y-4 border-t border-white/20 pt-3.5 dark:border-[#252630]">
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
                          className="w-full justify-center gap-2 font-semibold"
                        >
                          <span>
                            {isEnrolled ? "View Course" : "Enroll Now"}
                          </span>
                          <ArrowRight className="size-3.5" aria-hidden="true" />
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
    </section>
  );
}