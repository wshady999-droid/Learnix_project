import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  callServerAiProvider,
  checkAiRateLimit,
  checkStudentActiveExamRestriction,
  logAiUsage,
  persistAiConversationTurn,
  retrieveGroundedCourseContext,
} from "@/services/ai/engine";
import { requireRole } from "@/services/db/utils";

const studentAiRequestSchema = z.object({
  conversationId: z.string().uuid().nullable().optional(),
  courseId: z.string().uuid(),
  lessonId: z.string().uuid().nullable().optional(),
  mode: z
    .enum([
      "chat",
      "pdf_discussion",
      "lesson_explanation",
      "summary",
      "flashcards",
      "practice_quiz",
      "difficult_topic",
      "terminology_translation",
      "study_plan",
    ])
    .default("chat"),
  prompt: z.string().trim().min(2).max(4000),
  targetLanguage: z.enum(["en", "ar", "de", "it", "fr"]).default("en"),
});

export async function POST(request: Request) {
  const auth = await requireRole(["student", "teacher", "admin"]);
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

  const parsed = studentAiRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid AI request.",
      },
      { status: 400 },
    );
  }

  const userId = auth.data.userId;
  const supabase = await createSupabaseServerClient();

  // 1. Verify student enrollment / course access
  if (auth.data.role === "student") {
    const { data: enrollment } = await supabase
      .from("course_enrollments")
      .select("id")
      .eq("course_id", parsed.data.courseId)
      .eq("student_id", userId)
      .maybeSingle();

    if (!enrollment) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Course access denied. You can only query courses in which you are enrolled.",
        },
        { status: 403 },
      );
    }

    // 2. Enforce Active Official Exam Restrictions
    const examGuard = await checkStudentActiveExamRestriction({
      studentId: userId,
      prompt: parsed.data.prompt,
    });

    if (examGuard.blocked) {
      await logAiUsage({
        userId,
        roleContext: "student",
        feature: `student:${parsed.data.mode}`,
        provider: "exam-guard",
        courseId: parsed.data.courseId,
        promptChars: parsed.data.prompt.length,
        responseChars: 0,
        status: "blocked_exam",
        errorMessage: examGuard.reason,
      });
      return NextResponse.json(
        { ok: false, error: examGuard.reason, blockedByExam: true },
        { status: 403 },
      );
    }
  }

  // 3. Enforce Rate Limiting & Daily Quotas
  const rateLimit = await checkAiRateLimit(userId);
  if (!rateLimit.allowed) {
    await logAiUsage({
      userId,
      roleContext: "student",
      feature: `student:${parsed.data.mode}`,
      provider: "rate-limiter",
      courseId: parsed.data.courseId,
      promptChars: parsed.data.prompt.length,
      responseChars: 0,
      status: "rate_limited",
      errorMessage: "Rate limit exceeded",
    });
    return NextResponse.json(
      {
        ok: false,
        error: `AI request limit reached (${rateLimit.usedLastMinute}/${rateLimit.minuteLimit} per min, ${rateLimit.usedLastDay}/${rateLimit.dailyLimit} per day). Please wait ${rateLimit.retryAfterSeconds ?? 60}s before trying again.`,
      },
      { status: 429 },
    );
  }

  // 4. Retrieve Grounded Course & Uploaded PDF Passages (RAG)
  const grounded = await retrieveGroundedCourseContext({
    courseId: parsed.data.courseId,
    lessonId: parsed.data.lessonId ?? null,
    query: parsed.data.prompt,
  });

  const systemInstruction = [
    "You are Learnix AI, an academic study assistant.",
    "STRICT GROUNDING RULE: Answer ONLY using the provided course materials and uploaded PDFs below.",
    "If the requested information is NOT present in the provided materials, explicitly state that it is not covered in the current course materials and do NOT invent course facts.",
    "Always cite relevant lesson or document titles when answering.",
    "Never solve official exams or reveal exam answer keys. Practice activities are allowed.",
    `Mode: ${parsed.data.mode}. Target response language code: ${parsed.data.targetLanguage}.`,
  ].join(" ");

  const userPrompt = [
    `Course: ${grounded.courseCode} — ${grounded.courseTitle}`,
    `Mode: ${parsed.data.mode}`,
    `Student Request: ${parsed.data.prompt}`,
    grounded.contextBlock
      ? `\nAuthorized Course Sources:\n${grounded.contextBlock}`
      : "\nAuthorized Course Sources: (No lesson text or uploaded PDF chunks found for this course yet.)",
  ].join("\n");

  const fallbackResponse = buildGroundedStudentFallback({
    mode: parsed.data.mode,
    prompt: parsed.data.prompt,
    courseTitle: grounded.courseTitle,
    targetLanguage: parsed.data.targetLanguage,
    citations: grounded.citations,
  });

  const aiResult = await callServerAiProvider({
    systemInstruction,
    userPrompt,
    fallbackResponse,
  });

  // 5. Persist Conversation Turn & Usage Metadata
  const savedTurn = await persistAiConversationTurn({
    conversationId: parsed.data.conversationId ?? null,
    userId,
    roleContext: "student",
    courseId: parsed.data.courseId,
    lessonId: parsed.data.lessonId ?? null,
    mode: parsed.data.mode,
    userMessage: parsed.data.prompt,
    assistantMessage: aiResult.text,
    citations: grounded.citations,
  });

  await logAiUsage({
    userId,
    roleContext: "student",
    feature: `student:${parsed.data.mode}`,
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
      provider: aiResult.provider,
      usage: {
        usedLastMinute: rateLimit.usedLastMinute + 1,
        minuteLimit: rateLimit.minuteLimit,
        usedLastDay: rateLimit.usedLastDay + 1,
        dailyLimit: rateLimit.dailyLimit,
      },
    },
  });
}

function buildGroundedStudentFallback(params: {
  mode: string;
  prompt: string;
  courseTitle: string;
  targetLanguage: string;
  citations: Array<{ sourceTitle: string; sourceType: string; excerpt: string }>;
}): string {
  if (params.citations.length === 0) {
    return `I searched the authorized materials for **${params.courseTitle}**, but there are currently no indexed lesson notes or uploaded PDF passages matching "${params.prompt}".\n\nI will not invent course content. Please upload a course PDF or select a lesson with text materials so I can provide grounded explanations and citations.`;
  }

  const citationList = params.citations
    .map((c, idx) => `${idx + 1}. **${c.sourceTitle}** (${c.sourceType}): "${c.excerpt.trim()}..."`)
    .join("\n");

  if (params.mode === "flashcards") {
    return `### Grounded Flashcards — ${params.courseTitle}\n\n${params.citations
      .slice(0, 4)
      .map(
        (c, i) =>
          `**Card ${i + 1} (${c.sourceTitle})**\n- **Front:** What are the key principles covered in *${c.sourceTitle}*?\n- **Back:** ${c.excerpt.trim()}`,
      )
      .join("\n\n")}`;
  }

  if (params.mode === "practice_quiz") {
    return `### Practice Self-Check Quiz — ${params.courseTitle}\n*(Practice mode — separate from official examinations)*\n\n${params.citations
      .slice(0, 3)
      .map(
        (c, i) =>
          `**Practice Q${i + 1}** *(Source: ${c.sourceTitle})*\nBased on the lesson excerpt ("${c.excerpt.slice(0, 120).trim()}..."), explain the core mechanism and why alternative assumptions would be incorrect.\n- **Correct Explanation Guidance:** Review *${c.sourceTitle}* to verify the exact definition and boundary conditions.`,
      )
      .join("\n\n")}`;
  }

  if (params.mode === "terminology_translation") {
    return `### Scientific Terminology Guide (Target: ${params.targetLanguage.toUpperCase()})\n\n**Term / Query:** ${params.prompt}\n\n**Course Context References:**\n${citationList}\n\n*Tip: Configure \`GEMINI_API_KEY\` or \`OPENAI_API_KEY\` on the server for full multilingual neural translation while keeping course citations active.*`;
  }

  if (params.mode === "study_plan") {
    return `### Personalized Study Plan — ${params.courseTitle}\n\n**Focus:** ${params.prompt}\n\n- **Session 1 (Core Reading):** Review ${params.citations[0]?.sourceTitle ?? "Lesson 1"} and take timestamped notes.\n- **Session 2 (Active Recall):** Convert the cited excerpts below into flashcards.\n- **Session 3 (Practice Check):** Complete a practice quiz before attempting any official exam.\n\n**Grounded Sources Referenced:**\n${citationList}`;
  }

  return `### Grounded Study Response — ${params.courseTitle}\n\nRegarding **"${params.prompt}"**, here are the most relevant authorized excerpts from your enrolled course materials:\n\n${citationList}\n\nIf you need deeper analysis of a specific paragraph or PDF page, upload the PDF in the sidebar or ask a follow-up question referencing one of the cited sources above.`;
}
