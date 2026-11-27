import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawCode = (searchParams.get("code") ?? "").trim();
  const code = rawCode.replace(/[,()"'\\]/g, "");

  if (code.length < 6 || code.length > 128) {
    return NextResponse.json(
      {
        ok: false,
        error: "Enter a valid certificate number or verification hash.",
      },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("verify_certificate", {
    p_code_or_hash: code,
  });

  const cert = Array.isArray(data) ? data[0] : data;

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

  return NextResponse.json(
    {
      ok: true,
      data: {
        certificateNumber: cert.certificate_number,
        verificationHash: cert.verification_hash,
        studentName: cert.student_name || "Learnix Graduate",
        courseCode: cert.course_code || "COURSE",
        courseTitle: cert.course_title || "Certified Course",
        finalScore: cert.final_score,
        issuedAt: cert.issued_at,
        isRevoked: Boolean(cert.is_revoked),
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}
