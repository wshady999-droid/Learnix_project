"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { COURSE_CATEGORIES } from "@/lib/constants/categories";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/services/db/utils";
import type { Json, ServiceResult } from "@/types";

async function logTeacherAudit(params: {
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  newValues?: Record<string, unknown>;
}) {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.from("audit_logs").insert({
      actor_id: params.actorId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      new_values: (params.newValues ?? {}) as Json,
    });
  } catch {
    // Non-blocking audit logging
  }
}

async function verifyTeacherOwnsCourse(params: {
  courseId: string;
  userId: string;
  role: string;
}): Promise<boolean> {
  if (params.role === "admin") return true;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("courses")
    .select("id, teacher_id")
    .eq("id", params.courseId)
    .maybeSingle();

  if (error || !data) return false;
  return data.teacher_id === params.userId;
}

// -----------------------------------------------------------------------------
// 1. COURSE & CURRICULUM MANAGEMENT ACTIONS
// -----------------------------------------------------------------------------
const saveCourseSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().min(2).max(24),
  title: z.string().trim().min(3).max(160),
  category: z.enum(COURSE_CATEGORIES).default(COURSE_CATEGORIES[0]),
  summary: z.string().trim().max(400).optional(),
  description: z.string().trim().max(5000).optional(),
  departmentId: z.string().uuid().nullable().optional(),
  educationalLevelId: z.string().uuid().nullable().optional(),
  language: z.enum(["en", "ar", "de", "it", "fr"]).default("en"),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  estimatedHours: z.coerce.number().min(0).max(1000).default(10),
  passingScore: z.coerce.number().min(0).max(100).default(60),
  completionRequirements: z.string().trim().max(2000).optional(),
  thumbnailUrl: z.string().trim().max(1000).nullable().optional(),
});

export async function teacherSaveCourseAction(
  input: z.infer<typeof saveCourseSchema>,
): Promise<ServiceResult<{ id: string }>> {
  const auth = await requireRole(["teacher", "admin"]);
  if (!auth.ok) return auth;

  const parsed = saveCourseSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid course parameters.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const slugBase = parsed.data.code
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  if (parsed.data.id) {
    const allowed = await verifyTeacherOwnsCourse({
      courseId: parsed.data.id,
      userId: auth.data.userId,
      role: auth.data.role,
    });
    if (!allowed) {
      return { ok: false, error: "You are not authorized to edit this course." };
    }

    const { data, error } = await supabase
      .from("courses")
      .update({
        code: parsed.data.code.toUpperCase(),
        title: parsed.data.title,
        category: parsed.data.category,
        subtitle: parsed.data.summary || null,
        description: parsed.data.description || null,
        department_id: parsed.data.departmentId ?? null,
        educational_level_id: parsed.data.educationalLevelId ?? null,
        language: parsed.data.language,
        status: parsed.data.status,
        estimated_hours: parsed.data.estimatedHours,
        passing_score: parsed.data.passingScore,
        completion_requirements: parsed.data.completionRequirements || null,
        thumbnail_url: parsed.data.thumbnailUrl ?? null,
        published_at:
          parsed.data.status === "published" ? new Date().toISOString() : undefined,
      })
      .eq("id", parsed.data.id)
      .select("id")
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Failed to update course." };
    }

    await logTeacherAudit({
      actorId: auth.data.userId,
      action: "teacher.course.update",
      entityType: "courses",
      entityId: data.id,
      newValues: { title: parsed.data.title, status: parsed.data.status },
    });

    revalidatePath("/teacher");
    revalidatePath("/teacher/courses");
    revalidatePath("/student");
    revalidatePath("/student/courses");
    return { ok: true, data: { id: data.id } };
  }

  const uniqueSlug = `${slugBase || "course"}-${Math.floor(1000 + Math.random() * 9000)}`;
  const { data, error } = await supabase
    .from("courses")
    .insert({
      code: parsed.data.code.toUpperCase(),
      slug: uniqueSlug,
      title: parsed.data.title,
      category: parsed.data.category || COURSE_CATEGORIES[0],
      subtitle: parsed.data.summary || null,
      description: parsed.data.description || null,
      teacher_id: auth.data.userId,
      department_id: parsed.data.departmentId ?? null,
      educational_level_id: parsed.data.educationalLevelId ?? null,
      language: parsed.data.language,
      status: parsed.data.status,
      estimated_hours: parsed.data.estimatedHours,
      passing_score: parsed.data.passingScore,
      completion_requirements: parsed.data.completionRequirements || null,
      thumbnail_url: parsed.data.thumbnailUrl ?? null,
      published_at:
        parsed.data.status === "published" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create course." };
  }

  await logTeacherAudit({
    actorId: auth.data.userId,
    action: "teacher.course.create",
    entityType: "courses",
    entityId: data.id,
    newValues: { title: parsed.data.title, code: parsed.data.code },
  });

  revalidatePath("/teacher");
  revalidatePath("/teacher/courses");
  revalidatePath("/student");
  revalidatePath("/student/courses");
  return { ok: true, data: { id: data.id } };
}

const saveChapterSchema = z.object({
  id: z.string().uuid().optional(),
  courseId: z.string().uuid(),
  title: z.string().trim().min(2).max(160),
  summary: z.string().trim().max(500).optional(),
  positionOrder: z.coerce.number().int().min(1).max(500).default(1),
  isPublished: z.boolean().default(true),
});

export async function teacherSaveChapterAction(
  input: z.infer<typeof saveChapterSchema>,
): Promise<ServiceResult<{ id: string }>> {
  const auth = await requireRole(["teacher", "admin"]);
  if (!auth.ok) return auth;

  const parsed = saveChapterSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid chapter parameters.",
    };
  }

  const allowed = await verifyTeacherOwnsCourse({
    courseId: parsed.data.courseId,
    userId: auth.data.userId,
    role: auth.data.role,
  });
  if (!allowed) {
    return { ok: false, error: "You do not own this course." };
  }

  const supabase = await createSupabaseServerClient();

  if (parsed.data.id) {
    const { data, error } = await supabase
      .from("chapters")
      .update({
        title: parsed.data.title,
        description: parsed.data.summary || null,
        position: parsed.data.positionOrder,
        is_published: parsed.data.isPublished,
      })
      .eq("id", parsed.data.id)
      .eq("course_id", parsed.data.courseId)
      .select("id")
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Failed to update chapter." };
    }
    revalidatePath("/teacher/courses");
    return { ok: true, data: { id: data.id } };
  }

  const { data, error } = await supabase
    .from("chapters")
    .insert({
      course_id: parsed.data.courseId,
      title: parsed.data.title,
      description: parsed.data.summary || null,
      position: parsed.data.positionOrder,
      is_published: parsed.data.isPublished,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create chapter." };
  }

  revalidatePath("/teacher/courses");
  return { ok: true, data: { id: data.id } };
}

export async function teacherDeleteChapterAction(params: {
  chapterId: string;
  courseId: string;
}): Promise<ServiceResult<{ deleted: boolean }>> {
  const auth = await requireRole(["teacher", "admin"]);
  if (!auth.ok) return auth;

  const allowed = await verifyTeacherOwnsCourse({
    courseId: params.courseId,
    userId: auth.data.userId,
    role: auth.data.role,
  });
  if (!allowed) {
    return { ok: false, error: "You do not own this course." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("chapters")
    .delete()
    .eq("id", params.chapterId)
    .eq("course_id", params.courseId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/teacher/courses");
  return { ok: true, data: { deleted: true } };
}

const saveLessonSchema = z.object({
  id: z.string().uuid().optional(),
  courseId: z.string().uuid(),
  chapterId: z.string().uuid(),
  title: z.string().trim().min(2).max(160),
  contentType: z
    .enum(["video", "pdf", "presentation", "article", "quiz"])
    .default("video"),
  summary: z.string().trim().max(500).optional(),
  bodyMarkdown: z.string().trim().max(15000).optional(),
  durationMinutes: z.coerce.number().int().min(1).max(600).default(15),
  positionOrder: z.coerce.number().int().min(1).max(500).default(1),
  videoStoragePath: z.string().trim().max(500).nullable().optional(),
  attachmentStoragePath: z.string().trim().max(500).nullable().optional(),
  externalResourceUrl: z.string().trim().max(1000).nullable().optional(),
  scheduledPublishAt: z.string().trim().nullable().optional(),
  isPreview: z.boolean().default(false),
  isPublished: z.boolean().default(true),
});

export async function teacherSaveLessonAction(
  input: z.infer<typeof saveLessonSchema>,
): Promise<ServiceResult<{ id: string }>> {
  const auth = await requireRole(["teacher", "admin"]);
  if (!auth.ok) return auth;

  const parsed = saveLessonSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid lesson parameters.",
    };
  }

  const allowed = await verifyTeacherOwnsCourse({
    courseId: parsed.data.courseId,
    userId: auth.data.userId,
    role: auth.data.role,
  });
  if (!allowed) {
    return { ok: false, error: "You do not own this course." };
  }

  const supabase = await createSupabaseServerClient();
  const payload = {
    course_id: parsed.data.courseId,
    chapter_id: parsed.data.chapterId,
    title: parsed.data.title,
    content_type: parsed.data.contentType,
    summary: parsed.data.summary || null,
    content_markdown: parsed.data.bodyMarkdown || null,
    duration_seconds: parsed.data.durationMinutes * 60,
    position: parsed.data.positionOrder,
    video_storage_path: parsed.data.videoStoragePath || null,
    attachment_storage_path: parsed.data.attachmentStoragePath || null,
    external_resource_url: parsed.data.externalResourceUrl || null,
    scheduled_publish_at: parsed.data.scheduledPublishAt || null,
    is_preview: parsed.data.isPreview,
    is_published: parsed.data.isPublished,
  };

  if (parsed.data.id) {
    const { data, error } = await supabase
      .from("lessons")
      .update(payload)
      .eq("id", parsed.data.id)
      .eq("course_id", parsed.data.courseId)
      .select("id")
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Failed to update lesson." };
    }
    revalidatePath("/teacher/courses");
    return { ok: true, data: { id: data.id } };
  }

  const { data, error } = await supabase
    .from("lessons")
    .insert(payload)
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create lesson." };
  }

  revalidatePath("/teacher/courses");
  return { ok: true, data: { id: data.id } };
}

export async function teacherDeleteLessonAction(params: {
  lessonId: string;
  courseId: string;
}): Promise<ServiceResult<{ deleted: boolean }>> {
  const auth = await requireRole(["teacher", "admin"]);
  if (!auth.ok) return auth;

  const allowed = await verifyTeacherOwnsCourse({
    courseId: params.courseId,
    userId: auth.data.userId,
    role: auth.data.role,
  });
  if (!allowed) {
    return { ok: false, error: "You do not own this course." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("lessons")
    .delete()
    .eq("id", params.lessonId)
    .eq("course_id", params.courseId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/teacher/courses");
  return { ok: true, data: { deleted: true } };
}

// -----------------------------------------------------------------------------
// 2. SMART EXAM BUILDER ACTIONS
// -----------------------------------------------------------------------------
const saveExamSchema = z.object({
  id: z.string().uuid().optional(),
  courseId: z.string().uuid(),
  chapterId: z.string().uuid().nullable().optional(),
  classId: z.string().uuid().nullable().optional(),
  assignedStudentIds: z.array(z.string().uuid()).default([]),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(4000).optional(),
  instructions: z.string().trim().max(4000).optional(),
  durationMinutes: z.coerce.number().int().min(5).max(360).default(45),
  totalPoints: z.coerce.number().min(1).max(1000).default(100),
  passingScore: z.coerce.number().min(1).max(100).default(60),
  maxAttempts: z.coerce.number().int().min(1).max(10).default(1),
  randomQuestionCount: z.coerce.number().int().min(0).max(500).nullable().optional(),
  versionCount: z.coerce.number().int().min(1).max(10).default(1),
  availableFrom: z.string().trim().nullable().optional(),
  availableUntil: z.string().trim().nullable().optional(),
  shuffleQuestions: z.boolean().default(true),
  shuffleOptions: z.boolean().default(true),
  strictProctoring: z.boolean().default(true),
  cameraMonitoringEnabled: z.boolean().default(false),
  allowAnswerReview: z.boolean().default(true),
  retentionDays: z.coerce.number().int().min(1).max(365).default(30),
  showResultsImmediately: z.boolean().default(true),
  status: z.enum(["draft", "published", "closed", "archived"]).default("draft"),
});

export async function teacherSaveExamAction(
  input: z.infer<typeof saveExamSchema>,
): Promise<ServiceResult<{ id: string }>> {
  const auth = await requireRole(["teacher", "admin"]);
  if (!auth.ok) return auth;

  const parsed = saveExamSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid examination parameters.",
    };
  }

  const allowed = await verifyTeacherOwnsCourse({
    courseId: parsed.data.courseId,
    userId: auth.data.userId,
    role: auth.data.role,
  });
  if (!allowed) {
    return { ok: false, error: "You are not authorized to create exams for this course." };
  }

  const supabase = await createSupabaseServerClient();
  const payload = {
    course_id: parsed.data.courseId,
    chapter_id: parsed.data.chapterId ?? null,
    class_id: parsed.data.classId ?? null,
    assigned_student_ids: parsed.data.assignedStudentIds,
    title: parsed.data.title,
    description: parsed.data.description || null,
    instructions: parsed.data.instructions || null,
    duration_minutes: parsed.data.durationMinutes,
    total_points: parsed.data.totalPoints,
    passing_score: parsed.data.passingScore,
    max_attempts: parsed.data.maxAttempts,
    random_question_count:
      parsed.data.randomQuestionCount && parsed.data.randomQuestionCount > 0
        ? parsed.data.randomQuestionCount
        : null,
    version_count: parsed.data.versionCount,
    available_from: parsed.data.availableFrom || null,
    available_until: parsed.data.availableUntil || null,
    shuffle_questions: parsed.data.shuffleQuestions,
    shuffle_options: parsed.data.shuffleOptions,
    strict_proctoring: parsed.data.strictProctoring,
    camera_monitoring_enabled: parsed.data.cameraMonitoringEnabled,
    allow_answer_review: parsed.data.allowAnswerReview,
    retention_days: parsed.data.retentionDays,
    show_results_immediately: parsed.data.showResultsImmediately,
    status: parsed.data.status,
  };

  if (parsed.data.id) {
    const { data, error } = await supabase
      .from("exams")
      .update(payload)
      .eq("id", parsed.data.id)
      .select("id")
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Failed to update examination." };
    }

    await logTeacherAudit({
      actorId: auth.data.userId,
      action: "teacher.exam.update",
      entityType: "exams",
      entityId: data.id,
      newValues: { title: parsed.data.title, status: parsed.data.status },
    });

    revalidatePath("/teacher");
    revalidatePath("/teacher/exams");
    return { ok: true, data: { id: data.id } };
  }

  const { data, error } = await supabase
    .from("exams")
    .insert({
      ...payload,
      created_by: auth.data.userId,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create examination." };
  }

  await logTeacherAudit({
    actorId: auth.data.userId,
    action: "teacher.exam.create",
    entityType: "exams",
    entityId: data.id,
    newValues: { title: parsed.data.title, courseId: parsed.data.courseId },
  });

  revalidatePath("/teacher");
  revalidatePath("/teacher/exams");
  return { ok: true, data: { id: data.id } };
}

const questionOptionSchema = z.object({
  optionText: z.string().trim().min(1).max(500),
  isCorrect: z.boolean(),
});

const saveQuestionSchema = z.object({
  id: z.string().uuid().optional(),
  examId: z.string().uuid(),
  courseId: z.string().uuid(),
  questionType: z.enum([
    "single_choice",
    "multiple_choice",
    "true_false",
    "short_answer",
    "essay",
  ]),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  prompt: z.string().trim().min(3).max(4000),
  explanation: z.string().trim().max(3000).optional(),
  points: z.coerce.number().min(0.5).max(200).default(5),
  positionOrder: z.coerce.number().int().min(1).max(500).default(1),
  mediaUrl: z.string().trim().max(1000).nullable().optional(),
  isInBank: z.boolean().default(true),
  options: z.array(questionOptionSchema).default([]),
});

export async function teacherSaveQuestionAction(
  input: z.infer<typeof saveQuestionSchema>,
): Promise<ServiceResult<{ id: string }>> {
  const auth = await requireRole(["teacher", "admin"]);
  if (!auth.ok) return auth;

  const parsed = saveQuestionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid question parameters.",
    };
  }

  const allowed = await verifyTeacherOwnsCourse({
    courseId: parsed.data.courseId,
    userId: auth.data.userId,
    role: auth.data.role,
  });
  if (!allowed) {
    return { ok: false, error: "You do not own this course." };
  }

  if (
    parsed.data.questionType !== "essay" &&
    parsed.data.questionType !== "short_answer"
  ) {
    const validOptions = parsed.data.options.filter(
      (o) => o.optionText.trim().length > 0,
    );
    if (validOptions.length < 2) {
      return {
        ok: false,
        error: "Choice questions require at least 2 answer options.",
      };
    }
    if (!validOptions.some((o) => o.isCorrect)) {
      return {
        ok: false,
        error: "Mark at least one option as the correct answer.",
      };
    }
  }

  const supabase = await createSupabaseServerClient();
  let questionId = parsed.data.id ?? null;

  if (questionId) {
    const { data, error } = await supabase
      .from("questions")
      .update({
        course_id: parsed.data.courseId,
        question_type: parsed.data.questionType,
        difficulty: parsed.data.difficulty,
        prompt: parsed.data.prompt,
        explanation: parsed.data.explanation || null,
        points: parsed.data.points,
        position: parsed.data.positionOrder,
        media_url: parsed.data.mediaUrl || null,
        is_in_bank: parsed.data.isInBank,
      })
      .eq("id", questionId)
      .eq("exam_id", parsed.data.examId)
      .select("id")
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Failed to update question." };
    }
    questionId = data.id;
    await supabase
      .from("question_options")
      .delete()
      .eq("question_id", questionId);
  } else {
    const { data, error } = await supabase
      .from("questions")
      .insert({
        exam_id: parsed.data.examId,
        course_id: parsed.data.courseId,
        question_type: parsed.data.questionType,
        difficulty: parsed.data.difficulty,
        prompt: parsed.data.prompt,
        explanation: parsed.data.explanation || null,
        points: parsed.data.points,
        position: parsed.data.positionOrder,
        media_url: parsed.data.mediaUrl || null,
        is_in_bank: parsed.data.isInBank,
      })
      .select("id")
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Failed to create question." };
    }
    questionId = data.id;
  }

  if (
    parsed.data.questionType !== "essay" &&
    parsed.data.questionType !== "short_answer" &&
    parsed.data.options.length > 0
  ) {
    const optionRows = parsed.data.options.map((opt, idx) => ({
      question_id: questionId!,
      option_text: opt.optionText,
      is_correct: opt.isCorrect,
      position: idx + 1,
    }));
    const { error: optErr } = await supabase
      .from("question_options")
      .insert(optionRows);
    if (optErr) {
      return { ok: false, error: optErr.message };
    }
  }

  revalidatePath("/teacher/exams");
  return { ok: true, data: { id: questionId } };
}

export async function teacherDeleteQuestionAction(params: {
  questionId: string;
  courseId: string;
}): Promise<ServiceResult<{ deleted: boolean }>> {
  const auth = await requireRole(["teacher", "admin"]);
  if (!auth.ok) return auth;

  const allowed = await verifyTeacherOwnsCourse({
    courseId: params.courseId,
    userId: auth.data.userId,
    role: auth.data.role,
  });
  if (!allowed) {
    return { ok: false, error: "You do not own this course." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("questions")
    .delete()
    .eq("id", params.questionId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/teacher/exams");
  return { ok: true, data: { deleted: true } };
}

export async function teacherImportBankQuestionToExamAction(params: {
  sourceQuestionId: string;
  targetExamId: string;
}): Promise<ServiceResult<{ newQuestionId: string }>> {
  const auth = await requireRole(["teacher", "admin"]);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const [sourceQRes, targetExamRes, sourceOptsRes] = await Promise.all([
    supabase
      .from("questions")
      .select("*")
      .eq("id", params.sourceQuestionId)
      .maybeSingle(),
    supabase
      .from("exams")
      .select("*")
      .eq("id", params.targetExamId)
      .maybeSingle(),
    supabase
      .from("question_options")
      .select("*")
      .eq("question_id", params.sourceQuestionId)
      .order("position", { ascending: true }),
  ]);

  if (sourceQRes.error || !sourceQRes.data) {
    return { ok: false, error: "Source question not found." };
  }
  if (targetExamRes.error || !targetExamRes.data) {
    return { ok: false, error: "Target examination not found." };
  }

  const allowed = await verifyTeacherOwnsCourse({
    courseId: targetExamRes.data.course_id,
    userId: auth.data.userId,
    role: auth.data.role,
  });
  if (!allowed) {
    return { ok: false, error: "You do not own the target examination's course." };
  }

  const src = sourceQRes.data;
  const { data: createdQ, error: createErr } = await supabase
    .from("questions")
    .insert({
      exam_id: targetExamRes.data.id,
      course_id: targetExamRes.data.course_id,
      question_type: src.question_type,
      difficulty: src.difficulty,
      prompt: src.prompt,
      explanation: src.explanation,
      points: src.points,
      position: src.position,
      media_url: src.media_url,
      is_in_bank: true,
    })
    .select("id")
    .single();

  if (createErr || !createdQ) {
    return { ok: false, error: createErr?.message ?? "Failed to clone question." };
  }

  const opts = sourceOptsRes.data ?? [];
  if (opts.length > 0) {
    await supabase.from("question_options").insert(
      opts.map((opt) => ({
        question_id: createdQ.id,
        option_text: opt.option_text,
        is_correct: opt.is_correct,
        position: opt.position,
      })),
    );
  }

  revalidatePath("/teacher/exams");
  return { ok: true, data: { newQuestionId: createdQ.id } };
}

// -----------------------------------------------------------------------------
// 3. STUDENT MANAGEMENT: ATTENDANCE & FEEDBACK / ANNOUNCEMENTS
// -----------------------------------------------------------------------------
const recordAttendanceSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().trim().min(2).max(160),
  sessionDate: z.string().trim().min(8),
  entries: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        status: z.enum(["present", "absent", "late", "excused"]),
        remarks: z.string().trim().max(300).optional(),
      }),
    )
    .min(1),
});

export async function teacherRecordAttendanceAction(
  input: z.infer<typeof recordAttendanceSchema>,
): Promise<ServiceResult<{ attendanceId: string }>> {
  const auth = await requireRole(["teacher", "admin"]);
  if (!auth.ok) return auth;

  const parsed = recordAttendanceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid attendance sheet.",
    };
  }

  const allowed = await verifyTeacherOwnsCourse({
    courseId: parsed.data.courseId,
    userId: auth.data.userId,
    role: auth.data.role,
  });
  if (!allowed) {
    return { ok: false, error: "You do not own this course." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: session, error: sessionErr } = await supabase
    .from("attendance")
    .insert({
      course_id: parsed.data.courseId,
      topic: parsed.data.title,
      session_date: parsed.data.sessionDate,
      recorded_by: auth.data.userId,
    })
    .select("id")
    .single();

  if (sessionErr || !session) {
    return {
      ok: false,
      error: sessionErr?.message ?? "Failed to create attendance session.",
    };
  }

  const recordsPayload = parsed.data.entries.map((entry) => ({
    attendance_id: session.id,
    student_id: entry.studentId,
    status: entry.status,
    remarks: entry.remarks || null,
  }));

  const { error: recErr } = await supabase
    .from("attendance_records")
    .insert(recordsPayload);
  if (recErr) {
    return { ok: false, error: recErr.message };
  }

  revalidatePath("/teacher/students");
  return { ok: true, data: { attendanceId: session.id } };
}

const sendFeedbackSchema = z.object({
  mode: z.enum(["personal", "course"]),
  studentId: z.string().uuid().optional(),
  courseId: z.string().uuid().optional(),
  title: z.string().trim().min(3).max(160),
  body: z.string().trim().min(5).max(3000),
});

export async function teacherSendStudentFeedbackAction(
  input: z.infer<typeof sendFeedbackSchema>,
): Promise<ServiceResult<{ recipientCount: number }>> {
  const auth = await requireRole(["teacher", "admin"]);
  if (!auth.ok) return auth;

  const parsed = sendFeedbackSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid feedback message.",
    };
  }

  const supabase = await createSupabaseServerClient();
  let recipientIds: string[] = [];

  if (parsed.data.mode === "personal") {
    if (!parsed.data.studentId) {
      return { ok: false, error: "Select an assigned student." };
    }
    recipientIds = [parsed.data.studentId];
  } else {
    if (!parsed.data.courseId) {
      return { ok: false, error: "Select an assigned course." };
    }
    const allowed = await verifyTeacherOwnsCourse({
      courseId: parsed.data.courseId,
      userId: auth.data.userId,
      role: auth.data.role,
    });
    if (!allowed) {
      return { ok: false, error: "You do not own this course." };
    }
    const { data: enrollments } = await supabase
      .from("course_enrollments")
      .select("student_id")
      .eq("course_id", parsed.data.courseId);

    recipientIds = Array.from(
      new Set((enrollments ?? []).map((e) => e.student_id)),
    );
  }

  if (recipientIds.length === 0) {
    return { ok: false, error: "No enrolled students found for the selected target." };
  }

  const { data: notif, error: notifErr } = await supabase
    .from("notifications")
    .insert({
      title: parsed.data.title,
      body: parsed.data.body,
      notification_type: parsed.data.mode === "course" ? "course" : "message",
      is_announcement: parsed.data.mode === "course",
      target_scope: parsed.data.mode === "course" ? "course" : "direct",
      course_id: parsed.data.courseId ?? null,
      sender_id: auth.data.userId,
      sent_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (notifErr || !notif) {
    return { ok: false, error: notifErr?.message ?? "Failed to create notification." };
  }

  const { error: recErr } = await supabase.from("notification_recipients").insert(
    recipientIds.map((id) => ({
      notification_id: notif.id,
      recipient_id: id,
      is_read: false,
    })),
  );

  if (recErr) {
    return { ok: false, error: recErr.message };
  }

  revalidatePath("/teacher");
  revalidatePath("/teacher/students");
  return { ok: true, data: { recipientCount: recipientIds.length } };
}

// -----------------------------------------------------------------------------
// 4. GRADING, AI ESSAY APPROVAL & RESULTS PUBLICATION ACTIONS
// -----------------------------------------------------------------------------
const gradeEssayAnswerSchema = z.object({
  answerId: z.string().uuid(),
  attemptId: z.string().uuid(),
  pointsAwarded: z.coerce.number().min(0).max(500),
  teacherFeedback: z.string().trim().max(3000).optional(),
});

export async function teacherGradeEssayAnswerAction(
  input: z.infer<typeof gradeEssayAnswerSchema>,
): Promise<ServiceResult<{ updatedScorePercent: number }>> {
  const auth = await requireRole(["teacher", "admin"]);
  if (!auth.ok) return auth;

  const parsed = gradeEssayAnswerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid grading input.",
    };
  }

  const supabase = await createSupabaseServerClient();

  const { data: attempt, error: attErr } = await supabase
    .from("exam_attempts")
    .select("id, exam_id, student_id")
    .eq("id", parsed.data.attemptId)
    .maybeSingle();

  if (attErr || !attempt) {
    return { ok: false, error: "Exam attempt not found." };
  }

  const { data: exam, error: examErr } = await supabase
    .from("exams")
    .select("id, course_id, total_points, passing_score")
    .eq("id", attempt.exam_id)
    .maybeSingle();

  if (examErr || !exam) {
    return { ok: false, error: "Examination not found." };
  }

  const allowed = await verifyTeacherOwnsCourse({
    courseId: exam.course_id,
    userId: auth.data.userId,
    role: auth.data.role,
  });
  if (!allowed) {
    return { ok: false, error: "You are not authorized to grade this course." };
  }

  const { error: updErr } = await supabase
    .from("student_answers")
    .update({
      points_awarded: parsed.data.pointsAwarded,
      is_correct: parsed.data.pointsAwarded > 0,
      teacher_feedback: parsed.data.teacherFeedback || null,
    })
    .eq("id", parsed.data.answerId)
    .eq("attempt_id", parsed.data.attemptId);

  if (updErr) {
    return { ok: false, error: updErr.message };
  }

  // Record audit trail in essay_grade_history
  await supabase.from("essay_grade_history").insert({
    answer_id: parsed.data.answerId,
    attempt_id: parsed.data.attemptId,
    graded_by: auth.data.userId,
    source: "teacher_override",
    points_awarded: parsed.data.pointsAwarded,
    feedback: parsed.data.teacherFeedback || null,
  });

  // Recalculate attempt & result totals
  const { data: allAnswers } = await supabase
    .from("student_answers")
    .select("points_awarded")
    .eq("attempt_id", attempt.id);

  const earnedPoints = (allAnswers ?? []).reduce(
    (sum, a) => sum + Number(a.points_awarded ?? 0),
    0,
  );
  const totalPoints = Math.max(1, Number(exam.total_points ?? 100));
  const scorePercent = Number(((earnedPoints / totalPoints) * 100).toFixed(2));
  const passed = scorePercent >= Number(exam.passing_score ?? 60);

  await supabase
    .from("exam_attempts")
    .update({
      status: "graded",
    })
    .eq("id", attempt.id);

  const { data: existingResult } = await supabase
    .from("results")
    .select("id")
    .eq("attempt_id", attempt.id)
    .maybeSingle();

  if (existingResult) {
    await supabase
      .from("results")
      .update({
        earned_points: earnedPoints,
        total_points: totalPoints,
        score_percent: scorePercent,
        passed,
        graded_by: auth.data.userId,
        feedback: parsed.data.teacherFeedback || undefined,
      })
      .eq("id", existingResult.id);
  } else {
    await supabase.from("results").insert({
      attempt_id: attempt.id,
      exam_id: exam.id,
      course_id: exam.course_id,
      student_id: attempt.student_id,
      total_points: totalPoints,
      earned_points: earnedPoints,
      score_percent: scorePercent,
      passed,
      graded_by: auth.data.userId,
      feedback: parsed.data.teacherFeedback || null,
      is_published: true,
    });
  }

  revalidatePath("/teacher");
  revalidatePath("/teacher/grading");
  return { ok: true, data: { updatedScorePercent: scorePercent } };
}

export async function teacherToggleResultPublishedAction(params: {
  resultId: string;
  isPublished: boolean;
}): Promise<ServiceResult<{ isPublished: boolean }>> {
  const auth = await requireRole(["teacher", "admin"]);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const { data: resultRow } = await supabase
    .from("results")
    .select("id, course_id")
    .eq("id", params.resultId)
    .maybeSingle();

  if (!resultRow) {
    return { ok: false, error: "Result record not found." };
  }

  const allowed = await verifyTeacherOwnsCourse({
    courseId: resultRow.course_id,
    userId: auth.data.userId,
    role: auth.data.role,
  });
  if (!allowed) {
    return { ok: false, error: "You do not own this course." };
  }

  const { error } = await supabase
    .from("results")
    .update({
      is_published: params.isPublished,
      graded_by: auth.data.userId,
    })
    .eq("id", params.resultId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/teacher/grading");
  return { ok: true, data: { isPublished: params.isPublished } };
}

const gradeAssignmentSchema = z.object({
  submissionId: z.string().uuid(),
  gradePoints: z.coerce.number().min(0).max(1000),
  feedback: z.string().trim().max(3000).optional(),
});

export async function teacherGradeAssignmentSubmissionAction(
  input: z.infer<typeof gradeAssignmentSchema>,
): Promise<ServiceResult<{ graded: boolean }>> {
  const auth = await requireRole(["teacher", "admin"]);
  if (!auth.ok) return auth;

  const parsed = gradeAssignmentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid assignment grade.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: submission } = await supabase
    .from("assignment_submissions")
    .select("id, assignment_id")
    .eq("id", parsed.data.submissionId)
    .maybeSingle();

  if (!submission) {
    return { ok: false, error: "Assignment submission not found." };
  }

  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, course_id")
    .eq("id", submission.assignment_id)
    .maybeSingle();

  if (!assignment) {
    return { ok: false, error: "Assignment not found." };
  }

  const allowed = await verifyTeacherOwnsCourse({
    courseId: assignment.course_id,
    userId: auth.data.userId,
    role: auth.data.role,
  });
  if (!allowed) {
    return { ok: false, error: "You do not own this course." };
  }

  const { error } = await supabase
    .from("assignment_submissions")
    .update({
      grade_points: parsed.data.gradePoints,
      feedback: parsed.data.feedback || null,
      status: "graded",
      graded_by: auth.data.userId,
      graded_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.submissionId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/teacher");
  revalidatePath("/teacher/grading");
  return { ok: true, data: { graded: true } };
}
