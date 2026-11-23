import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedActor, type TableRow } from "@/services/db/utils";
import type { ServiceResult } from "@/types";

export type EnrollmentRow = TableRow<"course_enrollments">;
export type CertificateRow = TableRow<"certificates">;

export async function enrollInCourse(courseId: string): Promise<ServiceResult<EnrollmentRow>> {
  const actorResult = await getAuthenticatedActor();
  if (!actorResult.ok) return actorResult;
  if (!actorResult.data) return { ok: false, error: "Authentication required." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("course_enrollments")
    .upsert(
      {
        course_id: courseId,
        student_id: actorResult.data.userId,
        status: "active",
      },
      { onConflict: "course_id,student_id" },
    )
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

export async function listStudentEnrollments(): Promise<ServiceResult<EnrollmentRow[]>> {
  const actorResult = await getAuthenticatedActor();
  if (!actorResult.ok) return actorResult;
  if (!actorResult.data) return { ok: false, error: "Authentication required." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("course_enrollments")
    .select("*")
    .eq("student_id", actorResult.data.userId)
    .order("enrolled_at", { ascending: false });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}

export async function listStudentCertificates(): Promise<ServiceResult<CertificateRow[]>> {
  const actorResult = await getAuthenticatedActor();
  if (!actorResult.ok) return actorResult;
  if (!actorResult.data) return { ok: false, error: "Authentication required." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("certificates")
    .select("*")
    .eq("student_id", actorResult.data.userId)
    .order("issued_at", { ascending: false });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}
