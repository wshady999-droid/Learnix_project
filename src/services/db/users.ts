import "server-only";

import { z } from "zod";

import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getAuthenticatedActor,
  requireRole,
  type TableInsert,
  type TableRow,
  type TableUpdate,
} from "@/services/db/utils";
import type { ServiceResult, UserRole } from "@/types";

export type ProfileRow = TableRow<"profiles">;
export type RoleRow = TableRow<"roles">;
export type PermissionRow = TableRow<"permissions">;
export type TeacherRequestRow = TableRow<"teacher_requests">;
export type DepartmentRow = TableRow<"departments">;
export type EducationalLevelRow = TableRow<"educational_levels">;
export type ClassRow = TableRow<"classes">;

const updateProfileSchema = z.object({
  full_name: z.string().trim().min(2).max(80).optional(),
  avatar_url: z.string().url().nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  bio: z.string().trim().max(500).nullable().optional(),
  preferred_locale: z.enum(["en", "ar", "de", "it", "fr"]).optional(),
});

const teacherRequestSchema = z.object({
  department_id: z.string().uuid().nullable().optional(),
  specialization: z.string().trim().min(3).max(120),
  qualifications: z.string().trim().min(10).max(1500),
  credentials_url: z.string().url().nullable().optional(),
});

export async function getCurrentProfile(): Promise<ServiceResult<ProfileRow | null>> {
  if (!isSupabaseConfigured()) {
    return { ok: true, data: null };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

    if (claimsError || !claimsData?.claims?.sub) {
      return { ok: true, data: null };
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", claimsData.claims.sub)
      .maybeSingle();

    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to load user profile.",
    };
  }
}

export async function updateOwnProfile(
  input: z.infer<typeof updateProfileSchema>,
): Promise<ServiceResult<ProfileRow>> {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid profile input." };
  }

  const actorResult = await getAuthenticatedActor();
  if (!actorResult.ok) return actorResult;
  if (!actorResult.data) return { ok: false, error: "Authentication required." };

  const supabase = await createSupabaseServerClient();
  const payload: TableUpdate<"profiles"> = parsed.data;

  const { data, error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", actorResult.data.userId)
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

export async function adminUpdateUserRole(
  targetUserId: string,
  role: UserRole,
): Promise<ServiceResult<ProfileRow>> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", targetUserId)
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

export async function submitTeacherRequest(
  input: z.infer<typeof teacherRequestSchema>,
): Promise<ServiceResult<TeacherRequestRow>> {
  const parsed = teacherRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid teacher request." };
  }

  const actorResult = await getAuthenticatedActor();
  if (!actorResult.ok) return actorResult;
  if (!actorResult.data) return { ok: false, error: "Authentication required." };

  const supabase = await createSupabaseServerClient();
  const insertPayload: TableInsert<"teacher_requests"> = {
    user_id: actorResult.data.userId,
    department_id: parsed.data.department_id ?? null,
    specialization: parsed.data.specialization,
    qualifications: parsed.data.qualifications,
    credentials_url: parsed.data.credentials_url ?? null,
    status: "pending",
  };

  const { data, error } = await supabase
    .from("teacher_requests")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

export async function listDepartments(): Promise<ServiceResult<DepartmentRow[]>> {
  if (!isSupabaseConfigured()) return { ok: true, data: [] };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("departments")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}

export async function listEducationalLevels(
  departmentId?: string,
): Promise<ServiceResult<EducationalLevelRow[]>> {
  if (!isSupabaseConfigured()) return { ok: true, data: [] };

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("educational_levels")
    .select("*")
    .order("rank_order", { ascending: true });

  if (departmentId) {
    query = query.eq("department_id", departmentId);
  }

  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}
