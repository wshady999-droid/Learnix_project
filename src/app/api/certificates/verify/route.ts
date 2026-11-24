import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawCode = (searchParams.get("code") ?? "").trim();
  const code = rawCode.replace(/[,()"'\\]/g, "");

  if (code.length < 6 || code.length > 128) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid certificate number or verification hash." },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: cert, error } = await supabase
    .from("certificates")
    .select(
      "certificate_number, verification_hash, final_score, issued_at, revoked_at, course_id, student_id",
    )
    .or(`certificate_number.eq.${code},verification_hash.eq.${code}`)
    .maybeSingle();

  if (error || !cert) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "No verified Learnix certificate matched this ID or hash. Please check the code and try again.",
      },
      { status: 404 },
    );
  }

  const [courseRes, profileRes] = await Promise.all([
    supabase
      .from("courses")
      .select("code, title")
      .eq("id", cert.course_id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", cert.student_id)
      .maybeSingle(),
  ]);

  return NextResponse.json(
    {
      ok: true,
      data: {
        certificateNumber: cert.certificate_number,
        verificationHash: cert.verification_hash,
        studentName: profileRes.data?.full_name || "Learnix Graduate",
        courseCode: courseRes.data?.code || "COURSE",
        courseTitle: courseRes.data?.title || "Certified Course",
        finalScore: cert.final_score,
        issuedAt: cert.issued_at,
        isRevoked: Boolean(cert.revoked_at),
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}
