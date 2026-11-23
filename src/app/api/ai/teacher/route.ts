import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  callServerAiProvider,
  checkAiRateLimit,
  logAiUsage,
  persistAiConversationTurn,
  retrieveGroundedCourseContext,
} from "@/services/ai/engine";
import { requireRole } from "@/services/db/utils";

const teacherAiRequestSchema = z.object({
  conversationId: z.string().uuid().nullable().optional(),
  courseId: z.string().uuid(),
  lessonId: z.string().uuid().nullable().optional(),
  mode: z.enum([
    "question_generator",
    "pdf_questions",
    "lesson_questions",
    "exam_generator",
    "teaching_plan",
    "assignment_assistant",
    "performance_analyzer",
    "weakness_detector",
    "learning_recommendations",
  ]),
  prompt: z.string().trim().min(2).max(4000),
  questionCount: z.coerce.number().int().min(1).max(30).default(5),
  difficultyMix: z.enum(["balanced", "foundational", "advanced"]).default("balanced"),
});

export interface GeneratedDraftQuestion {
  prompt: string;
  questionType: "single_choice" | "true_false" | "essay";
  difficulty: "easy" | "medium" | "hard";
  points: number;
  explanation: string;
  options: Array<{ optionText: string; isCorrect: boolean }>;
}

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

  const parsed = teacherAiRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid teacher AI request.",
      },
      { status: 400 },
    );
  }

  const userId = auth.data.userId;
  const supabase = await createSupabaseServerClient();

  // Verify teacher owns the course
  if (auth.data.role !== "admin") {
    const { data: courseRow } = await supabase
      .from("courses")
      .select("id, teacher_id")
      .eq("id", parsed.data.courseId)
      .maybeSingle();

    if (!courseRow || courseRow.teacher_id !== userId) {
      return NextResponse.json(
        { ok: false, error: "You do not own this course." },
        { status: 403 },
      );
    }
  }

  // Enforce rate limit
  const rateLimit = await checkAiRateLimit(userId);
  if (!rateLimit.allowed) {
    await logAiUsage({
      userId,
      roleContext: "teacher",
      feature: `teacher:${parsed.data.mode}`,
      provider: "rate-limiter",
      courseId: parsed.data.courseId,
      promptChars: parsed.data.prompt.length,
      responseChars: 0,
      status: "rate_limited",
    });
    return NextResponse.json(
      {
        ok: false,
        error: `AI request limit reached. Please retry in ${rateLimit.retryAfterSeconds ?? 60}s.`,
      },
      { status: 429 },
    );
  }

  // Retrieve grounded course & PDF context + live student performance metrics
  const [grounded, resultsRes, enrollmentsRes] = await Promise.all([
    retrieveGroundedCourseContext({
      courseId: parsed.data.courseId,
      lessonId: parsed.data.lessonId ?? null,
      query: parsed.data.prompt,
    }),
    supabase
      .from("results")
      .select("score_percent, passed")
      .eq("course_id", parsed.data.courseId),
    supabase
      .from("course_enrollments")
      .select("progress_percent, status")
      .eq("course_id", parsed.data.courseId),
  ]);

  const results = resultsRes.data ?? [];
  const enrollments = enrollmentsRes.data ?? [];
  const avgScore =
    results.length > 0
      ? Number(
          (
            results.reduce((s, r) => s + Number(r.score_percent ?? 0), 0) /
            results.length
          ).toFixed(1),
        )
      : 0;
  const avgProgress =
    enrollments.length > 0
      ? Number(
          (
            enrollments.reduce((s, e) => s + Number(e.progress_percent ?? 0), 0) /
            enrollments.length
          ).toFixed(1),
        )
      : 0;

  const isQuestionMode = [
    "question_generator",
    "pdf_questions",
    "lesson_questions",
    "exam_generator",
  ].includes(parsed.data.mode);

  const fallbackQuestions: GeneratedDraftQuestion[] = isQuestionMode
    ? buildGroundedDraftQuestions({
        count: Math.min(parsed.data.questionCount, 6),
        difficultyMix: parsed.data.difficultyMix,
        courseTitle: grounded.courseTitle,
        citations: grounded.citations,
        prompt: parsed.data.prompt,
      })
    : [];

  const systemInstruction = [
    "You are Learnix AI Teacher Assistant.",
    "All generated educational content is a DRAFT that the teacher MUST review before publishing.",
    "Ground all questions, teaching plans, assignments, and performance recommendations strictly in the provided course sources and class statistics.",
    "Do not invent facts absent from the course materials.",
  ].join(" ");

  const userPrompt = [
    `Course: ${grounded.courseCode} — ${grounded.courseTitle}`,
    `Mode: ${parsed.data.mode}`,
    `Requested Question Count: ${parsed.data.questionCount} (${parsed.data.difficultyMix})`,
    `Live Class Metrics: ${enrollments.length} enrolled students, avg progress ${avgProgress}%, ${results.length} graded exam attempts, avg exam score ${avgScore}%.`,
    `Teacher Prompt: ${parsed.data.prompt}`,
    grounded.contextBlock
      ? `\nCourse Materials:\n${grounded.contextBlock}`
      : "\nCourse Materials: (No indexed lesson markdown or PDF chunks yet.)",
  ].join("\n");

  const fallbackResponse = buildTeacherFallbackMarkdown({
    mode: parsed.data.mode,
    courseTitle: grounded.courseTitle,
    avgScore,
    avgProgress,
    studentCount: enrollments.length,
    resultCount: results.length,
    citations: grounded.citations,
    draftQuestions: fallbackQuestions,
  });

  const aiResult = await callServerAiProvider({
    systemInstruction,
    userPrompt,
    fallbackResponse,
  });

  const savedTurn = await persistAiConversationTurn({
    conversationId: parsed.data.conversationId ?? null,
    userId,
    roleContext: "teacher",
    courseId: parsed.data.courseId,
    lessonId: parsed.data.lessonId ?? null,
    mode: parsed.data.mode,
    userMessage: parsed.data.prompt,
    assistantMessage: aiResult.text,
    citations: grounded.citations,
    structuredPayload:
      fallbackQuestions.length > 0
        ? { draftQuestions: fallbackQuestions, requiresTeacherReview: true }
        : { requiresTeacherReview: true },
  });

  await logAiUsage({
    userId,
    roleContext: "teacher",
    feature: `teacher:${parsed.data.mode}`,
    provider: aiResult.provider,
    courseId: parsed.data.courseId,
    promptChars: parsed.data.prompt.length,
    responseChars: aiResult.text.length,
    status: "success",
  });

  return NextResponse.json({
    ok: true,
    data: {
      conversationId: savedTurn.conversationId,
      messageId: savedTurn.assistantMessageId,
      content: aiResult.text,
      citations: grounded.citations,
      draftQuestions: fallbackQuestions,
      provider: aiResult.provider,
      requiresTeacherReview: true,
    },
  });
}

function buildGroundedDraftQuestions(params: {
  count: number;
  difficultyMix: "balanced" | "foundational" | "advanced";
  courseTitle: string;
  citations: Array<{ sourceTitle: string; excerpt: string }>;
  prompt: string;
}): GeneratedDraftQuestion[] {
  const difficulties: Array<"easy" | "medium" | "hard"> =
    params.difficultyMix === "foundational"
      ? ["easy", "easy", "medium"]
      : params.difficultyMix === "advanced"
        ? ["medium", "hard", "hard"]
        : ["easy", "medium", "hard"];

  const items: GeneratedDraftQuestion[] = [];
  for (let i = 0; i < params.count; i++) {
    const src = params.citations[i % Math.max(1, params.citations.length)];
    const sourceName = src?.sourceTitle ?? params.courseTitle;
    const diff = difficulties[i % difficulties.length] ?? "medium";

    if (i % 3 === 0) {
      items.push({
        prompt: `[Draft for Teacher Review] According to "${sourceName}", which statement best describes the core concept related to "${params.prompt.slice(0, 60)}"?`,
        questionType: "single_choice",
        difficulty: diff,
        points: 5,
        explanation: `Grounded in ${sourceName}. Verify options before publishing to students.`,
        options: [
          {
            optionText: src
              ? src.excerpt.slice(0, 110).trim()
              : `Core principle defined in ${sourceName}`,
            isCorrect: true,
          },
          {
            optionText: "An unrelated assumption not supported by the lesson",
            isCorrect: false,
          },
          {
            optionText: "The inverse boundary condition outside course scope",
            isCorrect: false,
          },
        ],
      });
    } else if (i % 3 === 1) {
      items.push({
        prompt: `[Draft for Teacher Review] True or False: The principles outlined in "${sourceName}" directly apply to "${params.prompt.slice(0, 60)}".`,
        questionType: "true_false",
        difficulty: diff,
        points: 5,
        explanation: `Grounded in ${sourceName}. Teacher should verify accuracy before publishing.`,
        options: [
          { optionText: "True", isCorrect: true },
          { optionText: "False", isCorrect: false },
        ],
      });
    } else {
      items.push({
        prompt: `[Draft for Teacher Review] Explain in your own words how "${sourceName}" addresses "${params.prompt.slice(0, 80)}" and provide one structured example.`,
        questionType: "essay",
        difficulty: diff,
        points: 10,
        explanation: `Rubric: Check conceptual accuracy against ${sourceName}, clarity of reasoning, and applied example.`,
        options: [],
      });
    }
  }
  return items;
}

function buildTeacherFallbackMarkdown(params: {
  mode: string;
  courseTitle: string;
  avgScore: number;
  avgProgress: number;
  studentCount: number;
  resultCount: number;
  citations: Array<{ sourceTitle: string; excerpt: string }>;
  draftQuestions: GeneratedDraftQuestion[];
}): string {
  const header = `### AI Teacher Draft (${params.mode.replace(/_/g, " ")}) — ${params.courseTitle}\n> **Teacher Review Required:** Review and edit all AI-generated items before publishing to students.\n\n`;

  if (params.draftQuestions.length > 0) {
    return (
      header +
      `Prepared **${params.draftQuestions.length} draft questions** grounded in your course materials. You can inspect each question below and import approved drafts directly into an examination.`
    );
  }

  const metricsLine = `- **Enrolled Students:** ${params.studentCount}\n- **Average Course Progress:** ${params.avgProgress}%\n- **Graded Exam Attempts:** ${params.resultCount}\n- **Average Exam Score:** ${params.avgScore}%\n\n`;

  const sourcesLine =
    params.citations.length > 0
      ? `**Referenced Course Sources:**\n${params.citations
          .map((c, idx) => `${idx + 1}. ${c.sourceTitle}`)
          .join("\n")}`
      : "**Referenced Course Sources:** No indexed lesson markdown or PDF chunks found yet. Upload a PDF or add lesson notes to enrich AI outputs.";

  return `${header}${metricsLine}${sourcesLine}`;
}
