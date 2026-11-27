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
    "question_replacement",
    "pdf_questions",
    "lesson_questions",
    "exam_generator",
    "teaching_plan",
    "assignment_assistant",
    "performance_analyzer",
    "weakness_detector",
    "learning_recommendations",
    "course_summary",
  ]),
  prompt: z.string().trim().min(2).max(4000),
  questionCount: z.coerce.number().int().min(1).max(30).default(5),
  totalMarks: z.coerce.number().min(1).max(1000).optional(),
  difficultyMix: z
    .enum(["balanced", "foundational", "advanced", "easy", "medium", "hard"])
    .default("balanced"),
  questionTypes: z
    .array(
      z.enum([
        "single_choice",
        "multiple_choice",
        "true_false",
        "short_answer",
        "essay",
      ]),
    )
    .optional(),
  existingQuestionPrompt: z.string().max(1500).optional(),
});

export interface GeneratedDraftQuestion {
  prompt: string;
  questionType:
    | "single_choice"
    | "multiple_choice"
    | "true_false"
    | "short_answer"
    | "essay";
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

  // Gather rich, authorized course & student analytics context for the teacher
  const [grounded, resultsRes, enrollmentsRes, assignmentsRes] =
    await Promise.all([
      retrieveGroundedCourseContext({
        courseId: parsed.data.courseId,
        lessonId: parsed.data.lessonId ?? null,
        query: parsed.data.prompt,
      }),
      supabase
        .from("results")
        .select("student_id, score_percent, passed, exam_id")
        .eq("course_id", parsed.data.courseId),
      supabase
        .from("course_enrollments")
        .select("student_id, progress_percent, status, last_accessed_at")
        .eq("course_id", parsed.data.courseId),
      supabase
        .from("assignments")
        .select("id, title, max_points, due_at, is_published")
        .eq("course_id", parsed.data.courseId)
        .eq("is_published", true),
    ]);

  const results = resultsRes.data ?? [];
  const enrollments = enrollmentsRes.data ?? [];
  const assignments = assignmentsRes.data ?? [];

  const studentIds = Array.from(
    new Set(enrollments.map((e) => e.student_id)),
  );
  const [profilesRes, submissionsRes] = await Promise.all([
    studentIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", studentIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null; email: string }> }),
    assignments.length > 0
      ? supabase
          .from("assignment_submissions")
          .select("assignment_id, student_id, status, grade_points, is_grade_published")
          .in(
            "assignment_id",
            assignments.map((a) => a.id),
          )
      : Promise.resolve({
          data: [] as Array<{
            assignment_id: string;
            student_id: string;
            status: string;
            grade_points: number | null;
            is_grade_published: boolean;
          }>,
        }),
  ]);

  const profileMap = new Map(
    (profilesRes.data ?? []).map((p) => [
      p.id,
      p.full_name?.trim() || p.email,
    ]),
  );
  const submissions = submissionsRes.data ?? [];

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
            enrollments.reduce(
              (s, e) => s + Number(e.progress_percent ?? 0),
              0,
            ) / enrollments.length
          ).toFixed(1),
        )
      : 0;

  // Build concise per-student snapshot for teacher insights (at most 30 students)
  const rosterDigest = enrollments.slice(0, 30).map((enr) => {
    const name = profileMap.get(enr.student_id) ?? "Student";
    const stuResults = results.filter((r) => r.student_id === enr.student_id);
    const quizAvg =
      stuResults.length > 0
        ? Math.round(
            stuResults.reduce((a, b) => a + Number(b.score_percent ?? 0), 0) /
              stuResults.length,
          )
        : null;
    const stuSubmittedIds = new Set(
      submissions
        .filter(
          (s) => s.student_id === enr.student_id && s.status !== "draft",
        )
        .map((s) => s.assignment_id),
    );
    const missingCount = Math.max(0, assignments.length - stuSubmittedIds.size);
    return `- ${name}: progress ${Number(enr.progress_percent ?? 0)}%, quiz avg ${quizAvg !== null ? `${quizAvg}%` : "N/A"}, missing assignments: ${missingCount}`;
  });

  const isQuestionMode = [
    "question_generator",
    "question_replacement",
    "pdf_questions",
    "lesson_questions",
    "exam_generator",
  ].includes(parsed.data.mode);

  const requestedCount =
    parsed.data.mode === "question_replacement" ? 1 : parsed.data.questionCount;
  const allowedTypes =
    parsed.data.questionTypes && parsed.data.questionTypes.length > 0
      ? parsed.data.questionTypes
      : (["single_choice", "true_false", "short_answer"] as const);
  const defaultPointsPerQuestion = parsed.data.totalMarks
    ? Math.max(1, Number((parsed.data.totalMarks / requestedCount).toFixed(2)))
    : 5;

  const fallbackQuestions: GeneratedDraftQuestion[] = isQuestionMode
    ? buildGroundedDraftQuestions({
        count: Math.min(requestedCount, 15),
        difficultyMix: parsed.data.difficultyMix,
        courseTitle: grounded.courseTitle,
        citations: grounded.citations,
        prompt: parsed.data.prompt,
        allowedTypes: [...allowedTypes],
        pointsPerQuestion: defaultPointsPerQuestion,
      })
    : [];

  if (isQuestionMode) {
    const jsonSystemInstruction = [
      "You are Learnix AI Assessment Architect for instructors.",
      "Generate strictly grounded, academically rigorous quiz questions based ONLY on the supplied course materials.",
      'Return ONLY valid JSON matching: {"summary": string, "questions": Array<{"prompt": string, "questionType": "single_choice"|"multiple_choice"|"true_false"|"short_answer"|"essay", "difficulty": "easy"|"medium"|"hard", "points": number, "explanation": string, "options": Array<{"optionText": string, "isCorrect": boolean}>}>}.',
      "Rules:",
      `- Generate exactly ${requestedCount} question(s).`,
      `- Allowed questionType values: ${allowedTypes.join(", ")}.`,
      `- Default marks per question: ${defaultPointsPerQuestion}.`,
      "- For single_choice: provide 4 options with exactly 1 isCorrect=true.",
      "- For multiple_choice: provide 4 options with 2 or 3 isCorrect=true.",
      '- For true_false: provide 2 options ("True" and "False") with 1 isCorrect=true.',
      "- For short_answer or essay: options must be [] and explanation must describe the expected answer/rubric.",
      parsed.data.existingQuestionPrompt
        ? `- Do NOT repeat this question being replaced: "${parsed.data.existingQuestionPrompt}". Create a fresh alternative covering the same topic.`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const jsonUserPrompt = [
      `Course: ${grounded.courseCode} — ${grounded.courseTitle}`,
      `Difficulty Target: ${parsed.data.difficultyMix}`,
      `Teacher Request: ${parsed.data.prompt}`,
      grounded.contextBlock
        ? `\nAuthorized Course Materials:\n${grounded.contextBlock}`
        : "\nAuthorized Course Materials: Use the course title and teacher request above.",
    ].join("\n");

    const aiRes = await callServerAiProvider({
      systemInstruction: jsonSystemInstruction,
      userPrompt: jsonUserPrompt,
      fallbackResponse: JSON.stringify({
        summary: `Prepared ${fallbackQuestions.length} grounded draft question(s) for teacher review.`,
        questions: fallbackQuestions,
      }),
      jsonMode: true,
    });

    let parsedQuestions = fallbackQuestions;
    let summaryMarkdown = `### AI Quiz Draft — ${grounded.courseTitle}\nPrepared **${fallbackQuestions.length}** editable question(s) for teacher review.`;

    try {
      const cleaned = aiRes.text
        .replace(/^```json\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      const decoded = JSON.parse(cleaned) as {
        summary?: string;
        questions?: Array<{
          prompt?: string;
          questionType?: string;
          difficulty?: string;
          points?: number;
          explanation?: string;
          options?: Array<{ optionText?: string; isCorrect?: boolean }>;
        }>;
      };

      if (Array.isArray(decoded.questions) && decoded.questions.length > 0) {
        const sanitized: GeneratedDraftQuestion[] = decoded.questions
          .filter((q) => typeof q.prompt === "string" && q.prompt.trim().length > 3)
          .map((q) => {
            const qType = (
              [
                "single_choice",
                "multiple_choice",
                "true_false",
                "short_answer",
                "essay",
              ].includes(String(q.questionType))
                ? q.questionType
                : "single_choice"
            ) as GeneratedDraftQuestion["questionType"];
            const diff = (
              ["easy", "medium", "hard"].includes(String(q.difficulty))
                ? q.difficulty
                : "medium"
            ) as GeneratedDraftQuestion["difficulty"];

            let opts = Array.isArray(q.options)
              ? q.options
                  .filter(
                    (o) =>
                      typeof o.optionText === "string" &&
                      o.optionText.trim().length > 0,
                  )
                  .map((o) => ({
                    optionText: o.optionText!.trim(),
                    isCorrect: Boolean(o.isCorrect),
                  }))
              : [];

            if (qType === "true_false" && opts.length < 2) {
              opts = [
                { optionText: "True", isCorrect: true },
                { optionText: "False", isCorrect: false },
              ];
            } else if (
              (qType === "single_choice" || qType === "multiple_choice") &&
              !opts.some((o) => o.isCorrect) &&
              opts.length > 0
            ) {
              opts[0]!.isCorrect = true;
            } else if (qType === "short_answer" || qType === "essay") {
              opts = [];
            }

            return {
              prompt: q.prompt!.trim(),
              questionType: qType,
              difficulty: diff,
              points:
                typeof q.points === "number" && q.points > 0
                  ? q.points
                  : defaultPointsPerQuestion,
              explanation: (q.explanation ?? "").trim(),
              options: opts,
            };
          });

        if (sanitized.length > 0) {
          parsedQuestions = sanitized;
          summaryMarkdown =
            decoded.summary?.trim() ||
            `### AI Quiz Draft — ${grounded.courseTitle}\nGenerated **${sanitized.length}** question(s) grounded in your course materials. Review, edit, or publish below.`;
        }
      }
    } catch {
      // Keep fallbackQuestions if JSON parsing failed
    }

    const savedTurn = await persistAiConversationTurn({
      conversationId: parsed.data.conversationId ?? null,
      userId,
      roleContext: "teacher",
      courseId: parsed.data.courseId,
      lessonId: parsed.data.lessonId ?? null,
      mode: parsed.data.mode,
      userMessage: parsed.data.prompt,
      assistantMessage: summaryMarkdown,
      citations: grounded.citations,
      structuredPayload: {
        draftQuestions: parsedQuestions,
        requiresTeacherReview: true,
      },
    });

    await logAiUsage({
      userId,
      roleContext: "teacher",
      feature: `teacher:${parsed.data.mode}`,
      provider: aiRes.provider,
      courseId: parsed.data.courseId,
      promptChars: parsed.data.prompt.length,
      responseChars: summaryMarkdown.length,
      status: "success",
    });

    return NextResponse.json({
      ok: true,
      data: {
        conversationId: savedTurn.conversationId,
        messageId: savedTurn.assistantMessageId,
        content: summaryMarkdown,
        citations: grounded.citations,
        draftQuestions: parsedQuestions,
        provider: aiRes.provider,
        requiresTeacherReview: true,
      },
    });
  }

  // Analytical / Pedagogical Teacher Assistant Modes
  const systemInstruction = [
    "You are Learnix AI Teacher Assistant.",
    "Provide clear, actionable insights grounded strictly in the authorized course materials and live class telemetry provided below.",
    "You can analyze individual student performance, identify students with low grades or missing assignments, summarize course averages, highlight difficult topics, and draft teaching plans.",
    "Never fabricate student names, grades, or facts not present in the context.",
  ].join(" ");

  const userPrompt = [
    `Course: ${grounded.courseCode} — ${grounded.courseTitle}`,
    `Mode: ${parsed.data.mode}`,
    `Live Class Summary: ${enrollments.length} enrolled students, avg course completion ${avgProgress}%, ${results.length} quiz attempts, avg quiz score ${avgScore}%, ${assignments.length} published assignments.`,
    rosterDigest.length > 0
      ? `\nAuthorized Student Performance Snapshot:\n${rosterDigest.join("\n")}`
      : "\nAuthorized Student Performance Snapshot: No students enrolled yet.",
    grounded.contextBlock
      ? `\nCourse Materials:\n${grounded.contextBlock}`
      : "\nCourse Materials: (No indexed lesson markdown or PDF chunks yet.)",
    `\nTeacher Question / Instruction: ${parsed.data.prompt}`,
  ].join("\n");

  const fallbackResponse = buildTeacherFallbackMarkdown({
    mode: parsed.data.mode,
    courseTitle: grounded.courseTitle,
    avgScore,
    avgProgress,
    studentCount: enrollments.length,
    resultCount: results.length,
    rosterDigest,
    citations: grounded.citations,
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
    structuredPayload: { requiresTeacherReview: true },
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
      draftQuestions: [],
      provider: aiResult.provider,
      requiresTeacherReview: true,
    },
  });
}

function buildGroundedDraftQuestions(params: {
  count: number;
  difficultyMix: string;
  courseTitle: string;
  citations: Array<{ sourceTitle: string; excerpt: string }>;
  prompt: string;
  allowedTypes: Array<GeneratedDraftQuestion["questionType"]>;
  pointsPerQuestion: number;
}): GeneratedDraftQuestion[] {
  const difficulties: Array<"easy" | "medium" | "hard"> =
    params.difficultyMix === "foundational" || params.difficultyMix === "easy"
      ? ["easy", "easy", "medium"]
      : params.difficultyMix === "advanced" || params.difficultyMix === "hard"
        ? ["medium", "hard", "hard"]
        : ["easy", "medium", "hard"];

  const types =
    params.allowedTypes.length > 0
      ? params.allowedTypes
      : (["single_choice", "true_false", "short_answer"] as const);

  const items: GeneratedDraftQuestion[] = [];
  for (let i = 0; i < params.count; i++) {
    const src = params.citations[i % Math.max(1, params.citations.length)];
    const sourceName = src?.sourceTitle ?? params.courseTitle;
    const diff = difficulties[i % difficulties.length] ?? "medium";
    const qType = types[i % types.length] ?? "single_choice";

    if (qType === "true_false") {
      items.push({
        prompt: `Based on "${sourceName}", determine whether the following statement applies to ${params.prompt.slice(0, 70)}.`,
        questionType: "true_false",
        difficulty: diff,
        points: params.pointsPerQuestion,
        explanation: `Grounded in ${sourceName}. Verify before publishing.`,
        options: [
          { optionText: "True", isCorrect: true },
          { optionText: "False", isCorrect: false },
        ],
      });
    } else if (qType === "short_answer" || qType === "essay") {
      items.push({
        prompt: `Explain how "${sourceName}" addresses ${params.prompt.slice(0, 80)} and provide one practical example.`,
        questionType: qType,
        difficulty: diff,
        points: params.pointsPerQuestion,
        explanation: `Rubric: Check conceptual accuracy against ${sourceName}, clarity, and example relevance.`,
        options: [],
      });
    } else {
      items.push({
        prompt: `According to "${sourceName}", which statement accurately describes ${params.prompt.slice(0, 70)}?`,
        questionType: qType,
        difficulty: diff,
        points: params.pointsPerQuestion,
        explanation: `Grounded in ${sourceName}.`,
        options: [
          {
            optionText: src
              ? src.excerpt.slice(0, 110).trim()
              : `Core principle taught in ${sourceName}`,
            isCorrect: true,
          },
          {
            optionText:
              qType === "multiple_choice"
                ? `Applied workflow documented in ${sourceName}`
                : "An unsupported assumption outside the lesson scope",
            isCorrect: qType === "multiple_choice",
          },
          {
            optionText: "A contradictory premise not backed by the material",
            isCorrect: false,
          },
          {
            optionText: "An unrelated concept from outside this module",
            isCorrect: false,
          },
        ],
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
  rosterDigest: string[];
  citations: Array<{ sourceTitle: string; excerpt: string }>;
}): string {
  const header = `### AI Teacher Insights (${params.mode.replace(/_/g, " ")}) — ${params.courseTitle}\n\n`;
  const metricsLine = `- **Enrolled Students:** ${params.studentCount}\n- **Average Course Completion:** ${params.avgProgress}%\n- **Graded Quiz Attempts:** ${params.resultCount}\n- **Average Quiz Score:** ${params.avgScore}%\n\n`;
  const rosterBlock =
    params.rosterDigest.length > 0
      ? `**Student Snapshot:**\n${params.rosterDigest.slice(0, 10).join("\n")}\n\n`
      : "";
  const sourcesLine =
    params.citations.length > 0
      ? `**Referenced Course Sources:**\n${params.citations
          .map((c, idx) => `${idx + 1}. ${c.sourceTitle}`)
          .join("\n")}`
      : "**Referenced Course Sources:** Upload a PDF or add lesson content to enrich grounded insights.";

  return `${header}${metricsLine}${rosterBlock}${sourcesLine}`;
}
