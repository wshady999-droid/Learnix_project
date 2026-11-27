"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { serverStrongPasswordSchema } from "@/lib/auth/validation";
import { getPublicEnv } from "@/lib/env";
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import { requireRole } from "@/services/db/utils";
import type { Json, ServiceResult, UserRole } from "@/types";

async function logAdminAudit(params: {
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
    // Non-blocking audit log write
  }
}

async function logSecurityEvent(params: {
  userId?: string | null;
  email?: string | null;
  eventType: string;
  severity: "info" | "warning" | "high" | "critical";
  description: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.from("security_events").insert({
      user_id: params.userId ?? null,
      email: params.email ?? null,
      event_type: params.eventType,
      severity: params.severity,
      description: params.description,
      metadata: (params.metadata ?? {}) as Json,
    });
  } catch {
    // Non-blocking security event write
  }
}

function getOptionalServiceRoleClient() {
  return createSupabaseServiceRoleClient();
}

// -----------------------------------------------------------------------------
// 1. USER MANAGEMENT ACTIONS
// -----------------------------------------------------------------------------
const createUserSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  password: serverStrongPasswordSchema,
  role: z.enum(["student", "teacher", "admin"]).default("student"),
  phone: z.string().trim().max(30).optional(),
  departmentId: z.string().uuid().nullable().optional(),
  educationalLevelId: z.string().uuid().nullable().optional(),
});

export async function adminCreateUserAccountAction(
  input: z.infer<typeof createUserSchema>,
): Promise<ServiceResult<{ userId: string }>> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid user creation details.",
    };
  }

  const serviceClient = getOptionalServiceRoleClient();
  if (!serviceClient) {
    return {
      ok: false,
      error:
        "Server configuration incomplete: SUPABASE_SERVICE_ROLE_KEY is missing in .env.local.",
    };
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await serviceClient.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.fullName,
      phone: parsed.data.phone || "",
    },
  });
  if (error || !data.user) {
    return { ok: false, error: error?.message ?? "Failed to create Auth account." };
  }
  const createdUserId = data.user.id;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      role: parsed.data.role,
      phone: parsed.data.phone || null,
      department_id: parsed.data.departmentId || null,
      educational_level_id: parsed.data.educationalLevelId || null,
      status: "active",
    })
    .eq("id", createdUserId);

  if (profileError) {
    return { ok: false, error: profileError.message };
  }

  await Promise.all([
    logAdminAudit({
      actorId: adminCheck.data.userId,
      action: "admin.user_created",
      entityType: "profiles",
      entityId: createdUserId,
      newValues: {
        email: parsed.data.email,
        role: parsed.data.role,
      },
    }),
    logSecurityEvent({
      userId: createdUserId,
      email: parsed.data.email,
      eventType: "registration",
      severity: "info",
      description: `Admin created ${parsed.data.role} account (${parsed.data.email}).`,
      metadata: { createdBy: adminCheck.data.userId },
    }),
  ]);

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  return { ok: true, data: { userId: createdUserId } };
}

const bulkImportItemSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  role: z.enum(["student", "teacher"]).default("student"),
  phone: z.string().trim().max(30).optional(),
  departmentCode: z.string().trim().max(30).optional(),
  levelCode: z.string().trim().max(30).optional(),
});

export async function adminBulkImportUsersAction(
  rows: Array<z.infer<typeof bulkImportItemSchema>>,
): Promise<
  ServiceResult<{
    importedCount: number;
    failures: Array<{ email: string; reason: string }>;
  }>
> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, error: "No valid rows supplied for bulk import." };
  }

  if (rows.length > 200) {
    return { ok: false, error: "Bulk import is limited to 200 accounts per batch." };
  }

  const serviceClient = getOptionalServiceRoleClient();
  if (!serviceClient) {
    return {
      ok: false,
      error: "SUPABASE_SERVICE_ROLE_KEY is required in .env.local for bulk user creation.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const [deptsRes, levelsRes] = await Promise.all([
    supabase.from("departments").select("id, code"),
    supabase.from("educational_levels").select("id, code"),
  ]);

  const deptByCode = new Map(
    (deptsRes.data ?? []).map((d) => [d.code.toLowerCase(), d.id]),
  );
  const levelByCode = new Map(
    (levelsRes.data ?? []).map((l) => [l.code.toLowerCase(), l.id]),
  );

  let importedCount = 0;
  const failures: Array<{ email: string; reason: string }> = [];

  // Process in concurrent batches of 5 for fast throughput without overloading Auth
  const BATCH_SIZE = 5;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const slice = rows.slice(i, i + BATCH_SIZE);
    await Promise.all(
      slice.map(async (rawRow) => {
        const parsed = bulkImportItemSchema.safeParse(rawRow);
        if (!parsed.success) {
          failures.push({
            email: rawRow.email || "unknown",
            reason: parsed.error.issues[0]?.message ?? "Validation error",
          });
          return;
        }
        const row = parsed.data;
        const tempPassword = `Lrx!${Math.random().toString(36).slice(2, 8)}A9#`;
        const departmentId = row.departmentCode
          ? (deptByCode.get(row.departmentCode.toLowerCase()) ?? null)
          : null;
        const educationalLevelId = row.levelCode
          ? (levelByCode.get(row.levelCode.toLowerCase()) ?? null)
          : null;

        const { data: created, error: authErr } =
          await serviceClient.auth.admin.createUser({
            email: row.email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
              full_name: row.fullName,
              phone: row.phone || "",
            },
          });

        if (authErr || !created.user) {
          failures.push({
            email: row.email,
            reason: authErr?.message ?? "Failed to create Auth user",
          });
          return;
        }

        const { error: profErr } = await supabase
          .from("profiles")
          .update({
            full_name: row.fullName,
            role: row.role,
            phone: row.phone || null,
            department_id: departmentId,
            educational_level_id: educationalLevelId,
            status: "active",
          })
          .eq("id", created.user.id);

        if (profErr) {
          failures.push({ email: row.email, reason: profErr.message });
          return;
        }
        importedCount += 1;
      }),
    );
  }

  await logAdminAudit({
    actorId: adminCheck.data.userId,
    action: "admin.users_bulk_imported",
    entityType: "profiles",
    newValues: { importedCount, failedCount: failures.length },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  return { ok: true, data: { importedCount, failures } };
}

export async function adminChangeUserRoleAction(params: {
  targetUserId: string;
  role: UserRole;
}): Promise<ServiceResult<{ updated: true }>> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role: params.role })
    .eq("id", params.targetUserId);

  if (error) return { ok: false, error: error.message };

  await logAdminAudit({
    actorId: adminCheck.data.userId,
    action: "admin.user_role_changed",
    entityType: "profiles",
    entityId: params.targetUserId,
    newValues: { role: params.role },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  return { ok: true, data: { updated: true } };
}

export async function adminChangeUserStatusAction(params: {
  targetUserId: string;
  status: "active" | "suspended";
  reason?: string;
}): Promise<ServiceResult<{ updated: true }>> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  if (params.targetUserId === adminCheck.data.userId && params.status === "suspended") {
    return {
      ok: false,
      error: "You cannot suspend your own active administrator account.",
    };
  }

  const trimmedReason = (params.reason ?? "").trim();
  if (params.status === "suspended" && trimmedReason.length < 3) {
    return {
      ok: false,
      error: "A suspension reason (at least 3 characters) is required.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", params.targetUserId)
    .maybeSingle();

  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("profiles")
    .update({
      status: params.status,
      suspension_reason: params.status === "suspended" ? trimmedReason : null,
      suspended_at: params.status === "suspended" ? nowIso : null,
      suspended_by: params.status === "suspended" ? adminCheck.data.userId : null,
    })
    .eq("id", params.targetUserId);

  if (error) return { ok: false, error: error.message };

  await Promise.all([
    logAdminAudit({
      actorId: adminCheck.data.userId,
      action:
        params.status === "suspended"
          ? "admin.user_suspended"
          : "admin.user_activated",
      entityType: "profiles",
      entityId: params.targetUserId,
      newValues: {
        status: params.status,
        reason: trimmedReason || null,
      },
    }),
    logSecurityEvent({
      userId: params.targetUserId,
      email: targetProfile?.email ?? null,
      eventType:
        params.status === "suspended"
          ? "account_suspended"
          : "account_reactivated",
      severity: params.status === "suspended" ? "high" : "info",
      description:
        params.status === "suspended"
          ? `Account suspended by admin. Reason: ${trimmedReason}`
          : "Account reactivated by admin.",
      metadata: {
        actorId: adminCheck.data.userId,
        reason: trimmedReason || null,
      },
    }),
  ]);

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/security");
  return { ok: true, data: { updated: true } };
}

export async function adminDeleteUserAccountAction(params: {
  targetUserId: string;
}): Promise<ServiceResult<{ deleted: true }>> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  if (params.targetUserId === adminCheck.data.userId) {
    return {
      ok: false,
      error: "You cannot delete your own active administrator account.",
    };
  }

  const serviceClient = getOptionalServiceRoleClient();
  if (!serviceClient) {
    return {
      ok: false,
      error:
        "SUPABASE_SERVICE_ROLE_KEY is required in .env.local to permanently delete Auth accounts.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("email, full_name, role")
    .eq("id", params.targetUserId)
    .maybeSingle();

  const { error } = await serviceClient.auth.admin.deleteUser(params.targetUserId);
  if (error) {
    return { ok: false, error: error.message };
  }

  await Promise.all([
    logAdminAudit({
      actorId: adminCheck.data.userId,
      action: "admin.user_deleted",
      entityType: "profiles",
      entityId: params.targetUserId,
      newValues: {
        email: targetProfile?.email ?? null,
        role: targetProfile?.role ?? null,
      },
    }),
    logSecurityEvent({
      userId: null,
      email: targetProfile?.email ?? null,
      eventType: "account_deleted",
      severity: "high",
      description: `Account ${targetProfile?.email ?? params.targetUserId} permanently deleted by admin.`,
      metadata: { actorId: adminCheck.data.userId },
    }),
  ]);

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/security");
  return { ok: true, data: { deleted: true } };
}

export async function adminSendPasswordResetEmailAction(
  targetEmail: string,
): Promise<ServiceResult<{ sent: true }>> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const emailParsed = z.string().trim().email().safeParse(targetEmail);
  if (!emailParsed.success) {
    return { ok: false, error: "Invalid email address." };
  }

  const env = getPublicEnv();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(emailParsed.data, {
    redirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/reset-password`,
  });

  if (error) return { ok: false, error: error.message };

  await logAdminAudit({
    actorId: adminCheck.data.userId,
    action: "admin.password_reset_dispatched",
    entityType: "auth",
    newValues: { email: emailParsed.data },
  });

  return { ok: true, data: { sent: true } };
}

export async function adminSetUserCustomPermissionAction(params: {
  userId: string;
  permissionId: string;
  isGranted: boolean;
}): Promise<ServiceResult<{ updated: true }>> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("user_permissions").upsert(
    {
      user_id: params.userId,
      permission_id: params.permissionId,
      granted_by: adminCheck.data.userId,
      is_granted: params.isGranted,
    },
    { onConflict: "user_id,permission_id" },
  );

  if (error) return { ok: false, error: error.message };

  await logAdminAudit({
    actorId: adminCheck.data.userId,
    action: "admin.user_permission_override",
    entityType: "user_permissions",
    entityId: params.userId,
    newValues: { permissionId: params.permissionId, isGranted: params.isGranted },
  });

  revalidatePath("/admin");
  return { ok: true, data: { updated: true } };
}

export async function adminReviewTeacherRequestAction(params: {
  requestId: string;
  approve: boolean;
  reviewNotes?: string;
}): Promise<ServiceResult<{ reviewed: true }>> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_review_teacher_request", {
    p_request_id: params.requestId,
    p_approve: params.approve,
    p_review_notes: params.reviewNotes ?? undefined,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  return { ok: true, data: { reviewed: true } };
}

// -----------------------------------------------------------------------------
// 2. CATEGORIES & COURSE GOVERNANCE ACTIONS
// -----------------------------------------------------------------------------
const saveCategorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Category name is required.").max(120),
  description: z.string().trim().max(500).optional(),
  isActive: z.boolean().default(true),
});

export async function adminSaveCategoryAction(
  input: z.infer<typeof saveCategorySchema>,
): Promise<ServiceResult<{ id: string }>> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const parsed = saveCategorySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid category details.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const slug = parsed.data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  if (parsed.data.id) {
    const { data: oldCat } = await supabase
      .from("categories")
      .select("name")
      .eq("id", parsed.data.id)
      .maybeSingle();

    const { data, error } = await supabase
      .from("categories")
      .update({
        name: parsed.data.name,
        slug: slug || "category",
        description: parsed.data.description || null,
        is_active: parsed.data.isActive,
      })
      .eq("id", parsed.data.id)
      .select("id")
      .single();

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Failed to update category." };
    }

    // Keep linked courses' category label synchronized
    if (oldCat && oldCat.name !== parsed.data.name) {
      await supabase
        .from("courses")
        .update({ category: parsed.data.name })
        .eq("category_id", parsed.data.id);
    }

    await logAdminAudit({
      actorId: adminCheck.data.userId,
      action: "admin.category_updated",
      entityType: "categories",
      entityId: data.id,
      newValues: { name: parsed.data.name, isActive: parsed.data.isActive },
    });

    revalidatePath("/admin/courses");
    revalidatePath("/teacher/courses");
    revalidatePath("/student/courses");
    return { ok: true, data: { id: data.id } };
  }

  const { data, error } = await supabase
    .from("categories")
    .insert({
      name: parsed.data.name,
      slug: `${slug || "category"}-${Math.floor(100 + Math.random() * 900)}`,
      description: parsed.data.description || null,
      is_active: parsed.data.isActive,
      created_by: adminCheck.data.userId,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create category." };
  }

  await logAdminAudit({
    actorId: adminCheck.data.userId,
    action: "admin.category_created",
    entityType: "categories",
    entityId: data.id,
    newValues: { name: parsed.data.name },
  });

  revalidatePath("/admin/courses");
  revalidatePath("/teacher/courses");
  revalidatePath("/student/courses");
  return { ok: true, data: { id: data.id } };
}

export async function adminDeleteCategoryAction(
  categoryId: string,
): Promise<ServiceResult<{ deleted: true }>> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const supabase = await createSupabaseServerClient();
  const { data: cat } = await supabase
    .from("categories")
    .select("id, name")
    .eq("id", categoryId)
    .maybeSingle();

  if (!cat) {
    return { ok: false, error: "Category not found." };
  }

  const { count } = await supabase
    .from("courses")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .or(`category_id.eq.${categoryId},category.ilike.${cat.name}`);

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `Cannot delete "${cat.name}" because ${count} active course(s) use it.`,
    };
  }

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", categoryId);

  if (error) return { ok: false, error: error.message };

  await logAdminAudit({
    actorId: adminCheck.data.userId,
    action: "admin.category_deleted",
    entityType: "categories",
    entityId: categoryId,
    newValues: { name: cat.name },
  });

  revalidatePath("/admin/courses");
  revalidatePath("/teacher/courses");
  revalidatePath("/student/courses");
  return { ok: true, data: { deleted: true } };
}

export async function adminUpdateCourseStatusAction(params: {
  courseId: string;
  status: "draft" | "published" | "archived";
}): Promise<ServiceResult<{ updated: true }>> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("courses")
    .update({
      status: params.status,
      published_at:
        params.status === "published" ? new Date().toISOString() : undefined,
    })
    .eq("id", params.courseId);

  if (error) return { ok: false, error: error.message };

  await logAdminAudit({
    actorId: adminCheck.data.userId,
    action: `admin.course_status_${params.status}`,
    entityType: "courses",
    entityId: params.courseId,
    newValues: { status: params.status },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/courses");
  revalidatePath("/teacher/courses");
  revalidatePath("/student/courses");
  return { ok: true, data: { updated: true } };
}

export async function adminSoftDeleteCourseAction(params: {
  courseId: string;
  reason: string;
}): Promise<ServiceResult<{ removed: true }>> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const trimmedReason = params.reason.trim();
  if (trimmedReason.length < 5) {
    return {
      ok: false,
      error: "Please provide a clear deletion reason (at least 5 characters).",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: course } = await supabase
    .from("courses")
    .select("id, title, code, teacher_id")
    .eq("id", params.courseId)
    .maybeSingle();

  if (!course) {
    return { ok: false, error: "Course not found." };
  }

  // Soft-delete so historical enrollments, grades, and certificates remain intact
  const { error } = await supabase
    .from("courses")
    .update({
      status: "archived",
      deleted_at: new Date().toISOString(),
      deleted_by: adminCheck.data.userId,
      deletion_reason: trimmedReason,
    })
    .eq("id", params.courseId);

  if (error) return { ok: false, error: error.message };

  // Notify course instructor with mandatory reason
  await supabase.rpc("dispatch_event_notification", {
    p_title: `Course Removed by Administration: ${course.title}`,
    p_body: `Your course "${course.title}" (${course.code}) was removed from active listings. Reason: ${trimmedReason}`,
    p_type: "course",
    p_recipient_ids: [course.teacher_id],
    p_target_scope: "individual",
    p_action_url: "/notifications",
    p_is_announcement: true,
  });

  await logAdminAudit({
    actorId: adminCheck.data.userId,
    action: "admin.course_removed",
    entityType: "courses",
    entityId: course.id,
    newValues: {
      title: course.title,
      code: course.code,
      reason: trimmedReason,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/courses");
  revalidatePath("/teacher");
  revalidatePath("/teacher/courses");
  revalidatePath("/student");
  revalidatePath("/student/courses");
  return { ok: true, data: { removed: true } };
}

export async function adminRestoreCourseAction(
  courseId: string,
): Promise<ServiceResult<{ restored: true }>> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("courses")
    .update({
      status: "draft",
      deleted_at: null,
      deleted_by: null,
      deletion_reason: null,
    })
    .eq("id", courseId);

  if (error) return { ok: false, error: error.message };

  await logAdminAudit({
    actorId: adminCheck.data.userId,
    action: "admin.course_restored",
    entityType: "courses",
    entityId: courseId,
  });

  revalidatePath("/admin/courses");
  revalidatePath("/teacher/courses");
  return { ok: true, data: { restored: true } };
}

export async function adminAssignCourseTeacherAction(params: {
  courseId: string;
  teacherId: string;
}): Promise<ServiceResult<{ updated: true }>> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("courses")
    .update({ teacher_id: params.teacherId })
    .eq("id", params.courseId);

  if (error) return { ok: false, error: error.message };

  await logAdminAudit({
    actorId: adminCheck.data.userId,
    action: "admin.course_teacher_reassigned",
    entityType: "courses",
    entityId: params.courseId,
    newValues: { teacherId: params.teacherId },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/courses");
  return { ok: true, data: { updated: true } };
}

// -----------------------------------------------------------------------------
// 3. DEPARTMENT, LEVEL, CLASS & ASSIGNMENT ACTIONS
// -----------------------------------------------------------------------------
const departmentSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().min(2).max(20),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  headTeacherId: z.string().uuid().nullable().optional(),
});

export async function adminSaveDepartmentAction(
  input: z.infer<typeof departmentSchema>,
): Promise<ServiceResult<{ saved: true }>> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const parsed = departmentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid department input.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const payload = {
    code: parsed.data.code.toUpperCase(),
    name: parsed.data.name,
    description: parsed.data.description || null,
    head_teacher_id: parsed.data.headTeacherId || null,
    is_active: true,
  };

  if (parsed.data.id) {
    const { error } = await supabase
      .from("departments")
      .update(payload)
      .eq("id", parsed.data.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("departments").insert(payload);
    if (error) return { ok: false, error: error.message };
  }

  await logAdminAudit({
    actorId: adminCheck.data.userId,
    action: parsed.data.id ? "admin.department_updated" : "admin.department_created",
    entityType: "departments",
    entityId: parsed.data.id ?? parsed.data.code,
    newValues: payload,
  });

  revalidatePath("/admin");
  return { ok: true, data: { saved: true } };
}

export async function adminDeleteDepartmentAction(
  departmentId: string,
): Promise<ServiceResult<{ deleted: true }>> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const supabase = await createSupabaseServerClient();

  const { count: classCount } = await supabase
    .from("classes")
    .select("id", { count: "exact", head: true })
    .eq("department_id", departmentId);

  if ((classCount ?? 0) > 0) {
    return {
      ok: false,
      error:
        "Cannot delete department while classes are assigned to it. Reassign or remove its classes first.",
    };
  }

  const { error } = await supabase.from("departments").delete().eq("id", departmentId);
  if (error) return { ok: false, error: error.message };

  await logAdminAudit({
    actorId: adminCheck.data.userId,
    action: "admin.department_deleted",
    entityType: "departments",
    entityId: departmentId,
  });

  revalidatePath("/admin");
  return { ok: true, data: { deleted: true } };
}

const educationalLevelSchema = z.object({
  id: z.string().uuid().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  code: z.string().trim().min(2).max(24),
  name: z.string().trim().min(2).max(120),
  rankOrder: z.number().int().min(1).max(50).default(1),
  description: z.string().trim().max(500).optional(),
});

export async function adminSaveEducationalLevelAction(
  input: z.infer<typeof educationalLevelSchema>,
): Promise<ServiceResult<{ saved: true }>> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const parsed = educationalLevelSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid educational level.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const payload = {
    department_id: parsed.data.departmentId || null,
    code: parsed.data.code.toUpperCase(),
    name: parsed.data.name,
    rank_order: parsed.data.rankOrder,
    description: parsed.data.description || null,
  };

  if (parsed.data.id) {
    const { error } = await supabase
      .from("educational_levels")
      .update(payload)
      .eq("id", parsed.data.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("educational_levels").insert(payload);
    if (error) return { ok: false, error: error.message };
  }

  await logAdminAudit({
    actorId: adminCheck.data.userId,
    action: parsed.data.id ? "admin.level_updated" : "admin.level_created",
    entityType: "educational_levels",
    entityId: parsed.data.id ?? parsed.data.code,
    newValues: payload,
  });

  revalidatePath("/admin");
  return { ok: true, data: { saved: true } };
}

export async function adminDeleteEducationalLevelAction(
  levelId: string,
): Promise<ServiceResult<{ deleted: true }>> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("educational_levels").delete().eq("id", levelId);
  if (error) return { ok: false, error: error.message };

  await logAdminAudit({
    actorId: adminCheck.data.userId,
    action: "admin.level_deleted",
    entityType: "educational_levels",
    entityId: levelId,
  });

  revalidatePath("/admin");
  return { ok: true, data: { deleted: true } };
}

const classSchema = z.object({
  id: z.string().uuid().optional(),
  departmentId: z.string().uuid(),
  educationalLevelId: z.string().uuid(),
  advisorTeacherId: z.string().uuid().nullable().optional(),
  code: z.string().trim().min(2).max(24),
  name: z.string().trim().min(2).max(120),
  academicYear: z.string().trim().min(4).max(20),
  maxCapacity: z.number().int().min(1).max(1000).default(40),
});

export async function adminSaveClassAction(
  input: z.infer<typeof classSchema>,
): Promise<ServiceResult<{ saved: true }>> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const parsed = classSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid class configuration.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const payload = {
    department_id: parsed.data.departmentId,
    educational_level_id: parsed.data.educationalLevelId,
    advisor_teacher_id: parsed.data.advisorTeacherId || null,
    code: parsed.data.code.toUpperCase(),
    name: parsed.data.name,
    academic_year: parsed.data.academicYear,
    max_capacity: parsed.data.maxCapacity,
    is_active: true,
  };

  if (parsed.data.id) {
    const { error } = await supabase.from("classes").update(payload).eq("id", parsed.data.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("classes").insert(payload);
    if (error) return { ok: false, error: error.message };
  }

  await logAdminAudit({
    actorId: adminCheck.data.userId,
    action: parsed.data.id ? "admin.class_updated" : "admin.class_created",
    entityType: "classes",
    entityId: parsed.data.id ?? parsed.data.code,
    newValues: payload,
  });

  revalidatePath("/admin");
  return { ok: true, data: { saved: true } };
}

export async function adminDeleteClassAction(
  classId: string,
): Promise<ServiceResult<{ deleted: true }>> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("classes").delete().eq("id", classId);
  if (error) return { ok: false, error: error.message };

  await logAdminAudit({
    actorId: adminCheck.data.userId,
    action: "admin.class_deleted",
    entityType: "classes",
    entityId: classId,
  });

  revalidatePath("/admin");
  return { ok: true, data: { deleted: true } };
}

export async function adminAssignStudentToTeacherAction(params: {
  studentId: string;
  teacherId: string;
  classId?: string | null;
}): Promise<ServiceResult<{ assigned: true }>> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  if (params.studentId === params.teacherId) {
    return { ok: false, error: "Student and teacher cannot be the same user." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("student_teacher_assignments").insert({
    student_id: params.studentId,
    teacher_id: params.teacherId,
    class_id: params.classId || null,
    assigned_by: adminCheck.data.userId,
    is_active: true,
  });

  if (error) return { ok: false, error: error.message };

  await logAdminAudit({
    actorId: adminCheck.data.userId,
    action: "admin.student_teacher_assigned",
    entityType: "student_teacher_assignments",
    newValues: params,
  });

  revalidatePath("/admin");
  return { ok: true, data: { assigned: true } };
}

export async function adminDeleteStudentTeacherAssignmentAction(
  assignmentId: string,
): Promise<ServiceResult<{ deleted: true }>> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("student_teacher_assignments")
    .delete()
    .eq("id", assignmentId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin");
  return { ok: true, data: { deleted: true } };
}

// -----------------------------------------------------------------------------
// 4. SCHEDULE ACTIONS
// -----------------------------------------------------------------------------
const createScheduleSlotSchema = z.object({
  classId: z.string().uuid(),
  courseId: z.string().uuid(),
  teacherId: z.string().uuid(),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  room: z.string().trim().max(120).optional(),
});

export async function adminCreateClassScheduleSlotAction(
  input: z.infer<typeof createScheduleSlotSchema>,
): Promise<ServiceResult<{ created: true }>> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const parsed = createScheduleSlotSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid timetable slot.",
    };
  }

  if (parsed.data.endTime <= parsed.data.startTime) {
    return { ok: false, error: "End time must be after start time." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("class_schedules").insert({
    class_id: parsed.data.classId,
    course_id: parsed.data.courseId,
    teacher_id: parsed.data.teacherId,
    day_of_week: parsed.data.dayOfWeek,
    start_time: parsed.data.startTime,
    end_time: parsed.data.endTime,
    room: parsed.data.room || null,
    is_active: true,
  });

  if (error) return { ok: false, error: error.message };

  await logAdminAudit({
    actorId: adminCheck.data.userId,
    action: "admin.schedule_slot_created",
    entityType: "class_schedules",
    newValues: parsed.data,
  });

  revalidatePath("/admin");
  return { ok: true, data: { created: true } };
}

export async function adminDeleteClassScheduleSlotAction(
  scheduleId: string,
): Promise<ServiceResult<{ deleted: true }>> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("class_schedules").delete().eq("id", scheduleId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin");
  return { ok: true, data: { deleted: true } };
}

// -----------------------------------------------------------------------------
// 5. SECURITY & DEVICE ACTIONS
// -----------------------------------------------------------------------------
export async function adminToggleDeviceTrustAction(params: {
  deviceId: string;
  isTrusted: boolean;
}): Promise<ServiceResult<{ updated: true }>> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("user_devices")
    .update({ is_trusted: params.isTrusted })
    .eq("id", params.deviceId);

  if (error) return { ok: false, error: error.message };

  await logAdminAudit({
    actorId: adminCheck.data.userId,
    action: params.isTrusted ? "admin.device_trusted" : "admin.device_untrusted",
    entityType: "user_devices",
    entityId: params.deviceId,
  });

  revalidatePath("/admin");
  return { ok: true, data: { updated: true } };
}

export async function adminToggleRolePermissionAction(params: {
  roleId: string;
  permissionId: string;
  enable: boolean;
}): Promise<ServiceResult<{ updated: true }>> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const supabase = await createSupabaseServerClient();
  if (params.enable) {
    const { error } = await supabase.from("role_permissions").upsert(
      {
        role_id: params.roleId,
        permission_id: params.permissionId,
      },
      { onConflict: "role_id,permission_id" },
    );
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("role_permissions")
      .delete()
      .eq("role_id", params.roleId)
      .eq("permission_id", params.permissionId);
    if (error) return { ok: false, error: error.message };
  }

  await logAdminAudit({
    actorId: adminCheck.data.userId,
    action: "admin.role_permission_toggled",
    entityType: "role_permissions",
    entityId: params.roleId,
    newValues: params,
  });

  revalidatePath("/admin");
  return { ok: true, data: { updated: true } };
}

// -----------------------------------------------------------------------------
// 6. NOTIFICATIONS & NON-REPLYABLE ANNOUNCEMENTS ACTIONS
// -----------------------------------------------------------------------------
const dispatchNotificationSchema = z.object({
  targetScope: z.enum([
    "all_students",
    "all_teachers",
    "all_users",
    "department",
    "class",
    "individual",
    "one_student",
    "one_teacher",
  ]),
  targetId: z.string().uuid().optional(),
  notificationType: z
    .enum([
      "system",
      "course",
      "exam",
      "assignment",
      "grade",
      "message",
      "attendance",
      "review",
      "security",
    ])
    .default("system"),
  title: z.string().trim().min(2).max(160),
  body: z.string().trim().min(2).max(2000),
  scheduledFor: z.string().optional(),
  isAnnouncement: z.boolean().default(true),
});

export async function adminDispatchNotificationAction(
  input: z.infer<typeof dispatchNotificationSchema>,
): Promise<ServiceResult<{ recipientCount: number }>> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const parsed = dispatchNotificationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid announcement payload.",
    };
  }

  const supabase = await createSupabaseServerClient();

  let recipientIds: string[] = [];
  let dbTargetScope:
    | "all_students"
    | "all_teachers"
    | "all_users"
    | "department"
    | "class"
    | "individual" = "all_users";

  if (
    parsed.data.targetScope === "individual" ||
    parsed.data.targetScope === "one_student" ||
    parsed.data.targetScope === "one_teacher"
  ) {
    if (!parsed.data.targetId) {
      return { ok: false, error: "Please select a recipient user." };
    }
    recipientIds = [parsed.data.targetId];
    dbTargetScope = "individual";
  } else if (parsed.data.targetScope === "all_students") {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "student")
      .eq("status", "active");
    recipientIds = (data ?? []).map((p) => p.id);
    dbTargetScope = "all_students";
  } else if (parsed.data.targetScope === "all_teachers") {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "teacher")
      .eq("status", "active");
    recipientIds = (data ?? []).map((p) => p.id);
    dbTargetScope = "all_teachers";
  } else if (parsed.data.targetScope === "all_users") {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("status", "active");
    recipientIds = (data ?? []).map((p) => p.id);
    dbTargetScope = "all_users";
  } else if (parsed.data.targetScope === "department") {
    if (!parsed.data.targetId) {
      return { ok: false, error: "Please select a department." };
    }
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("department_id", parsed.data.targetId);
    recipientIds = (data ?? []).map((p) => p.id);
    dbTargetScope = "department";
  } else if (parsed.data.targetScope === "class") {
    if (!parsed.data.targetId) {
      return { ok: false, error: "Please select a class cohort." };
    }
    const { data } = await supabase
      .from("student_teacher_assignments")
      .select("student_id")
      .eq("class_id", parsed.data.targetId);
    recipientIds = Array.from(new Set((data ?? []).map((r) => r.student_id)));
    dbTargetScope = "class";
  }

  const scheduledForIso =
    parsed.data.scheduledFor && parsed.data.scheduledFor.trim()
      ? new Date(parsed.data.scheduledFor).toISOString()
      : null;

  const { data: notification, error: notifError } = await supabase
    .from("notifications")
    .insert({
      sender_id: adminCheck.data.userId,
      notification_type: parsed.data.notificationType,
      title: parsed.data.title,
      body: parsed.data.body,
      target_scope: dbTargetScope,
      scheduled_for: scheduledForIso,
      is_announcement: parsed.data.isAnnouncement,
      sent_at: scheduledForIso ?? new Date().toISOString(),
    })
    .select("*")
    .single();

  if (notifError || !notification) {
    return {
      ok: false,
      error: notifError?.message ?? "Failed to create announcement.",
    };
  }

  if (recipientIds.length > 0) {
    const recipientRows = recipientIds.map((id) => ({
      notification_id: notification.id,
      recipient_id: id,
    }));
    const { error: recErr } = await supabase
      .from("notification_recipients")
      .insert(recipientRows);
    if (recErr) return { ok: false, error: recErr.message };
  }

  await logAdminAudit({
    actorId: adminCheck.data.userId,
    action: "admin.notification_dispatched",
    entityType: "notifications",
    entityId: notification.id,
    newValues: {
      targetScope: parsed.data.targetScope,
      recipientCount: recipientIds.length,
      isAnnouncement: parsed.data.isAnnouncement,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/notifications");
  revalidatePath("/notifications");
  revalidatePath("/messages");
  return { ok: true, data: { recipientCount: recipientIds.length } };
}

// -----------------------------------------------------------------------------
// 7. REVIEWS MODERATION ACTIONS (NEVER MODIFIES RATING VALUES)
// -----------------------------------------------------------------------------
const moderateReviewSchema = z.object({
  reviewId: z.string().uuid(),
  reviewType: z.enum(["course", "teacher"]),
  action: z.enum(["approve", "hide", "remove"]),
  reason: z.string().trim().max(500).optional(),
});

export async function adminModerateReviewAction(
  input: z.infer<typeof moderateReviewSchema>,
): Promise<ServiceResult<{ updated: true }>> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const parsed = moderateReviewSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid moderation request.",
    };
  }

  const trimmedReason = (parsed.data.reason ?? "").trim();
  if (parsed.data.action !== "approve" && trimmedReason.length < 3) {
    return {
      ok: false,
      error: "A moderation reason is required when hiding or removing a review.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const moderationStatus =
    parsed.data.action === "approve"
      ? "approved"
      : parsed.data.action === "hide"
        ? "hidden"
        : "removed";
  const isPublished = parsed.data.action === "approve";
  const nowIso = new Date().toISOString();

  if (parsed.data.reviewType === "course") {
    const { error } = await supabase
      .from("course_reviews")
      .update({
        moderation_status: moderationStatus,
        moderation_reason: isPublished ? null : trimmedReason,
        moderated_by: adminCheck.data.userId,
        moderated_at: nowIso,
        is_published: isPublished,
      })
      .eq("id", parsed.data.reviewId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("teacher_reviews")
      .update({
        moderation_status: moderationStatus,
        moderation_reason: isPublished ? null : trimmedReason,
        moderated_by: adminCheck.data.userId,
        moderated_at: nowIso,
        is_published: isPublished,
      })
      .eq("id", parsed.data.reviewId);
    if (error) return { ok: false, error: error.message };
  }

  await logAdminAudit({
    actorId: adminCheck.data.userId,
    action: `admin.review_${moderationStatus}`,
    entityType:
      parsed.data.reviewType === "course" ? "course_reviews" : "teacher_reviews",
    entityId: parsed.data.reviewId,
    newValues: {
      moderationStatus,
      reason: trimmedReason || null,
    },
  });

  revalidatePath("/admin/reviews");
  revalidatePath("/student/courses");
  revalidatePath("/teacher/ratings");
  return { ok: true, data: { updated: true } };
}

// -----------------------------------------------------------------------------
// 8. ADMIN PLATFORM SETTINGS ACTION
// -----------------------------------------------------------------------------
const platformSettingsInputSchema = z.object({
  platformName: z.string().trim().min(2).max(80),
  tagline: z.string().trim().min(2).max(80),
  defaultLocale: z.enum(["en", "ar", "de", "it", "fr"]),
  defaultTheme: z.enum(["light", "dark", "system"]),
  maxExamViolations: z.number().int().min(0).max(20),
  requireTeacherApproval: z.boolean(),
  allowStudentSelfEnrollment: z.boolean(),
  maintenanceMode: z.boolean(),
});

export async function adminSavePlatformSettingsAction(
  input: z.infer<typeof platformSettingsInputSchema>,
): Promise<ServiceResult<{ saved: true }>> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const parsed = platformSettingsInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid platform settings.",
    };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("platform_settings").upsert(
    [
      {
        key: "platform_identity",
        value: {
          name: parsed.data.platformName,
          tagline: parsed.data.tagline,
          default_locale: parsed.data.defaultLocale,
          default_theme: parsed.data.defaultTheme,
          supported_locales: ["en", "ar", "de", "it", "fr"],
        },
        description: "Public platform identity and regional defaults.",
        is_public: true,
        updated_by: adminCheck.data.userId,
      },
      {
        key: "security_policies",
        value: {
          max_exam_violations: parsed.data.maxExamViolations,
          require_teacher_approval: parsed.data.requireTeacherApproval,
          allow_student_self_enrollment: parsed.data.allowStudentSelfEnrollment,
          maintenance_mode: parsed.data.maintenanceMode,
        },
        description: "Platform security, proctoring, and enrollment policies.",
        is_public: false,
        updated_by: adminCheck.data.userId,
      },
    ],
    { onConflict: "key" },
  );

  if (error) return { ok: false, error: error.message };

  await logAdminAudit({
    actorId: adminCheck.data.userId,
    action: "admin.platform_settings_updated",
    entityType: "platform_settings",
    newValues: parsed.data,
  });

  revalidatePath("/admin");
  return { ok: true, data: { saved: true } };
}
