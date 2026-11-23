import "server-only";

import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getAuthenticatedActor,
  requireRole,
  type TableInsert,
  type TableRow,
} from "@/services/db/utils";
import type { ServiceResult } from "@/types";

export type LessonRow = TableRow<"lessons">;
export type LessonProgressRow = TableRow<"lesson_progress">;
export type FavoriteRow = TableRow<"favorites">;
export type LessonNoteRow = TableRow<"lesson_notes">;

const createLessonSchema = z.object({
  chapter_id: z.string().uuid(),
  course_id: z.string().uuid(),
  title: z.string().trim().min(3).max(160),
  summary: z.string().trim().max(500).nullable().optional(),
  content_type: z.enum(["video", "article", "pdf", "presentation", "quiz"]).default("video"),
  content_markdown: z.string().nullable().optional(),
  video_storage_path: z.string().nullable().optional(),
  attachment_storage_path: z.string().nullable().optional(),
  duration_seconds: z.number().int().min(0).default(0),
  position: z.number().int().min(1).default(1),
  is_preview: z.boolean().default(false),
  is_published: z.boolean().default(false),
});

export async function listCourseLessons(courseId: string): Promise<ServiceResult<LessonRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("course_id", courseId)
    .order("position", { ascending: true });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}

export async function createLesson(
  input: z.infer<typeof createLessonSchema>,
): Promise<ServiceResult<LessonRow>> {
  const parsed = createLessonSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid lesson input." };
  }

  const actorResult = await requireRole(["teacher", "admin"]);
  if (!actorResult.ok) return actorResult;

  const supabase = await createSupabaseServerClient();
  const payload: TableInsert<"lessons"> = parsed.data;

  const { data, error } = await supabase
    .from("lessons")
    .insert(payload)
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

export async function recordLessonProgress(params: {
  lessonId: string;
  courseId: string;
  isCompleted: boolean;
  watchedSeconds?: number;
  lastPositionSeconds?: number;
}): Promise<ServiceResult<LessonProgressRow>> {
  const actorResult = await getAuthenticatedActor();
  if (!actorResult.ok) return actorResult;
  if (!actorResult.data) return { ok: false, error: "Authentication required." };

  const supabase = await createSupabaseServerClient();
  const payload: TableInsert<"lesson_progress"> = {
    lesson_id: params.lessonId,
    course_id: params.courseId,
    student_id: actorResult.data.userId,
    is_completed: params.isCompleted,
    watched_seconds: params.watchedSeconds ?? 0,
    last_position_seconds: params.lastPositionSeconds ?? 0,
    completed_at: params.isCompleted ? new Date().toISOString() : null,
  };

  const { data, error } = await supabase
    .from("lesson_progress")
    .upsert(payload, { onConflict: "lesson_id,student_id" })
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

export async function saveLessonNote(params: {
  lessonId: string;
  content: string;
  videoTimestampSeconds?: number | null;
}): Promise<ServiceResult<LessonNoteRow>> {
  const trimmed = params.content.trim();
  if (!trimmed) {
    return { ok: false, error: "Lesson note content cannot be empty." };
  }

  const actorResult = await getAuthenticatedActor();
  if (!actorResult.ok) return actorResult;
  if (!actorResult.data) return { ok: false, error: "Authentication required." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("lesson_notes")
    .insert({
      lesson_id: params.lessonId,
      student_id: actorResult.data.userId,
      content: trimmed,
      video_timestamp_seconds: params.videoTimestampSeconds ?? null,
    })
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

export async function toggleFavorite(params: {
  courseId?: string;
  lessonId?: string;
}): Promise<ServiceResult<{ favorited: boolean }>> {
  if ((params.courseId && params.lessonId) || (!params.courseId && !params.lessonId)) {
    return { ok: false, error: "Specify either courseId or lessonId." };
  }

  const actorResult = await getAuthenticatedActor();
  if (!actorResult.ok) return actorResult;
  if (!actorResult.data) return { ok: false, error: "Authentication required." };

  const supabase = await createSupabaseServerClient();
  let matchQuery = supabase
    .from("favorites")
    .select("id")
    .eq("student_id", actorResult.data.userId);

  if (params.courseId) {
    matchQuery = matchQuery.eq("course_id", params.courseId);
  } else if (params.lessonId) {
    matchQuery = matchQuery.eq("lesson_id", params.lessonId);
  }

  const { data: existing, error: findError } = await matchQuery.maybeSingle();
  if (findError) return { ok: false, error: findError.message };

  if (existing) {
    const { error: deleteError } = await supabase
      .from("favorites")
      .delete()
      .eq("id", existing.id);
    if (deleteError) return { ok: false, error: deleteError.message };
    return { ok: true, data: { favorited: false } };
  }

  const { error: insertError } = await supabase.from("favorites").insert({
    student_id: actorResult.data.userId,
    course_id: params.courseId ?? null,
    lesson_id: params.lessonId ?? null,
  });
  if (insertError) return { ok: false, error: insertError.message };
  return { ok: true, data: { favorited: true } };
}
