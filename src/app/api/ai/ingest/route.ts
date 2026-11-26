import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  chunkDocumentText,
  extractReadableTextFromUpload,
} from "@/services/ai/engine";
import { requireRole } from "@/services/db/utils";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

export async function POST(request: Request) {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Expected multipart/form-data upload." },
      { status: 400 },
    );
  }

  const courseId = String(formData.get("courseId") ?? "").trim();
  const lessonIdRaw = String(formData.get("lessonId") ?? "").trim();
  const lessonId =
    lessonIdRaw && lessonIdRaw !== "all" ? lessonIdRaw : null;
  const file = formData.get("file");

  if (!courseId) {
    return NextResponse.json(
      { ok: false, error: "Target courseId is required." },
      { status: 400 },
    );
  }

  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "A PDF, TXT, or Markdown file is required." },
      { status: 400 },
    );
  }

  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { ok: false, error: "File must be non-empty and under 15 MB." },
      { status: 400 },
    );
  }

  const allowedTypes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/markdown",
    "text/csv",
  ];
  const lowerName = file.name.toLowerCase();
  if (
    !allowedTypes.includes(file.type) &&
    !lowerName.endsWith(".pdf") &&
    !lowerName.endsWith(".docx") &&
    !lowerName.endsWith(".pptx") &&
    !lowerName.endsWith(".xlsx") &&
    !lowerName.endsWith(".txt") &&
    !lowerName.endsWith(".md")
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Only PDF, DOCX, PPTX, XLSX, TXT, and Markdown educational files are supported.",
      },
      { status: 400 },
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const extracted = extractReadableTextFromUpload(
    file.name,
    Buffer.from(arrayBuffer),
  );
  const chunks = chunkDocumentText(extracted);

  if (chunks.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Could not extract readable text from this file. Ensure the PDF contains selectable text rather than scanned images only.",
      },
      { status: 422 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const rows = chunks.map((content, idx) => ({
    course_id: courseId,
    lesson_id: lessonId,
    uploaded_by: auth.data.userId,
    source_title: file.name,
    source_type: lowerName.endsWith(".pdf") ? "pdf" : "resource",
    chunk_index: idx,
    content,
  }));

  const { error } = await supabase.from("ai_document_chunks").insert(rows);
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 403 },
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      fileName: file.name,
      chunksIndexed: rows.length,
    },
  });
}
