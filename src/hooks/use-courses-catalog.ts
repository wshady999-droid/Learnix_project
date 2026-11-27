"use client";

import { useCallback, useEffect, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export interface CatalogCourseTeacher {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email?: string | null;
}

export interface CatalogApprovedReview {
  id: string;
  studentName: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface CatalogCourseItem {
  id: string;
  code: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  thumbnail_url: string | null;
  image_url: string;
  category: string;
  price: number | null;
  duration: string;
  estimated_hours: number;
  teacher_id: string;
  teacher: CatalogCourseTeacher;
  ratingAvg?: number;
  reviewCount?: number;
  enrollmentCount?: number;
  approvedReviews?: CatalogApprovedReview[];
}

const DEFAULT_COURSE_COVER = "/learnix-hero.jpg";

export async function fetchAllCoursesCatalog(): Promise<CatalogCourseItem[]> {
  const supabase = createSupabaseBrowserClient();

  const { data: coursesData, error: coursesError } = await supabase
    .from("courses")
    .select(
      `
      id,
      code,
      title,
      subtitle,
      description,
      thumbnail_url,
      category,
      estimated_hours,
      duration_unit,
      teacher_id,
      status,
      teacher:profiles!courses_teacher_id_fkey (
        id,
        full_name,
        avatar_url,
        email
      )
    `,
    )
    .eq("status", "published")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (coursesError) {
    throw new Error(coursesError.message);
  }

  const rows = coursesData ?? [];
  const courseIds = rows.map((r) => r.id);

  const [reviewsRes, missingTeacherProfilesRes] = await Promise.all([
    courseIds.length > 0
      ? supabase
          .from("course_reviews")
          .select("id, course_id, student_id, rating, comment, created_at")
          .in("course_id", courseIds)
          .eq("is_published", true)
          .eq("moderation_status", "approved")
          .order("created_at", { ascending: false })
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            course_id: string;
            student_id: string;
            rating: number;
            comment: string | null;
            created_at: string;
          }>,
        }),
    (() => {
      const missingTeacherIds = Array.from(
        new Set(
          rows
            .filter((row) => !row.teacher)
            .map((row) => row.teacher_id)
            .filter(Boolean),
        ),
      );
      if (missingTeacherIds.length === 0) {
        return Promise.resolve({ data: [] as CatalogCourseTeacher[] });
      }
      return supabase
        .from("profiles")
        .select("id, full_name, avatar_url, email")
        .in("id", missingTeacherIds);
    })(),
  ]);

  const fallbackTeacherMap = new Map<string, CatalogCourseTeacher>();
  for (const prof of missingTeacherProfilesRes.data ?? []) {
    fallbackTeacherMap.set(prof.id, {
      id: prof.id,
      full_name: prof.full_name,
      avatar_url: prof.avatar_url,
      email: prof.email,
    });
  }

  const allReviews = reviewsRes.data ?? [];

  return rows.map((row) => {
    const rawTeacher = Array.isArray(row.teacher) ? row.teacher[0] : row.teacher;
    const resolvedTeacher: CatalogCourseTeacher = rawTeacher
      ? {
          id: rawTeacher.id,
          full_name: rawTeacher.full_name,
          avatar_url: rawTeacher.avatar_url,
          email: rawTeacher.email,
        }
      : fallbackTeacherMap.get(row.teacher_id) ?? {
          id: row.teacher_id,
          full_name: "Learnix Instructor",
          avatar_url: null,
        };

    const rawThumbnail =
      typeof row.thumbnail_url === "string" && row.thumbnail_url.trim()
        ? row.thumbnail_url.trim()
        : null;
    const imageUrl = rawThumbnail || DEFAULT_COURSE_COVER;

    const hours = Number(row.estimated_hours ?? 0);
    const unit = row.duration_unit === "days" ? "day" : "hour";
    const duration =
      hours > 0
        ? `${hours} ${hours === 1 ? unit : `${unit}s`}`
        : "Self-paced";

    const courseRevs = allReviews.filter((r) => r.course_id === row.id);
    const ratingAvg =
      courseRevs.length > 0
        ? Number(
            (
              courseRevs.reduce((s, r) => s + Number(r.rating), 0) /
              courseRevs.length
            ).toFixed(1),
          )
        : 0;

    return {
      id: row.id,
      code: row.code,
      title: row.title,
      subtitle: row.subtitle,
      description:
        row.description ||
        row.subtitle ||
        "Comprehensive academic course with structured modules, interactive lessons, and smart assessments.",
      thumbnail_url: rawThumbnail,
      image_url: imageUrl,
      category: row.category || "General",
      price: null,
      duration,
      estimated_hours: hours,
      teacher_id: row.teacher_id,
      teacher: resolvedTeacher,
      ratingAvg,
      reviewCount: courseRevs.length,
      approvedReviews: courseRevs.slice(0, 10).map((r) => ({
        id: r.id,
        studentName: "Verified Student",
        rating: r.rating,
        comment: r.comment,
        createdAt: r.created_at,
      })),
    };
  });
}

export function useCoursesCatalog(initialCourses?: CatalogCourseItem[]) {
  const hasInitial = initialCourses !== undefined;
  const [fetchedCourses, setFetchedCourses] = useState<
    CatalogCourseItem[] | null
  >(null);
  const [loading, setLoading] = useState<boolean>(!hasInitial);
  const [error, setError] = useState<string | null>(null);

  const courses = fetchedCourses ?? initialCourses ?? [];

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllCoursesCatalog();
      setFetchedCourses(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load courses catalog from Supabase.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Performance fix: skip redundant client query when Server Component already supplied initialCourses
    if (hasInitial) return;

    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchAllCoursesCatalog();
        if (active) {
          setFetchedCourses(data);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load courses catalog from Supabase.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [hasInitial]);

  return {
    courses,
    loading,
    error,
    refetch,
  };
}
