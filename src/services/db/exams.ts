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

export type ExamRow = TableRow<"exams">;
export type QuestionRow = TableRow<"questions">;
export type QuestionOptionRow = TableRow<"question_options">;
export type ExamSessionRow = TableRow<"exam_sessions">;
export type ExamAttemptRow = TableRow<"exam_attempts">;
export type StudentAnswerRow = TableRow<"student_answers">;
export type ExamViolationRow = TableRow<"exam_violations">;
export type AssignmentRow = TableRow<"assignments">;
export type AssignmentSubmissionRow = TableRow<"assignment_submissions">;

const createExamSchema = z.object({
  course_id: z.string().uuid(),
  chapter_id: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(4).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  instructions: z.string().trim().max(3000).nullable().optional(),
  duration_minutes: z.number().int().min(5).max(480).default(60),
  total_points: z.number().positive().default(100),
  passing_score: z.number().min(0).max(100).default(60),
  max_attempts: z.number().int().min(1).max(10).default(1),
  shuffle_questions: z.boolean().default(true),
  shuffle_options: z.boolean().default(true),
  show_results_immediately: z.boolean().default(false),
  strict_proctoring: z.boolean().default(true),
  max_violations_allowed: z.number().int().min(0).max(20).default(3),
});

export async function listCourseExams(courseId: string): Promise<ServiceResult<ExamRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("exams")
    .select("*")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}

export async function createExam(
  input: z.infer<typeof createExamSchema>,
): Promise<ServiceResult<ExamRow>> {
  const parsed = createExamSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid exam configuration." };
  }

  const actorResult = await requireRole(["teacher", "admin"]);
  if (!actorResult.ok) return actorResult;

  const supabase = await createSupabaseServerClient();
  const payload: TableInsert<"exams"> = {
    ...parsed.data,
    created_by: actorResult.data.userId,
    status: "draft",
  };

  const { data, error } = await supabase
    .from("exams")
    .insert(payload)
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

export async function startExamAttempt(params: {
  examId: string;
  examSessionId?: string | null;
}): Promise<ServiceResult<ExamAttemptRow>> {
  const actorResult = await getAuthenticatedActor();
  if (!actorResult.ok) return actorResult;
  if (!actorResult.data) return { ok: false, error: "Authentication required." };

  const supabase = await createSupabaseServerClient();

  const { data: exam, error: examError } = await supabase
    .from("exams")
    .select("id, duration_minutes, max_attempts")
    .eq("id", params.examId)
    .single();

  if (examError || !exam) {
    return { ok: false, error: examError?.message ?? "Exam not found." };
  }

  const { count: previousCount, error: countError } = await supabase
    .from("exam_attempts")
    .select("id", { count: "exact", head: true })
    .eq("exam_id", params.examId)
    .eq("student_id", actorResult.data.userId);

  if (countError) return { ok: false, error: countError.message };
  const nextAttemptNumber = (previousCount ?? 0) + 1;

  if (nextAttemptNumber > exam.max_attempts) {
    return { ok: false, error: "Maximum allowed attempts for this examination reached." };
  }

  const expiresAt = new Date(Date.now() + exam.duration_minutes * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("exam_attempts")
    .insert({
      exam_id: params.examId,
      exam_session_id: params.examSessionId ?? null,
      student_id: actorResult.data.userId,
      attempt_number: nextAttemptNumber,
      status: "in_progress",
      expires_at: expiresAt,
    })
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

export async function saveStudentAnswer(params: {
  attemptId: string;
  questionId: string;
  selectedOptionId?: string | null;
  answerText?: string | null;
}): Promise<ServiceResult<StudentAnswerRow>> {
  const actorResult = await getAuthenticatedActor();
  if (!actorResult.ok) return actorResult;
  if (!actorResult.data) return { ok: false, error: "Authentication required." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_answers")
    .upsert(
      {
        attempt_id: params.attemptId,
        question_id: params.questionId,
        selected_option_id: params.selectedOptionId ?? null,
        answer_text: params.answerText ?? null,
      },
      { onConflict: "attempt_id,question_id" },
    )
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

export async function logExamViolation(params: {
  attemptId: string;
  violationType: string;
  severity?: "low" | "medium" | "high" | "critical";
  details?: Record<string, string | number | boolean | null>;
}): Promise<ServiceResult<ExamViolationRow>> {
  const actorResult = await getAuthenticatedActor();
  if (!actorResult.ok) return actorResult;
  if (!actorResult.data) return { ok: false, error: "Authentication required." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("exam_violations")
    .insert({
      attempt_id: params.attemptId,
      student_id: actorResult.data.userId,
      violation_type: params.violationType,
      severity: params.severity ?? "medium",
      details: params.details ?? {},
    })
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}
