import "server-only";

import { z } from "zod";

import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  requireRole,
  type TableInsert,
  type TableRow,
  type TableUpdate,
} from "@/services/db/utils";
import type { ServiceResult } from "@/types";

export type CourseRow = TableRow<"courses">;
export type ChapterRow = TableRow<"chapters">;

const createCourseSchema = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case."),
  code: z.string().trim().min(2).max(24),
  title: z.string().trim().min(4).max(140),
  subtitle: z.string().trim().max(240).nullable().optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  category: z.string().trim().min(2).max(80),
  language: z.enum(["en", "ar", "de", "it", "fr"]).default("en"),
  department_id: z.string().uuid().nullable().optional(),
  educational_level_id: z.string().uuid().nullable().optional(),
  class_id: z.string().uuid().nullable().optional(),
  estimated_hours: z.number().min(0).max(2000).default(0),
  passing_score: z.number().min(0).max(100).default(60),
});

export async function listPublishedCourses(options?: {
  category?: string;
  language?: "en" | "ar" | "de" | "it" | "fr";
  limit?: number;
}): Promise<ServiceResult<CourseRow[]>> {
  if (!isSupabaseConfigured()) return { ok: true, data: [] };

  try {
    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("courses")
      .select("*")
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (options?.category) {
      query = query.eq("category", options.category);
    }
    if (options?.language) {
      query = query.eq("language", options.language);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data ?? [] };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to load published courses.",
    };
  }
}

export async function getCourseBySlug(slug: string): Promise<ServiceResult<CourseRow | null>> {
  if (!isSupabaseConfigured()) return { ok: true, data: null };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

export async function createCourse(
  input: z.infer<typeof createCourseSchema>,
): Promise<ServiceResult<CourseRow>> {
  const parsed = createCourseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid course payload." };
  }

  const actorResult = await requireRole(["teacher", "admin"]);
  if (!actorResult.ok) return actorResult;

  const supabase = await createSupabaseServerClient();
  const payload: TableInsert<"courses"> = {
    ...parsed.data,
    teacher_id: actorResult.data.userId,
    status: "draft",
  };

  const { data, error } = await supabase
    .from("courses")
    .insert(payload)
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

export async function updateCourse(
  courseId: string,
  updates: TableUpdate<"courses">,
): Promise<ServiceResult<CourseRow>> {
  const actorResult = await requireRole(["teacher", "admin"]);
  if (!actorResult.ok) return actorResult;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("courses")
    .update(updates)
    .eq("id", courseId)
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

export async function listCourseChapters(courseId: string): Promise<ServiceResult<ChapterRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("chapters")
    .select("*")
    .eq("course_id", courseId)
    .order("position", { ascending: true });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}
