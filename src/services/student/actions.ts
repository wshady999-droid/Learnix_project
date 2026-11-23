"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/services/db/utils";
import type { Json, ServiceResult } from "@/types";

// -----------------------------------------------------------------------------
// 1. COURSE ENROLLMENT ACTION
// -----------------------------------------------------------------------------
export async function studentEnrollInCourseAction(params: {
  courseId: string;
}): Promise<ServiceResult<{ enrollmentId: string }>> {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const studentId = auth.data.userId;

  const { data: existing } = await supabase
    .from("course_enrollments")
    .select("id")
    .eq("course_id", params.courseId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (existing) {
    return { ok: true, data: { enrollmentId: existing.id } };
  }

  const { data, error } = await supabase
    .from("course_enrollments")
    .insert({
      course_id: params.courseId,
      student_id: studentId,
      status: "active",
      progress_percent: 0,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "Failed to enroll in course.",
    };
  }

  revalidatePath("/student");
  revalidatePath("/student/courses");
  return { ok: true, data: { enrollmentId: data.id } };
}

// -----------------------------------------------------------------------------
// 2. LESSON PROGRESS, VIDEO RESUME & COURSE COMPLETION RECALCULATION
// -----------------------------------------------------------------------------
const updateLessonProgressSchema = z.object({
  courseId: z.string().uuid(),
  lessonId: z.string().uuid(),
  lastPositionSeconds: z.coerce.number().int().min(0).max(86400).default(0),
  watchedSecondsDelta: z.coerce.number().int().min(0).max(7200).default(60),
  isCompleted: z.boolean().default(false),
});

export async function studentUpdateLessonProgressAction(
  input: z.infer<typeof updateLessonProgressSchema>,
): Promise<ServiceResult<{ courseProgressPercent: number }>> {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) return auth;

  const parsed = updateLessonProgressSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid lesson progress input.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const studentId = auth.data.userId;

  const { data: existing } = await supabase
    .from("lesson_progress")
    .select("*")
    .eq("lesson_id", parsed.data.lessonId)
    .eq("student_id", studentId)
    .maybeSingle();

  const nextCompleted =
    parsed.data.isCompleted || Boolean(existing?.is_completed);
  const nextWatched =
    Number(existing?.watched_seconds ?? 0) + parsed.data.watchedSecondsDelta;

  if (existing) {
    const { error } = await supabase
      .from("lesson_progress")
      .update({
        last_position_seconds: parsed.data.lastPositionSeconds,
        watched_seconds: nextWatched,
        is_completed: nextCompleted,
        completed_at: nextCompleted
          ? existing.completed_at ?? new Date().toISOString()
          : null,
      })
      .eq("id", existing.id);

    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("lesson_progress").insert({
      course_id: parsed.data.courseId,
      lesson_id: parsed.data.lessonId,
      student_id: studentId,
      last_position_seconds: parsed.data.lastPositionSeconds,
      watched_seconds: parsed.data.watchedSecondsDelta,
      is_completed: nextCompleted,
      completed_at: nextCompleted ? new Date().toISOString() : null,
    });

    if (error) return { ok: false, error: error.message };
  }

  // Log study session activity
  if (parsed.data.watchedSecondsDelta > 0) {
    await supabase.from("study_sessions").insert({
      student_id: studentId,
      course_id: parsed.data.courseId,
      lesson_id: parsed.data.lessonId,
      duration_seconds: parsed.data.watchedSecondsDelta,
      ended_at: new Date().toISOString(),
    });
  }

  // Recalculate course completion percentage
  const [totalLessonsRes, completedLessonsRes] = await Promise.all([
    supabase
      .from("lessons")
      .select("id", { count: "exact", head: true })
      .eq("course_id", parsed.data.courseId)
      .eq("is_published", true),
    supabase
      .from("lesson_progress")
      .select("id", { count: "exact", head: true })
      .eq("course_id", parsed.data.courseId)
      .eq("student_id", studentId)
      .eq("is_completed", true),
  ]);

  const totalCount = totalLessonsRes.count ?? 0;
  const completedCount = completedLessonsRes.count ?? 0;
  const courseProgressPercent =
    totalCount > 0
      ? Math.min(100, Number(((completedCount / totalCount) * 100).toFixed(1)))
      : nextCompleted
        ? 100
        : 0;

  await supabase
    .from("course_enrollments")
    .update({
      progress_percent: courseProgressPercent,
      status: courseProgressPercent >= 100 ? "completed" : "active",
      completed_at:
        courseProgressPercent >= 100 ? new Date().toISOString() : undefined,
      last_accessed_at: new Date().toISOString(),
    })
    .eq("course_id", parsed.data.courseId)
    .eq("student_id", studentId);

  if (courseProgressPercent >= 100) {
    await supabase.rpc("issue_my_course_certificate", {
      p_course_id: parsed.data.courseId,
    });
  }

  revalidatePath("/student");
  revalidatePath("/student/courses");
  revalidatePath(`/student/courses/${parsed.data.lessonId}`);
  revalidatePath("/student/performance");
  revalidatePath("/student/motivation");
  return { ok: true, data: { courseProgressPercent } };
}

// -----------------------------------------------------------------------------
// 3. FAVORITE LESSONS & PERSONAL NOTES ACTIONS
// -----------------------------------------------------------------------------
export async function studentToggleFavoriteLessonAction(params: {
  courseId: string;
  lessonId: string;
}): Promise<ServiceResult<{ isFavorited: boolean }>> {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const studentId = auth.data.userId;

  const { data: existing } = await supabase
    .from("favorites")
    .select("id")
    .eq("student_id", studentId)
    .eq("lesson_id", params.lessonId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/student/courses");
    revalidatePath(`/student/courses/${params.lessonId}`);
    return { ok: true, data: { isFavorited: false } };
  }

  const { error } = await supabase.from("favorites").insert({
    student_id: studentId,
    course_id: params.courseId,
    lesson_id: params.lessonId,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/student/courses");
  revalidatePath(`/student/courses/${params.lessonId}`);
  return { ok: true, data: { isFavorited: true } };
}

const saveNoteSchema = z.object({
  lessonId: z.string().uuid(),
  content: z.string().trim().min(2).max(5000),
  videoTimestampSeconds: z.coerce.number().int().min(0).max(86400).nullable().optional(),
});

export async function studentSaveLessonNoteAction(
  input: z.infer<typeof saveNoteSchema>,
): Promise<ServiceResult<{ noteId: string }>> {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) return auth;

  const parsed = saveNoteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid note content.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("lesson_notes")
    .insert({
      student_id: auth.data.userId,
      lesson_id: parsed.data.lessonId,
      content: parsed.data.content,
      video_timestamp_seconds: parsed.data.videoTimestampSeconds ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to save note." };
  }

  revalidatePath(`/student/courses/${parsed.data.lessonId}`);
  return { ok: true, data: { noteId: data.id } };
}

export async function studentDeleteLessonNoteAction(params: {
  noteId: string;
  lessonId: string;
}): Promise<ServiceResult<{ deleted: boolean }>> {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("lesson_notes")
    .delete()
    .eq("id", params.noteId)
    .eq("student_id", auth.data.userId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/student/courses/${params.lessonId}`);
  return { ok: true, data: { deleted: true } };
}

// -----------------------------------------------------------------------------
// 4. CERTIFICATE CLAIM & COURSE / TEACHER RATINGS (NO DUPLICATES)
// -----------------------------------------------------------------------------
export async function studentClaimCourseCertificateAction(params: {
  courseId: string;
}): Promise<ServiceResult<{ certificateNumber: string }>> {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("issue_my_course_certificate", {
    p_course_id: params.courseId,
  });

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "Course is not yet eligible for certificate issuance.",
    };
  }

  revalidatePath("/student/motivation");
  revalidatePath("/student/profile");
  return { ok: true, data: { certificateNumber: data.certificate_number } };
}

const submitCourseReviewSchema = z.object({
  courseId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(2500).optional(),
});

export async function studentSaveCourseReviewAction(
  input: z.infer<typeof submitCourseReviewSchema>,
): Promise<ServiceResult<{ reviewId: string }>> {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) return auth;

  const parsed = submitCourseReviewSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid course review.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const studentId = auth.data.userId;

  // Enforce completed-course eligibility on the server
  const { data: enrollment } = await supabase
    .from("course_enrollments")
    .select("status, progress_percent")
    .eq("course_id", parsed.data.courseId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (
    !enrollment ||
    (enrollment.status !== "completed" &&
      Number(enrollment.progress_percent ?? 0) < 100)
  ) {
    return {
      ok: false,
      error:
        "Only students who have completed 100% of this course can submit a course rating.",
    };
  }

  // Upsert on (course_id, student_id) prevents duplicates and allows policy-compliant edits
  const { data: existing } = await supabase
    .from("course_reviews")
    .select("id")
    .eq("course_id", parsed.data.courseId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("course_reviews")
      .update({
        rating: parsed.data.rating,
        comment: parsed.data.comment || null,
      })
      .eq("id", existing.id)
      .eq("student_id", studentId)
      .select("id")
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Failed to update course rating." };
    }
    revalidatePath("/student/ratings");
    return { ok: true, data: { reviewId: data.id } };
  }

  const { data, error } = await supabase
    .from("course_reviews")
    .insert({
      course_id: parsed.data.courseId,
      student_id: studentId,
      rating: parsed.data.rating,
      comment: parsed.data.comment || null,
      is_published: true,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to submit course rating." };
  }

  revalidatePath("/student/ratings");
  return { ok: true, data: { reviewId: data.id } };
}

const submitTeacherReviewSchema = z.object({
  courseId: z.string().uuid(),
  teacherId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(2500).optional(),
});

export async function studentSaveTeacherReviewAction(
  input: z.infer<typeof submitTeacherReviewSchema>,
): Promise<ServiceResult<{ reviewId: string }>> {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) return auth;

  const parsed = submitTeacherReviewSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid teacher review.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const studentId = auth.data.userId;

  const { data: existing } = await supabase
    .from("teacher_reviews")
    .select("id")
    .eq("teacher_id", parsed.data.teacherId)
    .eq("student_id", studentId)
    .eq("course_id", parsed.data.courseId)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("teacher_reviews")
      .update({
        rating: parsed.data.rating,
        comment: parsed.data.comment || null,
      })
      .eq("id", existing.id)
      .eq("student_id", studentId)
      .select("id")
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Failed to update teacher rating." };
    }
    revalidatePath("/student/ratings");
    return { ok: true, data: { reviewId: data.id } };
  }

  const { data, error } = await supabase
    .from("teacher_reviews")
    .insert({
      teacher_id: parsed.data.teacherId,
      student_id: studentId,
      course_id: parsed.data.courseId,
      rating: parsed.data.rating,
      comment: parsed.data.comment || null,
      is_published: true,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to submit teacher rating." };
  }

  revalidatePath("/student/ratings");
  return { ok: true, data: { reviewId: data.id } };
}

export async function studentMarkNotificationsReadAction(): Promise<
  ServiceResult<{ updated: boolean }>
> {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("notification_recipients")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("recipient_id", auth.data.userId)
    .eq("is_read", false);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/student");
  return { ok: true, data: { updated: true } };
}

// -----------------------------------------------------------------------------
// 5. PART 8 — SECURE EXAMINATION ATTEMPT, AUTO-SAVE, VIOLATIONS & SUBMISSION
// -----------------------------------------------------------------------------
const startExamAttemptSchema = z.object({
  examId: z.string().uuid(),
  cameraConsentGranted: z.boolean().default(false),
  guardianConsentConfirmed: z.boolean().default(false),
});

export async function studentStartExamAttemptAction(
  input: z.infer<typeof startExamAttemptSchema>,
): Promise<ServiceResult<{ attemptId: string }>> {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) return auth;

  const parsed = startExamAttemptSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid exam start parameters.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const studentId = auth.data.userId;

  const { data: exam, error: examErr } = await supabase
    .from("exams")
    .select("*")
    .eq("id", parsed.data.examId)
    .maybeSingle();

  if (examErr || !exam) {
    return {
      ok: false,
      error: examErr?.message ?? "Examination not found or unavailable.",
    };
  }

  if (exam.status !== "published") {
    return { ok: false, error: "This examination is not currently open." };
  }

  const now = new Date();
  if (exam.available_from && new Date(exam.available_from) > now) {
    return { ok: false, error: "This examination has not started yet." };
  }
  if (exam.available_until && new Date(exam.available_until) < now) {
    return { ok: false, error: "The examination availability window has ended." };
  }

  if (
    auth.data.role === "student" &&
    exam.assigned_student_ids &&
    exam.assigned_student_ids.length > 0 &&
    !exam.assigned_student_ids.includes(studentId)
  ) {
    return { ok: false, error: "You are not assigned to this examination." };
  }

  if (exam.camera_monitoring_enabled) {
    if (!parsed.data.cameraConsentGranted || !parsed.data.guardianConsentConfirmed) {
      return {
        ok: false,
        error:
          "Explicit camera monitoring and student/guardian privacy consent are required before starting this examination.",
      };
    }
  }

  // Check existing attempts for this student
  const { data: existingAttempts, error: attErr } = await supabase
    .from("exam_attempts")
    .select("*")
    .eq("exam_id", exam.id)
    .eq("student_id", studentId)
    .order("attempt_number", { ascending: false });

  if (attErr) return { ok: false, error: attErr.message };

  const active = (existingAttempts ?? []).find((a) => a.status === "in_progress");
  if (active) {
    return { ok: true, data: { attemptId: active.id } };
  }

  const usedCount = (existingAttempts ?? []).length;
  if (usedCount >= exam.max_attempts) {
    return {
      ok: false,
      error: `Maximum allowed attempts (${exam.max_attempts}) reached for this examination.`,
    };
  }

  // Fetch questions and prepare randomized / multi-version question draw
  const { data: allQuestions } = await supabase
    .from("questions")
    .select("id, position")
    .eq("exam_id", exam.id)
    .order("position", { ascending: true });

  const questionIds = (allQuestions ?? []).map((q) => q.id);
  const assignedVersion =
    exam.version_count > 1 ? ((usedCount % exam.version_count) + 1) : 1;

  let drawnIds = [...questionIds];
  if (exam.shuffle_questions || exam.version_count > 1) {
    for (let i = drawnIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = drawnIds[i]!;
      drawnIds[i] = drawnIds[j]!;
      drawnIds[j] = tmp;
    }
  }
  if (exam.random_question_count && exam.random_question_count > 0) {
    drawnIds = drawnIds.slice(0, exam.random_question_count);
  }

  const expiresAt = new Date(
    now.getTime() + exam.duration_minutes * 60 * 1000,
  ).toISOString();

  const { data: created, error: createErr } = await supabase
    .from("exam_attempts")
    .insert({
      exam_id: exam.id,
      student_id: studentId,
      attempt_number: usedCount + 1,
      status: "in_progress",
      started_at: now.toISOString(),
      expires_at: expiresAt,
      assigned_version: assignedVersion,
      assigned_question_ids: drawnIds,
      camera_consent_granted: parsed.data.cameraConsentGranted,
      guardian_consent_confirmed: parsed.data.guardianConsentConfirmed,
      consent_recorded_at:
        parsed.data.cameraConsentGranted || parsed.data.guardianConsentConfirmed
          ? now.toISOString()
          : null,
    })
    .select("id")
    .single();

  if (createErr || !created) {
    return {
      ok: false,
      error: createErr?.message ?? "Failed to start examination attempt.",
    };
  }

  revalidatePath("/student/exams");
  revalidatePath(`/student/exams/${exam.id}`);
  return { ok: true, data: { attemptId: created.id } };
}

const saveAnswerSchema = z.object({
  examId: z.string().uuid(),
  attemptId: z.string().uuid(),
  questionId: z.string().uuid(),
  selectedOptionId: z.string().uuid().nullable().optional(),
  selectedOptionIds: z.array(z.string().uuid()).default([]),
  answerText: z.string().max(15000).nullable().optional(),
});

export async function studentSaveExamAnswerAction(
  input: z.infer<typeof saveAnswerSchema>,
): Promise<ServiceResult<{ savedAt: string }>> {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) return auth;

  const parsed = saveAnswerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid answer payload.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("student_answers")
    .select("id")
    .eq("attempt_id", parsed.data.attemptId)
    .eq("question_id", parsed.data.questionId)
    .maybeSingle();

  const nowIso = new Date().toISOString();

  if (existing) {
    const { error } = await supabase
      .from("student_answers")
      .update({
        selected_option_id: parsed.data.selectedOptionId ?? null,
        selected_option_ids: parsed.data.selectedOptionIds,
        answer_text: parsed.data.answerText ?? null,
        answered_at: nowIso,
      })
      .eq("id", existing.id);

    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("student_answers").insert({
      attempt_id: parsed.data.attemptId,
      question_id: parsed.data.questionId,
      selected_option_id: parsed.data.selectedOptionId ?? null,
      selected_option_ids: parsed.data.selectedOptionIds,
      answer_text: parsed.data.answerText ?? null,
      answered_at: nowIso,
    });

    if (error) return { ok: false, error: error.message };
  }

  return { ok: true, data: { savedAt: nowIso } };
}

const logViolationSchema = z.object({
  attemptId: z.string().uuid(),
  violationType: z.string().trim().min(2).max(80),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  details: z.record(z.string(), z.unknown()).default({}),
});

export async function studentLogExamViolationAction(
  input: z.infer<typeof logViolationSchema>,
): Promise<ServiceResult<{ recorded: boolean }>> {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) return auth;

  const parsed = logViolationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid violation payload.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("exam_violations").insert({
    attempt_id: parsed.data.attemptId,
    student_id: auth.data.userId,
    violation_type: parsed.data.violationType,
    severity: parsed.data.severity,
    details: parsed.data.details as Json,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { recorded: true } };
}

export async function studentSubmitExamAttemptAction(params: {
  examId: string;
  attemptId: string;
}): Promise<
  ServiceResult<{
    scorePercent: number;
    passed: boolean;
    isPublished: boolean;
  }>
> {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("submit_exam_attempt", {
    p_attempt_id: params.attemptId,
  });

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "Failed to submit and grade examination.",
    };
  }

  revalidatePath("/student");
  revalidatePath("/student/exams");
  revalidatePath(`/student/exams/${params.examId}`);
  revalidatePath("/student/performance");
  revalidatePath("/teacher");
  revalidatePath("/teacher/grading");

  return {
    ok: true,
    data: {
      scorePercent: Number(data.score_percent ?? 0),
      passed: Boolean(data.passed),
      isPublished: Boolean(data.is_published),
    },
  };
}
