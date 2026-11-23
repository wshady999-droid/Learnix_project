import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedActor, requireRole, type TableRow } from "@/services/db/utils";
import type { ServiceResult } from "@/types";

export type StudySessionRow = TableRow<"study_sessions">;

export interface StudentAnalyticsSummary {
  enrolledCoursesCount: number;
  completedCoursesCount: number;
  averageCourseProgress: number;
  examsCompletedCount: number;
  averageExamScore: number;
  totalStudySeconds: number;
  certificatesCount: number;
}

export interface PlatformAnalyticsSummary {
  publishedCoursesCount: number;
  activeEnrollmentsCount: number;
  totalExamsCount: number;
  totalCertificatesCount: number;
}

export async function getStudentAnalyticsSummary(): Promise<
  ServiceResult<StudentAnalyticsSummary>
> {
  const actorResult = await getAuthenticatedActor();
  if (!actorResult.ok) return actorResult;
  if (!actorResult.data) return { ok: false, error: "Authentication required." };

  const studentId = actorResult.data.userId;
  const supabase = await createSupabaseServerClient();

  const [enrollmentsRes, resultsRes, sessionsRes, certsRes] = await Promise.all([
    supabase
      .from("course_enrollments")
      .select("status, progress_percent")
      .eq("student_id", studentId),
    supabase
      .from("results")
      .select("score_percent")
      .eq("student_id", studentId)
      .eq("is_published", true),
    supabase.from("study_sessions").select("duration_seconds").eq("student_id", studentId),
    supabase
      .from("certificates")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId),
  ]);

  if (enrollmentsRes.error) return { ok: false, error: enrollmentsRes.error.message };
  if (resultsRes.error) return { ok: false, error: resultsRes.error.message };
  if (sessionsRes.error) return { ok: false, error: sessionsRes.error.message };
  if (certsRes.error) return { ok: false, error: certsRes.error.message };

  const enrollments = enrollmentsRes.data ?? [];
  const results = resultsRes.data ?? [];
  const sessions = sessionsRes.data ?? [];

  const enrolledCoursesCount = enrollments.length;
  const completedCoursesCount = enrollments.filter((e) => e.status === "completed").length;
  const averageCourseProgress =
    enrolledCoursesCount > 0
      ? Number(
          (
            enrollments.reduce((acc, e) => acc + Number(e.progress_percent ?? 0), 0) /
            enrolledCoursesCount
          ).toFixed(2),
        )
      : 0;

  const examsCompletedCount = results.length;
  const averageExamScore =
    examsCompletedCount > 0
      ? Number(
          (
            results.reduce((acc, r) => acc + Number(r.score_percent ?? 0), 0) /
            examsCompletedCount
          ).toFixed(2),
        )
      : 0;

  const totalStudySeconds = sessions.reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0);

  return {
    ok: true,
    data: {
      enrolledCoursesCount,
      completedCoursesCount,
      averageCourseProgress,
      examsCompletedCount,
      averageExamScore,
      totalStudySeconds,
      certificatesCount: certsRes.count ?? 0,
    },
  };
}

export async function recordStudySession(params: {
  courseId?: string | null;
  lessonId?: string | null;
  durationSeconds: number;
  aiInteractionsCount?: number;
}): Promise<ServiceResult<StudySessionRow>> {
  const actorResult = await getAuthenticatedActor();
  if (!actorResult.ok) return actorResult;
  if (!actorResult.data) return { ok: false, error: "Authentication required." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("study_sessions")
    .insert({
      student_id: actorResult.data.userId,
      course_id: params.courseId ?? null,
      lesson_id: params.lessonId ?? null,
      duration_seconds: Math.max(0, Math.floor(params.durationSeconds)),
      ai_interactions_count: Math.max(0, Math.floor(params.aiInteractionsCount ?? 0)),
      ended_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

export async function getAdminPlatformAnalytics(): Promise<
  ServiceResult<PlatformAnalyticsSummary>
> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const supabase = await createSupabaseServerClient();

  const [coursesCountRes, enrollmentsCountRes, examsCountRes, certsCountRes] = await Promise.all([
    supabase
      .from("courses")
      .select("id", { count: "exact", head: true })
      .eq("status", "published"),
    supabase
      .from("course_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase.from("exams").select("id", { count: "exact", head: true }),
    supabase.from("certificates").select("id", { count: "exact", head: true }),
  ]);

  if (coursesCountRes.error) return { ok: false, error: coursesCountRes.error.message };
  if (enrollmentsCountRes.error) return { ok: false, error: enrollmentsCountRes.error.message };
  if (examsCountRes.error) return { ok: false, error: examsCountRes.error.message };
  if (certsCountRes.error) return { ok: false, error: certsCountRes.error.message };

  return {
    ok: true,
    data: {
      publishedCoursesCount: coursesCountRes.count ?? 0,
      activeEnrollmentsCount: enrollmentsCountRes.count ?? 0,
      totalExamsCount: examsCountRes.count ?? 0,
      totalCertificatesCount: certsCountRes.count ?? 0,
    },
  };
}
