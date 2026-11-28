import { NextResponse } from "next/server";
import { z } from "zod";

import {
  buildLearnixScopeAndRedirectionPolicy,
  detectClearlyUnrelatedOffTopicPrompt,
} from "@/lib/ai-assistant-scope";
import {
  formatCleanQuizQuestionsText,
  sanitizeQuizOptionText,
  sanitizeQuizQuestionPrompt,
} from "@/lib/quiz-format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  callServerAiProvider,
  checkAiRateLimit,
  extractReadableTextFromUpload,
  getVerifiedPlatformHelpContext,
  logAiUsage,
  persistAiConversationTurn,
  retrieveGroundedCourseContext,
  type AiInlineMediaPart,
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
  prompt: z.string().trim().min(1).max(4000),
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
  materialIds: z.array(z.string().uuid()).default([]),
  audioAttachment: z
    .object({
      fileName: z.string().min(1).max(200),
      mimeType: z.string().min(1).max(120),
      base64Data: z.string().min(8).max(15 * 1024 * 1024),
    })
    .nullable()
    .optional(),
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

  const isQuestionMode = [
    "question_generator",
    "question_replacement",
    "pdf_questions",
    "lesson_questions",
    "exam_generator",
  ].includes(parsed.data.mode);

  const mediaParts: AiInlineMediaPart[] = parsed.data.audioAttachment
    ? [
        {
          fileName: parsed.data.audioAttachment.fileName,
          mimeType: parsed.data.audioAttachment.mimeType,
          base64Data: parsed.data.audioAttachment.base64Data,
          kind: "audio",
        },
      ]
    : [];

  // Polite redirection for clearly unrelated off-topic inquiries in assistant chat modes
  if (!isQuestionMode && mediaParts.length === 0) {
    const offTopicCheck = detectClearlyUnrelatedOffTopicPrompt(
      parsed.data.prompt,
    );
    if (offTopicCheck.isOffTopic && offTopicCheck.redirectionMessage) {
      const savedOffTopicTurn = await persistAiConversationTurn({
        conversationId: parsed.data.conversationId ?? null,
        userId,
        roleContext: "teacher",
        courseId: parsed.data.courseId,
        lessonId: parsed.data.lessonId ?? null,
        mode: parsed.data.mode,
        userMessage: parsed.data.prompt,
        assistantMessage: offTopicCheck.redirectionMessage,
        citations: [],
        structuredPayload: { offTopicRedirected: true },
      });

      await logAiUsage({
        userId,
        roleContext: "teacher",
        feature: `teacher:${parsed.data.mode}`,
        provider: "learnix-scope-guard",
        courseId: parsed.data.courseId,
        promptChars: parsed.data.prompt.length,
        responseChars: offTopicCheck.redirectionMessage.length,
        status: "success",
      });

      return NextResponse.json({
        ok: true,
        data: {
          conversationId: savedOffTopicTurn.conversationId,
          messageId: savedOffTopicTurn.assistantMessageId,
          content: offTopicCheck.redirectionMessage,
          citations: [],
          draftQuestions: [],
          provider: "learnix-scope-guard",
          requiresTeacherReview: false,
        },
      });
    }
  }

  // Gather rich, authorized course & student analytics context for the teacher
  const [grounded, resultsRes, enrollmentsRes, assignmentsRes] =
    await Promise.all([
      retrieveGroundedCourseContext({
        courseId: parsed.data.courseId,
        lessonId: parsed.data.lessonId ?? null,
        query: parsed.data.prompt,
        allowBroadCourseFallback: isQuestionMode,
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

  // When specific materials are selected, pull both their indexed chunks AND actual uploaded Storage files
  const materialIds = parsed.data.materialIds ?? [];
  let selectedMaterialChunks: Array<{
    sourceTitle: string;
    content: string;
    lessonId?: string | null;
  }> = [];
  if (materialIds.length > 0) {
    const [materialsRes, selectedLessonsRes, assignmentMatsRes, materialChunksRes] =
      await Promise.all([
        supabase
          .from("learning_resources")
          .select(
            "id, title, file_name, resource_type, storage_bucket, storage_path",
          )
          .eq("course_id", parsed.data.courseId)
          .in("id", materialIds),
        supabase
          .from("lessons")
          .select(
            "id, title, content_type, summary, content_markdown, attachment_storage_path",
          )
          .eq("course_id", parsed.data.courseId)
          .in("id", materialIds),
        supabase
          .from("assignment_materials")
          .select("id, file_name, storage_bucket, storage_path")
          .eq("course_id", parsed.data.courseId)
          .in("id", materialIds),
        supabase
          .from("ai_document_chunks")
          .select("id, source_title, source_type, content, lesson_id")
          .in("course_id", [parsed.data.courseId])
          .order("created_at", { ascending: false })
          .limit(120),
      ]);

    const materials = materialsRes.data ?? [];
    const selectedLessons = selectedLessonsRes.data ?? [];
    const assignmentMats = assignmentMatsRes.data ?? [];
    const materialFileNames = new Set(
      materials.map((m) => m.file_name).filter(Boolean),
    );
    const selectedLessonIdSet = new Set(selectedLessons.map((l) => l.id));

    const allChunks = materialChunksRes.data ?? [];
    selectedMaterialChunks = allChunks
      .filter(
        (c) =>
          materialFileNames.has(c.source_title) ||
          (c.lesson_id && selectedLessonIdSet.has(c.lesson_id)),
      )
      .map((c) => ({
        sourceTitle: c.source_title,
        content: c.content,
        lessonId: c.lesson_id ?? null,
      }));

    const downloadAndExtract = async (
      buckets: string[],
      path: string,
      fallbackName: string,
    ): Promise<string> => {
      for (const bucket of buckets) {
        try {
          const { data: blob } = await supabase.storage
            .from(bucket)
            .download(path);
          if (blob) {
            const buf = Buffer.from(await blob.arrayBuffer());
            const text = extractReadableTextFromUpload(fallbackName, buf).trim();
            if (text.length > 0) return text.slice(0, 6000);
          }
        } catch {
          // Try next bucket candidate
        }
      }
      return "";
    };

    for (const les of selectedLessons) {
      const lessonBody = [les.summary, les.content_markdown]
        .filter(Boolean)
        .join("\n\n")
        .trim();
      if (lessonBody) {
        selectedMaterialChunks.push({
          sourceTitle: les.title,
          content: lessonBody.slice(0, 5000),
          lessonId: les.id,
        });
      }
      if (les.attachment_storage_path) {
        const primaryBucket =
          les.content_type === "presentation"
            ? "course-presentations"
            : les.content_type === "pdf"
              ? "course-pdfs"
              : "course-materials";
        const fileName =
          les.attachment_storage_path.split("/").pop() || `${les.title}.pdf`;
        const extracted = await downloadAndExtract(
          Array.from(
            new Set([
              primaryBucket,
              "course-materials",
              "course-pdfs",
              "course-presentations",
            ]),
          ),
          les.attachment_storage_path,
          fileName,
        );
        if (extracted) {
          selectedMaterialChunks.push({
            sourceTitle: `${les.title} (${fileName})`,
            content: extracted,
            lessonId: les.id,
          });
        }
      }
    }

    for (const mat of materials) {
      if (mat.storage_path) {
        const fileName =
          mat.file_name || mat.storage_path.split("/").pop() || mat.title;
        const extracted = await downloadAndExtract(
          Array.from(
            new Set([
              mat.storage_bucket || "course-materials",
              "course-materials",
              "course-pdfs",
              "course-presentations",
            ]),
          ),
          mat.storage_path,
          fileName,
        );
        if (extracted) {
          selectedMaterialChunks.push({
            sourceTitle: mat.title || fileName,
            content: extracted,
            lessonId: null,
          });
        }
      }
    }

    for (const amat of assignmentMats) {
      if (amat.storage_path) {
        const fileName =
          amat.file_name ||
          amat.storage_path.split("/").pop() ||
          "assignment-material";
        const extracted = await downloadAndExtract(
          [amat.storage_bucket || "assignment-attachments"],
          amat.storage_path,
          fileName,
        );
        if (extracted) {
          selectedMaterialChunks.push({
            sourceTitle: fileName,
            content: extracted,
            lessonId: null,
          });
        }
      }
    }
  }

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
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            full_name: string | null;
            email: string;
          }>,
        }),
    assignments.length > 0
      ? supabase
          .from("assignment_submissions")
          .select(
            "assignment_id, student_id, status, grade_points, is_grade_published",
          )
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

  const requestedCount =
    parsed.data.mode === "question_replacement" ? 1 : parsed.data.questionCount;
  const allowedTypes =
    parsed.data.questionTypes && parsed.data.questionTypes.length > 0
      ? parsed.data.questionTypes
      : (["single_choice", "true_false", "short_answer"] as const);
  const defaultPointsPerQuestion = parsed.data.totalMarks
    ? Math.max(1, Number((parsed.data.totalMarks / requestedCount).toFixed(2)))
    : 5;

  const forbiddenQuizContext = {
    courseCode: grounded.courseCode,
    courseTitle: grounded.courseTitle,
  };

  const lessonAndDocCitations = grounded.citations.filter(
    (c) => c.sourceType !== "course" && c.sourceType !== "course_metadata",
  );

  const prioritizedCitations =
    selectedMaterialChunks.length > 0
      ? selectedMaterialChunks.map((c) => ({
          sourceTitle: c.sourceTitle,
          sourceType: "selected_material",
          excerpt: c.content.slice(0, 260),
          lessonId: c.lessonId ?? null,
        }))
      : lessonAndDocCitations;

  const fallbackQuestions: GeneratedDraftQuestion[] = isQuestionMode
    ? buildGroundedDraftQuestions({
        count: Math.min(requestedCount, 15),
        difficultyMix: parsed.data.difficultyMix,
        citations: prioritizedCitations,
        prompt: parsed.data.prompt,
        allowedTypes: [...allowedTypes],
        pointsPerQuestion: defaultPointsPerQuestion,
        forbiddenContext: forbiddenQuizContext,
      })
    : [];

  if (isQuestionMode) {
    // Clean material context stripped of internal course code prefixes so the model focuses purely on educational content
    const selectedMaterialsBlock = selectedMaterialChunks
      .map(
        (c, idx) =>
          `Selected Uploaded Material ${idx + 1} (${c.sourceTitle}):\n${c.content.slice(0, 3500)}`,
      )
      .join("\n\n");

    const cleanMaterialPassages = [
      selectedMaterialsBlock,
      ...(selectedMaterialChunks.length === 0
        ? lessonAndDocCitations.map(
            (c, idx) => `Passage ${idx + 1}:\n${c.excerpt}`,
          )
        : []),
    ]
      .filter(Boolean)
      .join("\n\n");

    const jsonSystemInstruction = [
      "You are Learnix AI Assessment Architect.",
      "Generate academically rigorous quiz questions grounded strictly in the teacher's selected uploaded materials and lesson content.",
      "When supplied learning material covers the topic, rely strictly on those facts and do not invent unsupported claims. If no detailed passages cover the teacher's requested academic topic yet, generate accurate educational questions directly on the requested topic.",
      'ALWAYS output ONLY a valid JSON object (never plain-text apologies or prose outside JSON) matching: {"questions": Array<{"prompt": string, "questionType": "single_choice"|"multiple_choice"|"true_false"|"short_answer"|"essay", "difficulty": "easy"|"medium"|"hard", "points": number, "explanation": string, "options": Array<{"optionText": string, "isCorrect": boolean}>}>}.',
      "CRITICAL STUDENT-FACING QUIZ OUTPUT RULES:",
      `- Generate exactly ${requestedCount} question(s).`,
      `- Allowed questionType values: ${allowedTypes.join(", ")}.`,
      `- Default marks per question: ${defaultPointsPerQuestion}.`,
      "- NEVER include course codes, subject codes, course names, subject names, or internal database IDs anywhere in `prompt` or `optionText`.",
      "- NEVER add course titles, subject headers, or introductory descriptions before or between questions.",
      "- Write ONLY the direct question text in `prompt` (do NOT prefix with 'Question 1:', 'Q1.', course names, or file names).",
      "- Write ONLY the clean choice text in `optionText` (do NOT prefix with 'A.', 'B.', '1.', etc.).",
      "- For single_choice: provide 4 clear, distinct options with exactly 1 isCorrect=true.",
      "- For multiple_choice: provide 4 clear, distinct options with 2 or 3 isCorrect=true.",
      '- For true_false: provide 2 options ("True" and "False") with 1 isCorrect=true.',
      "- For short_answer or essay: options must be [] and explanation must describe the expected answer/rubric.",
      `- Match the requested difficulty level (${parsed.data.difficultyMix}) and language of the teacher's instruction or supplied material.`,
      parsed.data.existingQuestionPrompt
        ? `- Do NOT repeat this question being replaced: "${parsed.data.existingQuestionPrompt}". Create a fresh alternative covering the same topic.`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const jsonUserPrompt = [
      `Requested Difficulty: ${parsed.data.difficultyMix}`,
      `Assessment Topic / Instruction: ${parsed.data.prompt}`,
      selectedMaterialsBlock
        ? `\nSelected Uploaded Materials (Primary Grounding Source):\n${selectedMaterialsBlock}`
        : grounded.contextBlock
          ? `\nLearning Material Content:\n${grounded.contextBlock}`
          : cleanMaterialPassages
            ? `\nLearning Material Content:\n${cleanMaterialPassages}`
            : "\nLearning Material Content: Generate questions strictly aligned with the assessment topic above.",
    ].join("\n");

    const aiRes = await callServerAiProvider({
      systemInstruction: jsonSystemInstruction,
      userPrompt: jsonUserPrompt,
      fallbackResponse: JSON.stringify({
        questions: fallbackQuestions,
      }),
      jsonMode: true,
      mediaParts,
    });

    let parsedQuestions = fallbackQuestions;

    try {
      const cleaned = aiRes.text
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      const decoded = JSON.parse(cleaned) as {
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
          .filter(
            (q) => typeof q.prompt === "string" && q.prompt.trim().length > 3,
          )
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

            const cleanPrompt = sanitizeQuizQuestionPrompt(
              q.prompt!,
              forbiddenQuizContext,
            );

            let opts = Array.isArray(q.options)
              ? q.options
                  .map((o) => ({
                    optionText:
                      typeof o.optionText === "string"
                        ? sanitizeQuizOptionText(o.optionText)
                        : "",
                    isCorrect: Boolean(o.isCorrect),
                  }))
                  .filter((o) => o.optionText.length > 0)
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
              prompt: cleanPrompt,
              questionType: qType,
              difficulty: diff,
              points:
                typeof q.points === "number" && q.points > 0
                  ? q.points
                  : defaultPointsPerQuestion,
              explanation: (q.explanation ?? "").trim(),
              options: opts,
            };
          })
          .filter((q) => q.prompt.length > 3);

        if (sanitized.length > 0) {
          parsedQuestions = sanitized;
        }
      }
    } catch {
      // Keep sanitized fallbackQuestions if JSON parsing failed
    }

    // Format visible quiz content strictly as sequential questions and A/B/C/D options ONLY
    // (no course codes, no subject names, no AI introductions, no filler text between questions)
    const cleanQuizContent = formatCleanQuizQuestionsText(
      parsedQuestions,
      forbiddenQuizContext,
    );

    const savedTurn = await persistAiConversationTurn({
      conversationId: parsed.data.conversationId ?? null,
      userId,
      roleContext: "teacher",
      courseId: parsed.data.courseId,
      lessonId: parsed.data.lessonId ?? null,
      mode: parsed.data.mode,
      userMessage: parsed.data.prompt,
      assistantMessage: cleanQuizContent,
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
      responseChars: cleanQuizContent.length,
      status: "success",
    });

    return NextResponse.json({
      ok: true,
      data: {
        conversationId: savedTurn.conversationId,
        messageId: savedTurn.assistantMessageId,
        content: cleanQuizContent,
        citations: grounded.citations,
        draftQuestions: parsedQuestions,
        provider: aiRes.provider,
        requiresTeacherReview: true,
      },
    });
  }

  // Analytical / Pedagogical / Platform-Aware Teacher Assistant Modes
  const platformHelp = getVerifiedPlatformHelpContext();
  const systemInstruction = [
    "You are Learnix AI Teacher Assistant.",
    "Respond in the same language used by the teacher (Arabic -> Arabic, English -> English).",
    "Provide clear, actionable insights grounded in the authorized course materials, live class telemetry, and Learnix platform workflows provided below.",
    "You can analyze individual student performance, identify students with low grades or missing assignments, summarize course averages, highlight difficult topics, draft teaching plans, answer course-related academic/technical questions, and explain Learnix teacher/student features.",
    "Never fabricate student names, grades, or database records not present in the context.",
    buildLearnixScopeAndRedirectionPolicy(),
  ].join("\n");

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
    `\n${platformHelp.contextBlock}`,
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
    userPrompt: `Course: ${grounded.courseTitle}\n${userPrompt.replace(/^Course:[^\n]*\n/, "")}`,
    fallbackResponse,
    mediaParts,
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
  citations: Array<{ sourceTitle: string; excerpt: string }>;
  prompt: string;
  allowedTypes: Array<GeneratedDraftQuestion["questionType"]>;
  pointsPerQuestion: number;
  forbiddenContext: { courseCode?: string | null; courseTitle?: string | null };
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

  const cleanTopic =
    sanitizeQuizQuestionPrompt(params.prompt, params.forbiddenContext)
      .replace(/^generate\s+(?:a\s+)?(?:quiz|questions?|exam)[^:]*[:\-]?\s*/i, "")
      .slice(0, 75)
      .trim() || "the core concept covered in the lesson material";

  const items: GeneratedDraftQuestion[] = [];
  for (let i = 0; i < params.count; i++) {
    const src = params.citations[i % Math.max(1, params.citations.length)];
    const cleanExcerpt = src
      ? sanitizeQuizOptionText(src.excerpt).slice(0, 120).trim()
      : "";
    const diff = difficulties[i % difficulties.length] ?? "medium";
    const qType = types[i % types.length] ?? "single_choice";

    if (qType === "true_false") {
      items.push({
        prompt: cleanExcerpt
          ? `Does the following statement accurately reflect the lesson material: "${cleanExcerpt}"?`
          : `Is the primary principle of ${cleanTopic} applied to improve accuracy and consistency?`,
        questionType: "true_false",
        difficulty: diff,
        points: params.pointsPerQuestion,
        explanation: "Verify against lesson material before publishing.",
        options: [
          { optionText: "True", isCorrect: true },
          { optionText: "False", isCorrect: false },
        ],
      });
    } else if (qType === "short_answer" || qType === "essay") {
      items.push({
        prompt: `Explain the key principles of ${cleanTopic} and provide one practical example.`,
        questionType: qType,
        difficulty: diff,
        points: params.pointsPerQuestion,
        explanation:
          "Rubric: Check conceptual accuracy against the lesson material, clarity, and relevance of the example.",
        options: [],
      });
    } else {
      items.push({
        prompt: `Which statement best describes ${cleanTopic}?`,
        questionType: qType,
        difficulty: diff,
        points: params.pointsPerQuestion,
        explanation: "Grounded in the supplied lesson material.",
        options: [
          {
            optionText:
              cleanExcerpt ||
              `It defines the structured rules and core workflow of ${cleanTopic}.`,
            isCorrect: true,
          },
          {
            optionText:
              qType === "multiple_choice"
                ? `It supports systematic validation and practical implementation of ${cleanTopic}.`
                : "It ignores structured validation and relies on arbitrary assumptions.",
            isCorrect: qType === "multiple_choice",
          },
          {
            optionText:
              "It eliminates the need for structured organization or verification.",
            isCorrect: false,
          },
          {
            optionText:
              "It applies only to unrelated visual styling tasks.",
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
