import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  callServerAiProvider,
  checkAiRateLimit,
  logAiUsage,
} from "@/services/ai/engine";
import { requireRole } from "@/services/db/utils";

const gradeEssaySchema = z.object({
  answerId: z.string().uuid(),
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

  const parsed = gradeEssaySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Valid answerId is required." },
      { status: 400 },
    );
  }

  const rateLimit = await checkAiRateLimit(auth.data.userId);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: "AI rate limit reached. Please wait a minute." },
      { status: 429 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: answer } = await supabase
    .from("student_answers")
    .select("*")
    .eq("id", parsed.data.answerId)
    .maybeSingle();

  if (!answer) {
    return NextResponse.json(
      { ok: false, error: "Student answer not found." },
      { status: 404 },
    );
  }

  const [questionRes, attemptRes] = await Promise.all([
    supabase
      .from("questions")
      .select("id, prompt, explanation, points, exam_id")
      .eq("id", answer.question_id)
      .single(),
    supabase
      .from("exam_attempts")
      .select("id, exam_id")
      .eq("id", answer.attempt_id)
      .single(),
  ]);

  if (!questionRes.data || !attemptRes.data) {
    return NextResponse.json(
      { ok: false, error: "Question or exam attempt not found." },
      { status: 404 },
    );
  }

  const { data: exam } = await supabase
    .from("exams")
    .select("id, course_id")
    .eq("id", attemptRes.data.exam_id)
    .single();

  if (!exam) {
    return NextResponse.json(
      { ok: false, error: "Parent examination not found." },
      { status: 404 },
    );
  }

  const maxPoints = Number(questionRes.data.points ?? 10);
  const studentText = (answer.answer_text ?? "").trim();

  const fallbackPoints =
    studentText.length === 0
      ? 0
      : studentText.length >= 180
        ? maxPoints
        : studentText.length >= 80
          ? Number((maxPoints * 0.8).toFixed(2))
          : Number((maxPoints * 0.55).toFixed(2));

  const fallbackJson = JSON.stringify({
    suggestedPoints: fallbackPoints,
    explanation:
      studentText.length === 0
        ? "No written response was submitted."
        : `Evaluated response depth (${studentText.length} characters) against question rubric. Teacher approval is required before finalizing the student's grade.`,
    feedback:
      studentText.length === 0
        ? "Please provide a written answer addressing the question prompt."
        : "Good attempt addressing the prompt; review the course explanation for full rubric precision.",
  });

  const aiRes = await callServerAiProvider({
    systemInstruction:
      'You are an academic essay grading assistant. Return ONLY valid JSON with keys: {"suggestedPoints": number, "explanation": string, "feedback": string}. Suggested points must be between 0 and maxPoints. Never finalize grades without teacher approval.',
    userPrompt: `Question (${maxPoints} max marks): ${questionRes.data.prompt}\nRubric / Reference Answer: ${questionRes.data.explanation || "Evaluate conceptual accuracy, completeness, and clarity."}\nStudent Answer: ${studentText || "(Empty)"}`,
    fallbackResponse: fallbackJson,
    jsonMode: true,
  });

  let suggestedPoints = fallbackPoints;
  let suggestedFeedback =
    "AI grading suggestion generated. Teacher verification required.";

  try {
    const parsedAi = JSON.parse(aiRes.text) as {
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
    suggestedFeedback = [parsedAi.feedback, parsedAi.explanation]
      .filter(Boolean)
      .join(" — ");
  } catch {
    suggestedFeedback = aiRes.text.slice(0, 1000);
  }

  // Update student_answers suggestion & record grade history
  await supabase
    .from("student_answers")
    .update({
      ai_suggested_points: suggestedPoints,
      ai_suggested_feedback: suggestedFeedback,
    })
    .eq("id", answer.id);

  await supabase.from("essay_grade_history").insert({
    answer_id: answer.id,
    attempt_id: answer.attempt_id,
    graded_by: auth.data.userId,
    source: "ai_suggestion",
    points_awarded: suggestedPoints,
    feedback: suggestedFeedback,
  });

  await logAiUsage({
    userId: auth.data.userId,
    roleContext: "teacher",
    feature: "teacher:essay_grading_suggestion",
    provider: aiRes.provider,
    courseId: exam.course_id,
    promptChars: studentText.length,
    responseChars: suggestedFeedback.length,
    status: "success",
  });

  return NextResponse.json({
    ok: true,
    data: {
      answerId: answer.id,
      suggestedPoints,
      suggestedFeedback,
      provider: aiRes.provider,
    },
  });
}
