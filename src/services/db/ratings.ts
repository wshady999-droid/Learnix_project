import "server-only";

import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedActor, type TableRow } from "@/services/db/utils";
import type { ServiceResult } from "@/types";

export type CourseReviewRow = TableRow<"course_reviews">;
export type TeacherReviewRow = TableRow<"teacher_reviews">;

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1500).nullable().optional(),
});

export async function upsertCourseReview(params: {
  courseId: string;
  rating: number;
  comment?: string | null;
}): Promise<ServiceResult<CourseReviewRow>> {
  const parsed = reviewSchema.safeParse({
    rating: params.rating,
    comment: params.comment,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid course review." };
  }

  const actorResult = await getAuthenticatedActor();
  if (!actorResult.ok) return actorResult;
  if (!actorResult.data) return { ok: false, error: "Authentication required." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("course_reviews")
    .upsert(
      {
        course_id: params.courseId,
        student_id: actorResult.data.userId,
        rating: parsed.data.rating,
        comment: parsed.data.comment ?? null,
      },
      { onConflict: "course_id,student_id" },
    )
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

export async function upsertTeacherReview(params: {
  teacherId: string;
  courseId?: string | null;
  rating: number;
  comment?: string | null;
}): Promise<ServiceResult<TeacherReviewRow>> {
  const parsed = reviewSchema.safeParse({
    rating: params.rating,
    comment: params.comment,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid teacher review." };
  }

  const actorResult = await getAuthenticatedActor();
  if (!actorResult.ok) return actorResult;
  if (!actorResult.data) return { ok: false, error: "Authentication required." };

  if (actorResult.data.userId === params.teacherId) {
    return { ok: false, error: "You cannot review yourself." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("teacher_reviews")
    .insert({
      teacher_id: params.teacherId,
      student_id: actorResult.data.userId,
      course_id: params.courseId ?? null,
      rating: parsed.data.rating,
      comment: parsed.data.comment ?? null,
    })
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

export async function listCourseReviews(courseId: string): Promise<ServiceResult<CourseReviewRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("course_reviews")
    .select("*")
    .eq("course_id", courseId)
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}
