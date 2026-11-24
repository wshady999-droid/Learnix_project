import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/services/db/utils";

export async function GET(request: Request) {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawQ = (searchParams.get("q") ?? "").trim();
  const q = rawQ.replace(/[,()"'\\]/g, "").slice(0, 80);
  if (q.length < 2) {
    return NextResponse.json({
      ok: true,
      data: { courses: [], lessons: [], exams: [], students: [] },
    });
  }

  const supabase = await createSupabaseServerClient();
  const pattern = `%${q}%`;
  const role = auth.data.role;

  // Every query runs under the caller's authenticated Supabase session, so PostgreSQL RLS
  // automatically enforces strict role & enrollment boundaries.
  const [coursesRes, lessonsRes, examsRes, studentsRes] = await Promise.all([
    supabase
      .from("courses")
      .select("id, code, title, status")
      .or(`title.ilike.${pattern},code.ilike.${pattern}`)
      .limit(8),
    supabase
      .from("lessons")
      .select("id, course_id, title, content_type")
      .ilike("title", pattern)
      .limit(8),
    supabase
      .from("exams")
      .select("id, course_id, title, status")
      .ilike("title", pattern)
      .limit(8),
    role === "admin" || role === "teacher"
      ? supabase
          .from("profiles")
          .select("id, full_name, email, role")
          .eq("role", "student")
          .or(`full_name.ilike.${pattern},email.ilike.${pattern}`)
          .limit(8)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            full_name: string | null;
            email: string;
            role: string;
          }>,
        }),
  ]);

  return NextResponse.json({
    ok: true,
    data: {
      role,
      courses: coursesRes.data ?? [],
      lessons: lessonsRes.data ?? [],
      exams: examsRes.data ?? [],
      students: studentsRes.data ?? [],
    },
  });
}
