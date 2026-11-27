import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  callServerAiProvider,
  checkAiRateLimit,
  extractReadableTextFromUpload,
  logAiUsage,
} from "@/services/ai/engine";
import { requireRole } from "@/services/db/utils";

const gradeAssignmentSchema = z.object({
  submissionId: z.string().uuid(),
});

export async function POST(request: Request) {
  const auth = await requireRole(["teacher", "admin"]);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON payload." },
      { status: 400 },
    );
  }

  const parsed = gradeAssignmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Valid submissionId is required." },
      { status: 400 },
    );
  }

  const rateLimit = await checkAiRateLimit(auth.data.userId);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: "AI rate limit reached. Please retry in a minute." },
      { status: 429 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: submission } = await supabase
    .from("assignment_submissions")
    .select("*")
    .eq("id", parsed.data.submissionId)
    .maybeSingle();

  if (!submission) {
    return NextResponse.json(
      { ok: false, error: "Assignment submission not found." },
      { status: 404 },
    );
  }

  const { data: assignment } = await supabase
    .from("assignments")
    .select("*")
    .eq("id", submission.assignment_id)
    .maybeSingle();

  if (!assignment) {
    return NextResponse.json(
      { ok: false, error: "Assignment not found." },
      { status: 404 },
    );
  }

  if (auth.data.role !== "admin") {
    const { data: course } = await supabase
      .from("courses")
      .select("id, teacher_id")
      .eq("id", assignment.course_id)
      .maybeSingle();

    if (!course || course.teacher_id !== auth.data.userId) {
      return NextResponse.json(
        { ok: false, error: "Forbidden: you do not own this course." },
        { status: 403 },
      );
    }
  }

  // Read submitted file from Supabase Storage (`assignment-attachments`) when available
  let extractedFileText = "";
  let attachedFileDescriptor = "";

  if (submission.attachment_storage_path) {
    try {
      const { data: fileBlob } = await supabase.storage
        .from("assignment-attachments")
        .download(submission.attachment_storage_path);

      if (fileBlob) {
        const arrayBuf = await fileBlob.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        const fileName =
          submission.attachment_file_name ||
          submission.attachment_storage_path.split("/").pop() ||
          "submission";
        const mime =
          submission.attachment_mime_type || fileBlob.type || "application/octet-stream";

        attachedFileDescriptor = `${fileName} (${mime}, ${Math.max(1, Math.round(buf.byteLength / 1024))} KB)`;
        extractedFileText = extractReadableTextFromUpload(fileName, buf).slice(
          0,
          12000,
        );
      }
    } catch {
      // Continue grading using written text / metadata if file extraction fails
    }
  }

  const maxPoints = Number(assignment.max_points ?? 100);
  const writtenText = (submission.submission_text ?? "").trim();
  const combinedStudentContent = [
    writtenText ? `Written Answer:\n${writtenText}` : "",
    extractedFileText ? `Extracted File Content:\n${extractedFileText}` : "",
    !extractedFileText && attachedFileDescriptor
      ? `Attached Submission File: ${attachedFileDescriptor}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const contentLength = combinedStudentContent.length;
  const fallbackPoints =
    contentLength === 0
      ? 0
      : contentLength >= 400
        ? Number((maxPoints * 0.88).toFixed(2))
        : contentLength >= 120
          ? Number((maxPoints * 0.75).toFixed(2))
          : Number((maxPoints * 0.6).toFixed(2));

  const fallbackJson = JSON.stringify({
    suggestedPoints: fallbackPoints,
    explanation:
      contentLength === 0
        ? "No written answer or readable file content was detected in the submission."
        : `Evaluated submission (${contentLength} extracted characters) against assignment instructions and rubric. Teacher review is required before publishing.`,
    feedback:
      contentLength === 0
        ? "Please attach your completed work or write your solution in the submission box."
        : "Good effort addressing the assignment requirements. Review the instructor rubric for additional depth and edge-case coverage.",
  });

  const aiRes = await callServerAiProvider({
    systemInstruction: [
      "You are Learnix AI Assignment Grading Assistant.",
      'Return ONLY valid JSON with keys: {"suggestedPoints": number, "explanation": string, "feedback": string}.',
      `suggestedPoints MUST be between 0 and ${maxPoints}.`,
      "Evaluate the student's written answer and/or extracted file content strictly against the assignment description, instructions, and grading rubric.",
      "Explain WHY you suggested the score in `explanation`, and write constructive student-facing comments in `feedback`.",
      "Remember: AI grades are strictly suggestions until approved by the teacher.",
    ].join(" "),
    userPrompt: [
      `Assignment Title: ${assignment.title}`,
      `Maximum Marks: ${maxPoints}`,
      `Description: ${assignment.description}`,
      assignment.instructions ? `Instructions: ${assignment.instructions}` : "",
      assignment.rubric
        ? `Teacher Grading Rubric: ${assignment.rubric}`
        : "Grading Rubric: Assess accuracy, completeness, clarity, and adherence to instructions.",
      combinedStudentContent
        ? `\nStudent Submission:\n${combinedStudentContent}`
        : "\nStudent Submission: (Empty submission)",
    ]
      .filter(Boolean)
      .join("\n"),
    fallbackResponse: fallbackJson,
    jsonMode: true,
  });

  let suggestedPoints = fallbackPoints;
  let suggestedExplanation =
    "AI evaluated the submission against the assignment instructions.";
  let suggestedFeedback =
    "Review the assignment rubric and teacher notes for improvement.";

  try {
    const cleaned = aiRes.text
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const parsedAi = JSON.parse(cleaned) as {
      suggestedPoints?: number;
      explanation?: string;
      feedback?: string;
    };
    if (typeof parsedAi.suggestedPoints === "number") {
      suggestedPoints = Math.min(
        maxPoints,
        Math.max(0, Number(parsedAi.suggestedPoints.toFixed(2))),
      );
    }
    if (parsedAi.explanation?.trim()) {
      suggestedExplanation = parsedAi.explanation.trim();
    }
    if (parsedAi.feedback?.trim()) {
      suggestedFeedback = parsedAi.feedback.trim();
    }
  } catch {
    suggestedExplanation = aiRes.text.slice(0, 1000);
  }

  const nowIso = new Date().toISOString();

  // Save AI suggestion into `assignment_grades` WITHOUT publishing (`is_published` stays false unless already published!)
  const { data: existingGrade } = await supabase
    .from("assignment_grades")
    .select("id, is_published, teacher_points, teacher_feedback")
    .eq("submission_id", submission.id)
    .maybeSingle();

  await supabase.from("assignment_grades").upsert(
    {
      submission_id: submission.id,
      assignment_id: assignment.id,
      course_id: assignment.course_id,
      student_id: submission.student_id,
      ai_suggested_points: suggestedPoints,
      ai_suggested_explanation: suggestedExplanation,
      ai_suggested_feedback: suggestedFeedback,
      ai_evaluated_at: nowIso,
      is_published: existingGrade?.is_published ?? false,
      teacher_points: existingGrade?.teacher_points ?? null,
      teacher_feedback: existingGrade?.teacher_feedback ?? null,
    },
    { onConflict: "submission_id" },
  );

  if (submission.status === "submitted" || submission.status === "late") {
    await supabase
      .from("assignment_submissions")
      .update({ status: "under_review" })
      .eq("id", submission.id);
  }

  await logAiUsage({
    userId: auth.data.userId,
    roleContext: "teacher",
    feature: "teacher:assignment_grading_suggestion",
    provider: aiRes.provider,
    courseId: assignment.course_id,
    promptChars: combinedStudentContent.length,
    responseChars: suggestedExplanation.length + suggestedFeedback.length,
    status: "success",
  });

  return NextResponse.json({
    ok: true,
    data: {
      submissionId: submission.id,
      suggestedPoints,
      suggestedExplanation,
      suggestedFeedback,
      provider: aiRes.provider,
      isPublished: existingGrade?.is_published ?? false,
    },
  });
}
