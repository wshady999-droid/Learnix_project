import "server-only";

import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedActor, requireRole, type TableRow } from "@/services/db/utils";
import type { ServiceResult } from "@/types";

export type AttendanceSessionRow = TableRow<"attendance">;
export type AttendanceRecordRow = TableRow<"attendance_records">;

const recordAttendanceSchema = z.object({
  course_id: z.string().uuid(),
  class_id: z.string().uuid().nullable().optional(),
  session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  topic: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  records: z
    .array(
      z.object({
        student_id: z.string().uuid(),
        status: z.enum(["present", "absent", "late", "excused"]),
        remarks: z.string().trim().max(300).nullable().optional(),
      }),
    )
    .min(1),
});

export async function recordCourseAttendance(
  input: z.infer<typeof recordAttendanceSchema>,
): Promise<ServiceResult<{ session: AttendanceSessionRow; records: AttendanceRecordRow[] }>> {
  const parsed = recordAttendanceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid attendance input." };
  }

  const actorResult = await requireRole(["teacher", "admin"]);
  if (!actorResult.ok) return actorResult;

  const supabase = await createSupabaseServerClient();

  const { data: session, error: sessionError } = await supabase
    .from("attendance")
    .insert({
      course_id: parsed.data.course_id,
      class_id: parsed.data.class_id ?? null,
      recorded_by: actorResult.data.userId,
      session_date: parsed.data.session_date,
      topic: parsed.data.topic ?? null,
      notes: parsed.data.notes ?? null,
    })
    .select("*")
    .single();

  if (sessionError || !session) {
    return { ok: false, error: sessionError?.message ?? "Failed to create attendance session." };
  }

  const recordsPayload = parsed.data.records.map((entry) => ({
    attendance_id: session.id,
    student_id: entry.student_id,
    status: entry.status,
    remarks: entry.remarks ?? null,
  }));

  const { data: records, error: recordsError } = await supabase
    .from("attendance_records")
    .upsert(recordsPayload, { onConflict: "attendance_id,student_id" })
    .select("*");

  if (recordsError) return { ok: false, error: recordsError.message };
  return { ok: true, data: { session, records: records ?? [] } };
}

export async function listStudentAttendanceRecords(): Promise<
  ServiceResult<AttendanceRecordRow[]>
> {
  const actorResult = await getAuthenticatedActor();
  if (!actorResult.ok) return actorResult;
  if (!actorResult.data) return { ok: false, error: "Authentication required." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("student_id", actorResult.data.userId)
    .order("recorded_at", { ascending: false });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}
