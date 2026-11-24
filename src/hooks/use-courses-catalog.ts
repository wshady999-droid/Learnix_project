"use client";

import { useCallback, useEffect, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export interface CatalogCourseTeacher {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email?: string | null;
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
}

const DEFAULT_COURSE_COVER = "/learnix-hero.jpg";

/**
 * Fetches all published courses from Supabase along with the instructor's
 * `full_name` and `avatar_url` from `public.profiles` (joined via `teacher_id`).
 * Supports both schema variants (`thumbnail_url` / `image_url`, `estimated_hours` / `duration`, optional `price`).
 */
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
    .order("created_at", { ascending: false });

  if (coursesError) {
    throw new Error(coursesError.message);
  }

  const rows = coursesData ?? [];

  // Fallback teacher resolution if foreign-key alias is not expanded or teacher profile wasn't embedded
  const missingTeacherIds = Array.from(
    new Set(
      rows
        .filter((row) => !row.teacher)
        .map((row) => row.teacher_id)
        .filter(Boolean),
    ),
  );

  const fallbackTeacherMap = new Map<string, CatalogCourseTeacher>();
  if (missingTeacherIds.length > 0) {
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, email")
      .in("id", missingTeacherIds);

    for (const prof of profilesData ?? []) {
      fallbackTeacherMap.set(prof.id, {
        id: prof.id,
        full_name: prof.full_name,
        avatar_url: prof.avatar_url,
        email: prof.email,
      });
    }
  }

  return rows.map((row) => {
    const rawRecord = row as Record<string, unknown>;
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
      (typeof row.thumbnail_url === "string" && row.thumbnail_url.trim()) ||
      (typeof rawRecord.image_url === "string" && rawRecord.image_url.trim()) ||
      null;
    const imageUrl = rawThumbnail || DEFAULT_COURSE_COVER;

    const hours = Number(row.estimated_hours ?? 0);
    const customDuration =
      typeof rawRecord.duration === "string" && rawRecord.duration.trim()
        ? rawRecord.duration.trim()
        : hours > 0
          ? `${hours} ${hours === 1 ? "hour" : "hours"}`
          : "Self-paced";

    const rawPrice =
      typeof rawRecord.price === "number"
        ? rawRecord.price
        : typeof rawRecord.price === "string" && rawRecord.price.trim() !== ""
          ? Number(rawRecord.price)
          : null;

    return {
      id: row.id,
      code: row.code,
      title: row.title,
      subtitle: row.subtitle,
      description:
        row.description ||
        row.subtitle ||
        "Comprehensive academic course with structured modules, interactive lessons, and smart examinations.",
      thumbnail_url: rawThumbnail,
      image_url: imageUrl,
      category: row.category || "General",
      price: Number.isFinite(rawPrice) ? rawPrice : null,
      duration: customDuration,
      estimated_hours: hours,
      teacher_id: row.teacher_id,
      teacher: resolvedTeacher,
    };
  });
}

export function useCoursesCatalog(initialCourses?: CatalogCourseItem[]) {
  const [courses, setCourses] = useState<CatalogCourseItem[]>(
    initialCourses ?? [],
  );
  const [loading, setLoading] = useState<boolean>(!initialCourses);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllCoursesCatalog();
      setCourses(data);
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
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchAllCoursesCatalog();
        if (active) {
          setCourses(data);
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
  }, []);

  return {
    courses,
    loading,
    error,
    refetch,
  };
}
