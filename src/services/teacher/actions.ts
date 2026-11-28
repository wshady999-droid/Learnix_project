"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { COURSE_CATEGORIES } from "@/lib/constants/categories";
import { validateNotPastDateTime } from "@/lib/date-validation";
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
    .select("id, teacher_id, deleted_at")
    .eq("id", params.courseId)
    .maybeSingle();

  if (error || !data || data.deleted_at) return false;
  return data.teacher_id === params.userId;
}

async function notifyEnrolledCourseStudents(params: {
  courseId: string;
  title: string;
  body: string;
  type: "course" | "assignment" | "exam" | "grade";
  actionUrl: string;
  isAnnouncement?: boolean;
}) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: enrollments } = await supabase
      .from("course_enrollments")
      .select("student_id")
      .eq("course_id", params.courseId)
      .neq("status", "dropped");

    const studentIds = Array.from(
      new Set((enrollments ?? []).map((e) => e.student_id)),
    );
    if (studentIds.length === 0) return;

    await supabase.rpc("dispatch_event_notification", {
      p_title: params.title,
      p_body: params.body,
      p_type: params.type,
      p_recipient_ids: studentIds,
      p_target_scope: "class",
      p_course_id: params.courseId,
      p_action_url: params.actionUrl,
      p_is_announcement: Boolean(params.isAnnouncement),
    });
  } catch {
    // Non-blocking notification dispatch
  }
}

// -----------------------------------------------------------------------------
// 1. COURSE, CHAPTER, LESSON & LEARNING RESOURCES ACTIONS
// -----------------------------------------------------------------------------
const saveCourseSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().max(24).optional(),
  title: z.string().trim().min(3, "Course Name must be at least 3 characters.").max(160),
  categoryId: z.string().uuid().nullable().optional(),
  category: z.string().trim().min(2).max(120).default(COURSE_CATEGORIES[0]),
  summary: z.string().trim().max(400).optional(),
  description: z
    .string()
    .trim()
    .min(10, "Course Description must be at least 10 characters.")
    .max(5000),
  departmentId: z.string().uuid().nullable().optional(),
  educationalLevelId: z.string().uuid().nullable().optional(),
  language: z.enum(["en", "ar", "de", "it", "fr"]).default("en"),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  estimatedHours: z.coerce.number().min(1, "Duration must be at least 1.").max(1000).default(10),
  durationUnit: z.enum(["hours", "days"]).default("hours"),
  passingScore: z.coerce.number().min(0).max(100).default(60),
  completionRequirements: z.string().trim().max(2000).optional(),
  thumbnailUrl: z.string().trim().max(1000).nullable().optional(),
});

export async function teacherSaveCourseAction(
  input: z.infer<typeof saveCourseSchema>,
): Promise<ServiceResult<{ id: string; code: string }>> {
  const auth = await requireRole(["teacher", "admin"]);
  if (!auth.ok) return auth;

  const parsed = saveCourseSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid course parameters.",
    };
  }

  if (!parsed.data.id && !parsed.data.thumbnailUrl) {
    return {
      ok: false,
      error: "Course cover image is required when creating a new course.",
    };
  }

  const supabase = await createSupabaseServerClient();

  let resolvedCategoryName = parsed.data.category;
  let resolvedCategoryId = parsed.data.categoryId ?? null;
  if (resolvedCategoryId) {
    const { data: catRow } = await supabase
      .from("categories")
      .select("id, name")
      .eq("id", resolvedCategoryId)
      .maybeSingle();
    if (catRow) {
      resolvedCategoryName = catRow.name;
    }
  } else if (resolvedCategoryName) {
    const { data: catRow } = await supabase
      .from("categories")
      .select("id, name")
      .ilike("name", resolvedCategoryName)
      .maybeSingle();
    if (catRow) {
      resolvedCategoryId = catRow.id;
      resolvedCategoryName = catRow.name;
    }
  }

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
        title: parsed.data.title,
        category: resolvedCategoryName,
        category_id: resolvedCategoryId,
        subtitle:
          parsed.data.summary ||
          parsed.data.description.slice(0, 140),
        description: parsed.data.description,
        department_id: parsed.data.departmentId ?? null,
        educational_level_id: parsed.data.educationalLevelId ?? null,
        language: parsed.data.language,
        status: parsed.data.status,
        estimated_hours: parsed.data.estimatedHours,
        duration_unit: parsed.data.durationUnit,
        passing_score: parsed.data.passingScore,
        completion_requirements: parsed.data.completionRequirements || null,
        thumbnail_url: parsed.data.thumbnailUrl ?? undefined,
        published_at:
          parsed.data.status === "published" ? new Date().toISOString() : undefined,
      })
      .eq("id", parsed.data.id)
      .select("id, code")
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
    return { ok: true, data: { id: data.id, code: data.code } };
  }

  // Pass empty code/slug so DB trigger ensure_course_code_slug_and_category generates LRX-XXXX automatically
  const { data, error } = await supabase
    .from("courses")
    .insert({
      code: "",
      slug: "",
      title: parsed.data.title,
      category: resolvedCategoryName || COURSE_CATEGORIES[0],
      category_id: resolvedCategoryId,
      subtitle:
        parsed.data.summary || parsed.data.description.slice(0, 140),
      description: parsed.data.description,
      teacher_id: auth.data.userId,
      department_id: parsed.data.departmentId ?? null,
      educational_level_id: parsed.data.educationalLevelId ?? null,
      language: parsed.data.language,
      status: parsed.data.status,
      estimated_hours: parsed.data.estimatedHours,
      duration_unit: parsed.data.durationUnit,
      passing_score: parsed.data.passingScore,
      completion_requirements: parsed.data.completionRequirements || null,
      thumbnail_url: parsed.data.thumbnailUrl ?? null,
      published_at:
        parsed.data.status === "published" ? new Date().toISOString() : null,
    })
    .select("id, code")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create course." };
  }

  await logTeacherAudit({
    actorId: auth.data.userId,
    action: "teacher.course.create",
    entityType: "courses",
    entityId: data.id,
    newValues: { title: parsed.data.title, code: data.code, status: parsed.data.status },
  });

  revalidatePath("/teacher");
  revalidatePath("/teacher/courses");
  revalidatePath("/student");
  revalidatePath("/student/courses");
  return { ok: true, data: { id: data.id, code: data.code } };
}

export async function teacherToggleCourseStatusAction(params: {
  courseId: string;
  status: "draft" | "published";
}): Promise<ServiceResult<{ status: string }>> {
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
  const { data, error } = await supabase
    .from("courses")
    .update({
      status: params.status,
      published_at:
        params.status === "published" ? new Date().toISOString() : undefined,
    })
    .eq("id", params.courseId)
    .select("id, title, status")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to update course status." };
  }

  if (params.status === "published") {
    await notifyEnrolledCourseStudents({
      courseId: params.courseId,
      title: `Course Published: ${data.title}`,
      body: `"${data.title}" is now published and updated for your learning.`,
      type: "course",
      actionUrl: `/student/my-learning?courseId=${params.courseId}`,
    });
  }

  revalidatePath("/teacher");
  revalidatePath("/teacher/courses");
  revalidatePath("/student");
  revalidatePath("/student/courses");
  return { ok: true, data: { status: data.status } };
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
      error: parsed.error.issues[0]?.message ?? "Invalid section parameters.",
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
      return { ok: false, error: error?.message ?? "Failed to update section." };
    }
    revalidatePath("/teacher/courses");
    revalidatePath("/student/my-learning");
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
    return { ok: false, error: error?.message ?? "Failed to create section." };
  }

  if (parsed.data.isPublished) {
    await notifyEnrolledCourseStudents({
      courseId: parsed.data.courseId,
      title: `New Section Added: ${parsed.data.title}`,
      body: `A new section "${parsed.data.title}" was added to your enrolled course.`,
      type: "course",
      actionUrl: `/student/my-learning?courseId=${parsed.data.courseId}`,
    });
  }

  revalidatePath("/teacher/courses");
  revalidatePath("/student/my-learning");
  return { ok: true, data: { id: data.id } };
}

export async function teacherReorderChapterAction(params: {
  courseId: string;
  chapterId: string;
  direction: "up" | "down";
}): Promise<ServiceResult<{ reordered: boolean }>> {
  const auth = await requireRole(["teacher", "admin"]);
  if (!auth.ok) return auth;

  const allowed = await verifyTeacherOwnsCourse({
    courseId: params.courseId,
    userId: auth.data.userId,
    role: auth.data.role,
  });
  if (!allowed) return { ok: false, error: "You do not own this course." };

  const supabase = await createSupabaseServerClient();
  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, position")
    .eq("course_id", params.courseId)
    .order("position", { ascending: true });

  const list = chapters ?? [];
  const idx = list.findIndex((c) => c.id === params.chapterId);
  const swapIdx = params.direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) {
    return { ok: true, data: { reordered: false } };
  }

  const current = list[idx]!;
  const neighbor = list[swapIdx]!;
  const posA = idx + 1;
  const posB = swapIdx + 1;

  await Promise.all([
    supabase.from("chapters").update({ position: posB }).eq("id", current.id),
    supabase.from("chapters").update({ position: posA }).eq("id", neighbor.id),
  ]);

  revalidatePath("/teacher/courses");
  revalidatePath("/student/my-learning");
  return { ok: true, data: { reordered: true } };
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
  revalidatePath("/student/my-learning");
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
  let prevLesson: {
    video_storage_path: string | null;
    attachment_storage_path: string | null;
    scheduled_publish_at: string | null;
  } | null = null;

  if (parsed.data.id) {
    const { data: existingLesson } = await supabase
      .from("lessons")
      .select("video_storage_path, attachment_storage_path, scheduled_publish_at")
      .eq("id", parsed.data.id)
      .eq("course_id", parsed.data.courseId)
      .maybeSingle();
    prevLesson = existingLesson ?? null;
  }

  if (parsed.data.scheduledPublishAt) {
    const dtCheck = validateNotPastDateTime({
      dateTime: parsed.data.scheduledPublishAt,
      fieldName: "Scheduled publish date",
      allowExistingValue: prevLesson?.scheduled_publish_at ?? null,
    });
    if (!dtCheck.ok) return dtCheck;
  }

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
    external_resource_url: null,
    scheduled_publish_at: parsed.data.scheduledPublishAt || null,
    is_preview: parsed.data.isPreview,
    is_published: parsed.data.isPublished,
  };

  if (parsed.data.id) {
    // Preserve file version history if replacing an uploaded video or attachment
    if (
      prevLesson?.video_storage_path &&
      parsed.data.videoStoragePath &&
      prevLesson.video_storage_path !== parsed.data.videoStoragePath
    ) {
      const { count } = await supabase
        .from("material_file_versions")
        .select("id", { count: "exact", head: true })
        .eq("entity_type", "lesson_video")
        .eq("entity_id", parsed.data.id);
      await supabase.from("material_file_versions").insert({
        entity_type: "lesson_video",
        entity_id: parsed.data.id,
        course_id: parsed.data.courseId,
        storage_bucket: "course-videos",
        storage_path: prevLesson.video_storage_path,
        file_name: prevLesson.video_storage_path.split("/").pop() || "video",
        version_number: (count ?? 0) + 1,
        uploaded_by: auth.data.userId,
      });
    }

    if (
      prevLesson?.attachment_storage_path &&
      parsed.data.attachmentStoragePath &&
      prevLesson.attachment_storage_path !== parsed.data.attachmentStoragePath
    ) {
      const prevBucket =
        parsed.data.contentType === "presentation"
          ? "course-presentations"
          : parsed.data.contentType === "pdf"
            ? "course-pdfs"
            : "course-materials";
      const { count } = await supabase
        .from("material_file_versions")
        .select("id", { count: "exact", head: true })
        .eq("entity_type", "lesson_attachment")
        .eq("entity_id", parsed.data.id);
      await supabase.from("material_file_versions").insert({
        entity_type: "lesson_attachment",
        entity_id: parsed.data.id,
        course_id: parsed.data.courseId,
        storage_bucket: prevBucket,
        storage_path: prevLesson.attachment_storage_path,
        file_name:
          prevLesson.attachment_storage_path.split("/").pop() || "material",
        version_number: (count ?? 0) + 1,
        uploaded_by: auth.data.userId,
      });
    }

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
    revalidatePath("/student/my-learning");
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

  if (parsed.data.isPublished) {
    await notifyEnrolledCourseStudents({
      courseId: parsed.data.courseId,
      title: `New Lesson Published: ${parsed.data.title}`,
      body: `New learning content "${parsed.data.title}" is now available in your course.`,
      type: "course",
      actionUrl: `/student/courses/${parsed.data.courseId}/lessons/${data.id}`,
    });
  }

  revalidatePath("/teacher/courses");
  revalidatePath("/student/my-learning");
  return { ok: true, data: { id: data.id } };
}

export async function teacherReorderLessonAction(params: {
  courseId: string;
  chapterId: string;
  lessonId: string;
  direction: "up" | "down";
}): Promise<ServiceResult<{ reordered: boolean }>> {
  const auth = await requireRole(["teacher", "admin"]);
  if (!auth.ok) return auth;

  const allowed = await verifyTeacherOwnsCourse({
    courseId: params.courseId,
    userId: auth.data.userId,
    role: auth.data.role,
  });
  if (!allowed) return { ok: false, error: "You do not own this course." };

  const supabase = await createSupabaseServerClient();
  const { data: lessons } = await supabase
    .from("lessons")
    .select("id, position")
    .eq("course_id", params.courseId)
    .eq("chapter_id", params.chapterId)
    .order("position", { ascending: true });

  const list = lessons ?? [];
  const idx = list.findIndex((l) => l.id === params.lessonId);
  const swapIdx = params.direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) {
    return { ok: true, data: { reordered: false } };
  }

  const current = list[idx]!;
  const neighbor = list[swapIdx]!;
  const posA = idx + 1;
  const posB = swapIdx + 1;

  await Promise.all([
    supabase.from("lessons").update({ position: posB }).eq("id", current.id),
    supabase.from("lessons").update({ position: posA }).eq("id", neighbor.id),
  ]);

  revalidatePath("/teacher/courses");
  revalidatePath("/student/my-learning");
  return { ok: true, data: { reordered: true } };
}

export async function teacherToggleLessonPublishedAction(params: {
  courseId: string;
  lessonId: string;
  isPublished: boolean;
}): Promise<ServiceResult<{ isPublished: boolean }>> {
  const auth = await requireRole(["teacher", "admin"]);
  if (!auth.ok) return auth;

  const allowed = await verifyTeacherOwnsCourse({
    courseId: params.courseId,
    userId: auth.data.userId,
    role: auth.data.role,
  });
  if (!allowed) return { ok: false, error: "You do not own this course." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("lessons")
    .update({ is_published: params.isPublished })
    .eq("id", params.lessonId)
    .eq("course_id", params.courseId)
    .select("id, title")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to update lesson visibility." };
  }

  if (params.isPublished) {
    await notifyEnrolledCourseStudents({
      courseId: params.courseId,
      title: `Lesson Published: ${data.title}`,
      body: `"${data.title}" is now available in your course.`,
      type: "course",
      actionUrl: `/student/courses/${params.courseId}/lessons/${data.id}`,
    });
  }

  revalidatePath("/teacher/courses");
  revalidatePath("/student/my-learning");
  return { ok: true, data: { isPublished: params.isPublished } };
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
  revalidatePath("/student/my-learning");
  return { ok: true, data: { deleted: true } };
}

const saveLearningResourceSchema = z.object({
  id: z.string().uuid().optional(),
  courseId: z.string().uuid(),
  chapterId: z.string().uuid().nullable().optional(),
  lessonId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(800).optional(),
  resourceType: z.enum(["pdf", "document", "link", "slides", "archive", "other"]).default("pdf"),
  storageBucket: z.string().trim().max(100).nullable().optional(),
  storagePath: z.string().trim().max(500).nullable().optional(),
  externalUrl: z.string().trim().max(1000).nullable().optional(),
  fileName: z.string().trim().max(255).nullable().optional(),
  fileSizeBytes: z.coerce.number().int().min(0).nullable().optional(),
  mimeType: z.string().trim().max(120).nullable().optional(),
  isPublished: z.boolean().default(true),
});

export async function teacherSaveLearningResourceAction(
  input: z.infer<typeof saveLearningResourceSchema>,
): Promise<ServiceResult<{ id: string }>> {
  const auth = await requireRole(["teacher", "admin"]);
  if (!auth.ok) return auth;

  const parsed = saveLearningResourceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid resource details.",
    };
  }

  if (!parsed.data.storagePath && !parsed.data.externalUrl) {
    return {
      ok: false,
      error: "Upload a file or enter an external resource URL.",
    };
  }

  const allowed = await verifyTeacherOwnsCourse({
    courseId: parsed.data.courseId,
    userId: auth.data.userId,
    role: auth.data.role,
  });
  if (!allowed) return { ok: false, error: "You do not own this course." };

  const supabase = await createSupabaseServerClient();
  const payload = {
    course_id: parsed.data.courseId,
    chapter_id: parsed.data.chapterId ?? null,
    lesson_id: parsed.data.lessonId ?? null,
    title: parsed.data.title,
    description: parsed.data.description || null,
    resource_type: parsed.data.resourceType,
    storage_bucket: parsed.data.storageBucket || null,
    storage_path: parsed.data.storagePath || null,
    external_url: parsed.data.externalUrl || null,
    file_name: parsed.data.fileName || null,
    file_size_bytes: parsed.data.fileSizeBytes ?? null,
    mime_type: parsed.data.mimeType || null,
    is_published: parsed.data.isPublished,
  };

  if (parsed.data.id) {
    const { data, error } = await supabase
      .from("learning_resources")
      .update(payload)
      .eq("id", parsed.data.id)
      .eq("course_id", parsed.data.courseId)
      .select("id")
      .single();
    if (error || !data) {
      return { ok: false, error: error?.message ?? "Failed to update learning resource." };
    }
    revalidatePath("/teacher/courses");
    revalidatePath("/student/my-learning");
    return { ok: true, data: { id: data.id } };
  }

  const { data, error } = await supabase
    .from("learning_resources")
    .insert({
      ...payload,
      uploaded_by: auth.data.userId,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to add learning resource." };
  }

  if (parsed.data.isPublished) {
    await notifyEnrolledCourseStudents({
      courseId: parsed.data.courseId,
      title: `New Learning Resource: ${parsed.data.title}`,
      body: `A new learning resource "${parsed.data.title}" was uploaded to your course.`,
      type: "course",
      actionUrl: `/student/my-learning?courseId=${parsed.data.courseId}`,
    });
  }

  revalidatePath("/teacher/courses");
  revalidatePath("/student/my-learning");
  return { ok: true, data: { id: data.id } };
}

export async function teacherDeleteLearningResourceAction(params: {
  resourceId: string;
  courseId: string;
}): Promise<ServiceResult<{ deleted: boolean }>> {
  const auth = await requireRole(["teacher", "admin"]);
  if (!auth.ok) return auth;

  const allowed = await verifyTeacherOwnsCourse({
    courseId: params.courseId,
    userId: auth.data.userId,
    role: auth.data.role,
  });
  if (!allowed) return { ok: false, error: "You do not own this course." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("learning_resources")
    .delete()
    .eq("id", params.resourceId)
    .eq("course_id", params.courseId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/teacher/courses");
  revalidatePath("/student/my-learning");
  return { ok: true, data: { deleted: true } };
}

// -----------------------------------------------------------------------------
// 2. SMART EXAM & AI QUIZ BUILDER ACTIONS
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
  durationMinutes: z.coerce.number().int().min(1).max(360).default(45),
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
      error: parsed.error.issues[0]?.message ?? "Invalid quiz parameters.",
    };
  }

  const allowed = await verifyTeacherOwnsCourse({
    courseId: parsed.data.courseId,
    userId: auth.data.userId,
    role: auth.data.role,
  });
  if (!allowed) {
    return { ok: false, error: "You are not authorized to create quizzes for this course." };
  }

  const supabase = await createSupabaseServerClient();
  let prevExamDates: {
    status: string;
    available_from: string | null;
    available_until: string | null;
  } | null = null;
  if (parsed.data.id) {
    const { data: prevRow } = await supabase
      .from("exams")
      .select("status, available_from, available_until")
      .eq("id", parsed.data.id)
      .maybeSingle();
    prevExamDates = prevRow ?? null;
  }

  if (parsed.data.availableFrom) {
    const fromCheck = validateNotPastDateTime({
      dateTime: parsed.data.availableFrom,
      fieldName: "Available from",
      allowExistingValue: prevExamDates?.available_from ?? null,
    });
    if (!fromCheck.ok) return fromCheck;
  }
  if (parsed.data.availableUntil) {
    const untilCheck = validateNotPastDateTime({
      dateTime: parsed.data.availableUntil,
      fieldName: "Available until",
      allowExistingValue: prevExamDates?.available_until ?? null,
    });
    if (!untilCheck.ok) return untilCheck;
  }

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
    const { data: prev } = await supabase
      .from("exams")
      .select("status")
      .eq("id", parsed.data.id)
      .maybeSingle();

    const { data, error } = await supabase
      .from("exams")
      .update(payload)
      .eq("id", parsed.data.id)
      .select("id")
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Failed to update quiz." };
    }

    if (parsed.data.status === "published" && prev?.status !== "published") {
      await notifyEnrolledCourseStudents({
        courseId: parsed.data.courseId,
        title: `New Quiz Published: ${parsed.data.title}`,
        body: `Quiz "${parsed.data.title}" (${parsed.data.durationMinutes} min) is now available.`,
        type: "exam",
        actionUrl: `/student/exams`,
      });
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
    revalidatePath("/student/exams");
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
    return { ok: false, error: error?.message ?? "Failed to create quiz." };
  }

  if (parsed.data.status === "published") {
    await notifyEnrolledCourseStudents({
      courseId: parsed.data.courseId,
      title: `New Quiz Published: ${parsed.data.title}`,
      body: `Quiz "${parsed.data.title}" (${parsed.data.durationMinutes} min) is now available.`,
      type: "exam",
      actionUrl: `/student/exams`,
    });
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
  revalidatePath("/student/exams");
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

const saveGeneratedQuizBundleSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(4000).optional(),
  instructions: z.string().trim().max(4000).optional(),
  durationMinutes: z.coerce.number().int().min(1).max(360).default(30),
  totalPoints: z.coerce.number().min(1).max(1000).default(100),
  passingScore: z.coerce.number().min(1).max(100).default(60),
  maxAttempts: z.coerce.number().int().min(1).max(10).default(1),
  availableUntil: z.string().trim().nullable().optional(),
  status: z.enum(["draft", "published"]).default("draft"),
  materialIds: z.array(z.string().uuid()).default([]),
  questions: z
    .array(
      z.object({
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
        points: z.coerce.number().min(0.5).max(500).default(5),
        options: z.array(questionOptionSchema).default([]),
      }),
    )
    .min(1, "At least one question is required to save a quiz."),
});

export async function teacherSaveGeneratedQuizAction(
  input: z.infer<typeof saveGeneratedQuizBundleSchema>,
): Promise<ServiceResult<{ examId: string; questionCount: number }>> {
  const auth = await requireRole(["teacher", "admin"]);
  if (!auth.ok) return auth;

  const parsed = saveGeneratedQuizBundleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid quiz configuration.",
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

  const computedTotalPoints = Number(
    parsed.data.questions
      .reduce((sum, q) => sum + Number(q.points || 1), 0)
      .toFixed(2),
  );

  const hasShortOrEssay = parsed.data.questions.some(
    (q) => q.questionType === "short_answer" || q.questionType === "essay",
  );

  const examRes = await teacherSaveExamAction({
    courseId: parsed.data.courseId,
    title: parsed.data.title,
    description: parsed.data.description,
    instructions:
      parsed.data.instructions ||
      "Answer every question carefully before the timer expires. Randomized question and option ordering is enabled.",
    durationMinutes: parsed.data.durationMinutes,
    totalPoints: computedTotalPoints || parsed.data.totalPoints,
    passingScore: parsed.data.passingScore,
    maxAttempts: parsed.data.maxAttempts,
    availableUntil: parsed.data.availableUntil || null,
    shuffleQuestions: true,
    shuffleOptions: true,
    strictProctoring: true,
    cameraMonitoringEnabled: false,
    allowAnswerReview: true,
    retentionDays: 30,
    showResultsImmediately: !hasShortOrEssay,
    versionCount: 1,
    assignedStudentIds: [],
    status: parsed.data.status,
  });

  if (!examRes.ok) return examRes;

  const createdQuestionIds: string[] = [];
  for (let i = 0; i < parsed.data.questions.length; i++) {
    const q = parsed.data.questions[i]!;
    const qRes = await teacherSaveQuestionAction({
      examId: examRes.data.id,
      courseId: parsed.data.courseId,
      questionType: q.questionType,
      difficulty: q.difficulty,
      prompt: q.prompt,
      explanation: q.explanation,
      points: q.points,
      positionOrder: i + 1,
      isInBank: true,
      options: q.options,
    });
    if (!qRes.ok) {
      return { ok: false, error: `Question ${i + 1}: ${qRes.error}` };
    }
    createdQuestionIds.push(qRes.data.id);
  }

  // Persist material references for AI grounding (exam_question_materials)
  if (parsed.data.materialIds.length > 0 && createdQuestionIds.length > 0) {
    const supabase = await createSupabaseServerClient();
    const [materialsRes, lessonsRes] = await Promise.all([
      supabase
        .from("learning_resources")
        .select("id, title, file_name")
        .in("id", parsed.data.materialIds),
      supabase
        .from("lessons")
        .select("id, title, attachment_storage_path")
        .in("id", parsed.data.materialIds),
    ]);
    const sourceItems = [
      ...(materialsRes.data ?? []).map((m) => ({
        sourceType: "learning_resource",
        sourceId: m.id,
        name: m.file_name || m.title,
      })),
      ...(lessonsRes.data ?? []).map((l) => ({
        sourceType: "lesson",
        sourceId: l.id,
        name: l.title,
      })),
    ];
    const materialRows = createdQuestionIds.flatMap((qId) =>
      sourceItems.map((m) => ({
        question_id: qId,
        exam_id: examRes.data.id,
        course_id: parsed.data.courseId,
        material_source_type: m.sourceType,
        material_source_id: m.sourceId,
        material_name: m.name,
        excerpt: null,
        page_number: null,
      })),
    );
    if (materialRows.length > 0) {
      await supabase.from("exam_question_materials").insert(materialRows);
    }
  }

  revalidatePath("/teacher");
  revalidatePath("/teacher/exams");
  revalidatePath("/student/exams");
  return {
    ok: true,
    data: {
      examId: examRes.data.id,
      questionCount: parsed.data.questions.length,
    },
  };
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
    return { ok: false, error: "Target quiz not found." };
  }

  const allowed = await verifyTeacherOwnsCourse({
    courseId: targetExamRes.data.course_id,
    userId: auth.data.userId,
    role: auth.data.role,
  });
  if (!allowed) {
    return { ok: false, error: "You do not own the target quiz's course." };
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
  void recordAttendanceSchema.safeParse(input);
  return {
    ok: false,
    error: "Attendance and absence tracking has been retired.",
  };
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
      .eq("course_id", parsed.data.courseId)
      .neq("status", "dropped");

    recipientIds = Array.from(
      new Set((enrollments ?? []).map((e) => e.student_id)),
    );
  }

  if (recipientIds.length === 0) {
    return { ok: false, error: "No enrolled students found for the selected target." };
  }

  const { error: rpcErr } = await supabase.rpc("dispatch_event_notification", {
    p_title: parsed.data.title,
    p_body: parsed.data.body,
    p_type: parsed.data.mode === "course" ? "course" : "message",
    p_recipient_ids: recipientIds,
    p_target_scope: parsed.data.mode === "course" ? "class" : "individual",
    p_course_id: parsed.data.courseId ?? undefined,
    p_action_url: "/notifications",
    p_is_announcement: parsed.data.mode === "course",
  });

  if (rpcErr) {
    return { ok: false, error: rpcErr.message };
  }

  revalidatePath("/teacher");
  revalidatePath("/teacher/students");
  revalidatePath("/notifications");
  return { ok: true, data: { recipientCount: recipientIds.length } };
}

// -----------------------------------------------------------------------------
// 4. ASSIGNMENTS MANAGEMENT & GRADING ACTIONS
// -----------------------------------------------------------------------------
const assignmentMaterialInputSchema = z.object({
  storageBucket: z.string().trim().default("assignment-attachments"),
  storagePath: z.string().trim().min(1).max(500),
  fileName: z.string().trim().min(1).max(255),
  fileSizeBytes: z.coerce.number().int().min(1),
  mimeType: z.string().trim().min(1).max(160),
});

const saveAssignmentSchema = z.object({
  id: z.string().uuid().optional(),
  courseId: z.string().uuid(),
  lessonId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(3, "Assignment title is required.").max(180),
  description: z.string().trim().min(5, "Description is required.").max(5000),
  instructions: z.string().trim().max(5000).optional(),
  rubric: z.string().trim().max(5000).optional(),
  maxPoints: z.coerce.number().min(1).max(1000).default(100),
  dueAt: z.string().trim().nullable().optional(),
  allowLateSubmissions: z.boolean().default(true),
  submissionTypes: z.array(z.enum(["text", "file"])).min(1).default(["text", "file"]),
  attachmentStoragePath: z.string().trim().max(500).nullable().optional(),
  attachmentFileName: z.string().trim().max(255).nullable().optional(),
  newMaterials: z.array(assignmentMaterialInputSchema).default([]),
  isPublished: z.boolean().default(false),
});

export async function teacherSaveAssignmentAction(
  input: z.input<typeof saveAssignmentSchema>,
): Promise<ServiceResult<{ id: string }>> {
  const auth = await requireRole(["teacher", "admin"]);
  if (!auth.ok) return auth;

  const parsed = saveAssignmentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid assignment details.",
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
  let prevAsg: { is_published: boolean; due_at: string | null } | null = null;
  if (parsed.data.id) {
    const { data: prev } = await supabase
      .from("assignments")
      .select("is_published, due_at")
      .eq("id", parsed.data.id)
      .maybeSingle();
    prevAsg = prev ?? null;
  }

  if (parsed.data.dueAt) {
    const dueCheck = validateNotPastDateTime({
      dateTime: parsed.data.dueAt,
      fieldName: "Assignment due date",
      allowExistingValue: prevAsg?.due_at ?? null,
    });
    if (!dueCheck.ok) return dueCheck;
  }

  const primaryMaterial = parsed.data.newMaterials[0];
  const payload = {
    course_id: parsed.data.courseId,
    lesson_id: parsed.data.lessonId ?? null,
    title: parsed.data.title,
    description: parsed.data.description,
    instructions: parsed.data.instructions || null,
    rubric: parsed.data.rubric || null,
    max_points: parsed.data.maxPoints,
    due_at: parsed.data.dueAt || null,
    allow_late_submissions: parsed.data.allowLateSubmissions,
    submission_types: parsed.data.submissionTypes,
    attachment_storage_path:
      parsed.data.attachmentStoragePath ??
      primaryMaterial?.storagePath ??
      undefined,
    attachment_file_name:
      parsed.data.attachmentFileName ?? primaryMaterial?.fileName ?? undefined,
    is_published: parsed.data.isPublished,
  };

  let assignmentId = parsed.data.id ?? "";

  if (parsed.data.id) {
    const { data, error } = await supabase
      .from("assignments")
      .update(payload)
      .eq("id", parsed.data.id)
      .eq("course_id", parsed.data.courseId)
      .select("id")
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Failed to update assignment." };
    }
    assignmentId = data.id;

    if (parsed.data.isPublished && !prevAsg?.is_published) {
      await notifyEnrolledCourseStudents({
        courseId: parsed.data.courseId,
        title: `New Assignment Published: ${parsed.data.title}`,
        body: `"${parsed.data.title}" (${parsed.data.maxPoints} marks)${
          parsed.data.dueAt ? ` — due ${parsed.data.dueAt.slice(0, 10)}` : ""
        }.`,
        type: "assignment",
        actionUrl: `/student/assignments?assignmentId=${assignmentId}`,
      });
    }
  } else {
    const { data, error } = await supabase
      .from("assignments")
      .insert({
        ...payload,
        attachment_storage_path:
          parsed.data.attachmentStoragePath ??
          primaryMaterial?.storagePath ??
          null,
        attachment_file_name:
          parsed.data.attachmentFileName ?? primaryMaterial?.fileName ?? null,
        created_by: auth.data.userId,
      })
      .select("id")
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Failed to create assignment." };
    }
    assignmentId = data.id;

    if (parsed.data.isPublished) {
      await notifyEnrolledCourseStudents({
        courseId: parsed.data.courseId,
        title: `New Assignment Published: ${parsed.data.title}`,
        body: `"${parsed.data.title}" (${parsed.data.maxPoints} marks)${
          parsed.data.dueAt ? ` — due ${parsed.data.dueAt.slice(0, 10)}` : ""
        }.`,
        type: "assignment",
        actionUrl: `/student/assignments?assignmentId=${assignmentId}`,
      });
    }

    await logTeacherAudit({
      actorId: auth.data.userId,
      action: "teacher.assignment.create",
      entityType: "assignments",
      entityId: assignmentId,
      newValues: { title: parsed.data.title, isPublished: parsed.data.isPublished },
    });
  }

  if (parsed.data.newMaterials.length > 0) {
    const rows = parsed.data.newMaterials.map((m) => ({
      assignment_id: assignmentId,
      course_id: parsed.data.courseId,
      storage_bucket: m.storageBucket || "assignment-attachments",
      storage_path: m.storagePath,
      file_name: m.fileName,
      file_size_bytes: m.fileSizeBytes,
      mime_type: m.mimeType,
      uploaded_by: auth.data.userId,
    }));
    const { error: matErr } = await supabase
      .from("assignment_materials")
      .insert(rows);
    if (matErr) {
      return { ok: false, error: matErr.message };
    }
  }

  revalidatePath("/teacher");
  revalidatePath("/teacher/assignments");
  revalidatePath("/teacher/grading");
  revalidatePath("/student/assignments");
  return { ok: true, data: { id: assignmentId } };
}

export async function teacherDeleteAssignmentMaterialAction(params: {
  materialId: string;
  courseId: string;
}): Promise<ServiceResult<{ deleted: true }>> {
  const auth = await requireRole(["teacher", "admin"]);
  if (!auth.ok) return auth;

  const allowed = await verifyTeacherOwnsCourse({
    courseId: params.courseId,
    userId: auth.data.userId,
    role: auth.data.role,
  });
  if (!allowed) return { ok: false, error: "You do not own this course." };

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("assignment_materials")
    .select("*")
    .eq("id", params.materialId)
    .eq("course_id", params.courseId)
    .maybeSingle();

  if (existing) {
    await supabase.from("material_file_versions").insert({
      entity_type: "assignment_material",
      entity_id: existing.assignment_id,
      course_id: existing.course_id,
      storage_bucket: existing.storage_bucket,
      storage_path: existing.storage_path,
      file_name: existing.file_name,
      file_size_bytes: existing.file_size_bytes,
      mime_type: existing.mime_type,
      version_number: existing.version_number,
      uploaded_by: auth.data.userId,
    });
  }

  const { error } = await supabase
    .from("assignment_materials")
    .delete()
    .eq("id", params.materialId)
    .eq("course_id", params.courseId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/teacher/assignments");
  revalidatePath("/student/assignments");
  return { ok: true, data: { deleted: true } };
}

export async function teacherDeleteAssignmentAction(params: {
  assignmentId: string;
  courseId: string;
}): Promise<ServiceResult<{ deleted: boolean }>> {
  const auth = await requireRole(["teacher", "admin"]);
  if (!auth.ok) return auth;

  const allowed = await verifyTeacherOwnsCourse({
    courseId: params.courseId,
    userId: auth.data.userId,
    role: auth.data.role,
  });
  if (!allowed) return { ok: false, error: "You do not own this course." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("assignments")
    .delete()
    .eq("id", params.assignmentId)
    .eq("course_id", params.courseId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/teacher/grading");
  revalidatePath("/student/assignments");
  return { ok: true, data: { deleted: true } };
}

export async function teacherGetAssignmentFileSignedUrlAction(params: {
  storagePath: string;
  courseId: string;
}): Promise<ServiceResult<{ signedUrl: string }>> {
  const auth = await requireRole(["teacher", "admin"]);
  if (!auth.ok) return auth;

  const allowed = await verifyTeacherOwnsCourse({
    courseId: params.courseId,
    userId: auth.data.userId,
    role: auth.data.role,
  });
  if (!allowed) return { ok: false, error: "You do not own this course." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage
    .from("assignment-attachments")
    .createSignedUrl(params.storagePath, 3600);

  if (error || !data?.signedUrl) {
    return { ok: false, error: error?.message ?? "Failed to create download link." };
  }
  return { ok: true, data: { signedUrl: data.signedUrl } };
}

// -----------------------------------------------------------------------------
// 5. GRADING, AI ESSAY APPROVAL & RESULTS PUBLICATION ACTIONS
// -----------------------------------------------------------------------------
const gradeEssayAnswerSchema = z.object({
  answerId: z.string().uuid(),
  attemptId: z.string().uuid(),
  pointsAwarded: z.coerce.number().min(0).max(500),
  teacherFeedback: z.string().trim().max(3000).optional(),
  publishResult: z.boolean().default(true),
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
    return { ok: false, error: "Quiz attempt not found." };
  }

  const { data: exam, error: examErr } = await supabase
    .from("exams")
    .select("id, title, course_id, total_points, passing_score")
    .eq("id", attempt.exam_id)
    .maybeSingle();

  if (examErr || !exam) {
    return { ok: false, error: "Quiz not found." };
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

  await supabase.from("essay_grade_history").insert({
    answer_id: parsed.data.answerId,
    attempt_id: parsed.data.attemptId,
    graded_by: auth.data.userId,
    source: "teacher_override",
    points_awarded: parsed.data.pointsAwarded,
    feedback: parsed.data.teacherFeedback || null,
  });

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
    .select("id, is_published")
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
        is_published: parsed.data.publishResult,
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
      is_published: parsed.data.publishResult,
    });
  }

  if (parsed.data.publishResult) {
    await supabase.rpc("dispatch_event_notification", {
      p_title: `Quiz Grade Published: ${exam.title}`,
      p_body: `Your quiz "${exam.title}" has been graded (${scorePercent}%).${
        parsed.data.teacherFeedback ? " Teacher feedback is available." : ""
      }`,
      p_type: "grade",
      p_recipient_ids: [attempt.student_id],
      p_target_scope: "individual",
      p_course_id: exam.course_id,
      p_action_url: "/student/exams",
    });
  }

  revalidatePath("/teacher");
  revalidatePath("/teacher/grading");
  revalidatePath("/student/exams");
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
    .select("id, course_id, exam_id, student_id, score_percent")
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

  if (params.isPublished) {
    const { data: examRow } = await supabase
      .from("exams")
      .select("title")
      .eq("id", resultRow.exam_id)
      .maybeSingle();

    await supabase.rpc("dispatch_event_notification", {
      p_title: `Quiz Result Published: ${examRow?.title ?? "Quiz"}`,
      p_body: `Your official quiz score (${Number(resultRow.score_percent ?? 0).toFixed(1)}%) is now published.`,
      p_type: "grade",
      p_recipient_ids: [resultRow.student_id],
      p_target_scope: "individual",
      p_course_id: resultRow.course_id,
      p_action_url: "/student/exams",
    });
  }

  revalidatePath("/teacher/grading");
  revalidatePath("/student/exams");
  return { ok: true, data: { isPublished: params.isPublished } };
}

const gradeAssignmentSchema = z.object({
  submissionId: z.string().uuid(),
  gradePoints: z.coerce.number().min(0).max(1000),
  feedback: z.string().trim().max(3000).optional(),
  publishGrade: z.boolean().default(true),
});

export async function teacherGradeAssignmentSubmissionAction(
  input: z.infer<typeof gradeAssignmentSchema>,
): Promise<ServiceResult<{ graded: boolean; published: boolean }>> {
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
    .select("id, assignment_id, student_id")
    .eq("id", parsed.data.submissionId)
    .maybeSingle();

  if (!submission) {
    return { ok: false, error: "Assignment submission not found." };
  }

  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, title, course_id, max_points")
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

  if (parsed.data.gradePoints > Number(assignment.max_points ?? 1000)) {
    return {
      ok: false,
      error: `Grade cannot exceed maximum marks (${assignment.max_points}).`,
    };
  }

  const nowIso = new Date().toISOString();

  await supabase.from("assignment_grades").upsert(
    {
      submission_id: submission.id,
      assignment_id: assignment.id,
      course_id: assignment.course_id,
      student_id: submission.student_id,
      teacher_points: parsed.data.gradePoints,
      teacher_feedback: parsed.data.feedback || null,
      graded_by: auth.data.userId,
      is_published: parsed.data.publishGrade,
      published_at: parsed.data.publishGrade ? nowIso : null,
      updated_at: nowIso,
    },
    { onConflict: "submission_id" },
  );

  // Only populate visible grade_points & feedback on assignment_submissions when teacher publishes!
  const { error } = await supabase
    .from("assignment_submissions")
    .update({
      grade_points: parsed.data.publishGrade ? parsed.data.gradePoints : null,
      feedback: parsed.data.publishGrade ? parsed.data.feedback || null : null,
      is_grade_published: parsed.data.publishGrade,
      status: parsed.data.publishGrade ? "graded" : "under_review",
      graded_by: auth.data.userId,
      graded_at: nowIso,
    })
    .eq("id", parsed.data.submissionId);

  if (error) return { ok: false, error: error.message };

  if (parsed.data.publishGrade) {
    await supabase.rpc("dispatch_event_notification", {
      p_title: `Assignment Grade Published: ${assignment.title}`,
      p_body: `Your submission for "${assignment.title}" was graded (${parsed.data.gradePoints}/${assignment.max_points}).${
        parsed.data.feedback ? " Teacher feedback is available." : ""
      }`,
      p_type: "grade",
      p_recipient_ids: [submission.student_id],
      p_target_scope: "individual",
      p_course_id: assignment.course_id,
      p_action_url: "/student/assignments",
    });
  }

  await logTeacherAudit({
    actorId: auth.data.userId,
    action: "teacher.assignment.grade",
    entityType: "assignment_submissions",
    entityId: submission.id,
    newValues: {
      gradePoints: parsed.data.gradePoints,
      published: parsed.data.publishGrade,
    },
  });

  revalidatePath("/teacher");
  revalidatePath("/teacher/assignments");
  revalidatePath("/teacher/grading");
  revalidatePath("/student/assignments");
  return {
    ok: true,
    data: { graded: true, published: parsed.data.publishGrade },
  };
}

// -----------------------------------------------------------------------------
// 6. EXAM PAUSE / RESUME TEACHER APPROVAL & PUBLIC TEACHER PROFILE ACTIONS
// -----------------------------------------------------------------------------
const reviewPausedAttemptSchema = z.object({
  attemptId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  reviewNotes: z.string().trim().max(1000).optional(),
});

export async function teacherReviewPausedExamAttemptAction(
  input: z.infer<typeof reviewPausedAttemptSchema>,
): Promise<ServiceResult<{ decision: "approved" | "rejected" }>> {
  const auth = await requireRole(["teacher", "admin"]);
  if (!auth.ok) return auth;

  const parsed = reviewPausedAttemptSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid review decision.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: attempt } = await supabase
    .from("exam_attempts")
    .select("*")
    .eq("id", parsed.data.attemptId)
    .maybeSingle();

  if (!attempt) {
    return { ok: false, error: "Exam attempt not found." };
  }

  const { data: exam } = await supabase
    .from("exams")
    .select("id, title, course_id, duration_minutes")
    .eq("id", attempt.exam_id)
    .maybeSingle();

  if (!exam) {
    return { ok: false, error: "Exam not found." };
  }

  const allowed = await verifyTeacherOwnsCourse({
    courseId: exam.course_id,
    userId: auth.data.userId,
    role: auth.data.role,
  });
  if (!allowed) {
    return { ok: false, error: "You do not own this course." };
  }

  const now = new Date();
  const nowIso = now.toISOString();

  if (parsed.data.decision === "approved") {
    const fallbackRemaining = Math.max(
      60,
      Math.floor((new Date(attempt.expires_at).getTime() - now.getTime()) / 1000),
    );
    const resumeSeconds = Math.max(
      60,
      attempt.remaining_seconds ?? fallbackRemaining,
    );
    const nextExpiresAt = new Date(
      now.getTime() + resumeSeconds * 1000,
    ).toISOString();

    const { error } = await supabase
      .from("exam_attempts")
      .update({
        is_paused: false,
        resume_status: "approved",
        expires_at: nextExpiresAt,
        resume_reviewed_by: auth.data.userId,
        resume_reviewed_at: nowIso,
        resume_review_notes: parsed.data.reviewNotes || null,
      })
      .eq("id", attempt.id);

    if (error) return { ok: false, error: error.message };

    await supabase.rpc("dispatch_event_notification", {
      p_title: `Exam Resume Approved: ${exam.title}`,
      p_body: `Your instructor approved your request to resume "${exam.title}".${
        parsed.data.reviewNotes ? ` Note: ${parsed.data.reviewNotes}` : ""
      }`,
      p_type: "exam",
      p_recipient_ids: [attempt.student_id],
      p_target_scope: "individual",
      p_course_id: exam.course_id,
      p_action_url: `/student/exams/${exam.id}`,
    });
  } else {
    const { error } = await supabase
      .from("exam_attempts")
      .update({
        is_paused: false,
        status: "invalidated",
        submitted_at: nowIso,
        resume_status: "rejected",
        resume_reviewed_by: auth.data.userId,
        resume_reviewed_at: nowIso,
        resume_review_notes: parsed.data.reviewNotes || null,
      })
      .eq("id", attempt.id);

    if (error) return { ok: false, error: error.message };

    await supabase.rpc("dispatch_event_notification", {
      p_title: `Exam Attempt Closed: ${exam.title}`,
      p_body: `Your paused attempt on "${exam.title}" was closed by your instructor.${
        parsed.data.reviewNotes ? ` Reason: ${parsed.data.reviewNotes}` : ""
      }`,
      p_type: "security",
      p_recipient_ids: [attempt.student_id],
      p_target_scope: "individual",
      p_course_id: exam.course_id,
      p_action_url: `/student/exams`,
    });
  }

  revalidatePath("/teacher/assignments");
  revalidatePath("/student/exams");
  revalidatePath(`/student/exams/${exam.id}`);
  return { ok: true, data: { decision: parsed.data.decision } };
}

const saveTeacherPublicProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(120).optional(),
  headline: z.string().trim().max(180).optional(),
  biography: z.string().trim().max(4000).optional(),
  experienceYears: z.coerce.number().int().min(0).max(80).nullable().optional(),
  education: z.string().trim().max(1000).optional(),
  certifications: z.string().trim().max(1000).optional(),
  websiteUrl: z.string().trim().max(500).optional(),
  linkedinUrl: z.string().trim().max(500).optional(),
  isPublicVisible: z.boolean().default(true),
});

export async function teacherSavePublicProfileAction(
  input: z.infer<typeof saveTeacherPublicProfileSchema>,
): Promise<ServiceResult<{ saved: true }>> {
  const auth = await requireRole(["teacher", "admin"]);
  if (!auth.ok) return auth;

  const parsed = saveTeacherPublicProfileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid public profile details.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("teacher_public_profiles").upsert(
    {
      teacher_id: auth.data.userId,
      display_name: parsed.data.displayName || null,
      headline: parsed.data.headline || null,
      biography: parsed.data.biography || null,
      experience_years: parsed.data.experienceYears ?? null,
      education: parsed.data.education || null,
      certifications: parsed.data.certifications || null,
      website_url: parsed.data.websiteUrl || null,
      linkedin_url: parsed.data.linkedinUrl || null,
      is_public_visible: parsed.data.isPublicVisible,
    },
    { onConflict: "teacher_id" },
  );

  if (error) return { ok: false, error: error.message };
  revalidatePath("/teacher/ratings");
  revalidatePath("/profile");
  revalidatePath(`/teachers/${auth.data.userId}`);
  return { ok: true, data: { saved: true } };
}
