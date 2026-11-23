import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedActor, requireRole, type TableRow } from "@/services/db/utils";
import type { ServiceResult } from "@/types";

export type ResultRow = TableRow<"results">;

/**
 * Invokes the transactional PostgreSQL function `public.submit_exam_attempt(p_attempt_id)`
 * to grade objective questions and persist an immutable `public.results` record.
 */
export async function submitExamAttempt(attemptId: string): Promise<ServiceResult<ResultRow>> {
  const actorResult = await getAuthenticatedActor();
  if (!actorResult.ok) return actorResult;
  if (!actorResult.data) return { ok: false, error: "Authentication required." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("submit_exam_attempt", {
    p_attempt_id: attemptId,
  });

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "No result returned from exam submission." };

  return { ok: true, data };
}

export async function listStudentResults(): Promise<ServiceResult<ResultRow[]>> {
  const actorResult = await getAuthenticatedActor();
  if (!actorResult.ok) return actorResult;
  if (!actorResult.data) return { ok: false, error: "Authentication required." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("results")
    .select("*")
    .eq("student_id", actorResult.data.userId)
    .order("graded_at", { ascending: false });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}

export async function teacherPublishResult(params: {
  resultId: string;
  feedback?: string | null;
  isPublished: boolean;
}): Promise<ServiceResult<ResultRow>> {
  const actorResult = await requireRole(["teacher", "admin"]);
  if (!actorResult.ok) return actorResult;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("results")
    .update({
      graded_by: actorResult.data.userId,
      feedback: params.feedback ?? null,
      is_published: params.isPublished,
    })
    .eq("id", params.resultId)
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}
