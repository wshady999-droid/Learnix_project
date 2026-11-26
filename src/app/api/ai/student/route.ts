import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  checkAiRateLimit,
  checkStudentActiveExamRestriction,
  chunkDocumentText,
  extractReadableTextFromUpload,
  logAiUsage,
  persistAiConversationTurn,
  runGeminiStudentAgentLoop,
  type AiCitation,
  type AiInlineMediaPart,
  type GeminiAgentHistoryTurn,
  type GeminiAgentToolExecutionOutcome,
} from "@/services/ai/engine";
import {
  executeStudentAiTool,
  STUDENT_AI_GEMINI_TOOLS,
} from "@/services/ai/student-tools";
import { requireRole } from "@/services/db/utils";

const studentAiModeSchema = z
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
  .default("chat");

const studentAiJsonSchema = z.object({
  conversationId: z.string().uuid().nullable().optional(),
  courseId: z.string().uuid().nullable().optional(),
  lessonId: z.string().uuid().nullable().optional(),
  mode: studentAiModeSchema,
  prompt: z.string().trim().min(1).max(4000),
});

const MAX_SINGLE_FILE_BYTES = 15 * 1024 * 1024; // 15 MB per file
const MAX_TOTAL_FILES = 5;

const FORBIDDEN_EXTENSIONS = [
  ".exe",
  ".bat",
  ".cmd",
  ".sh",
  ".ps1",
  ".msi",
  ".dll",
  ".scr",
  ".com",
  ".vbs",
  ".jar",
  ".php",
  ".py",
  ".rb",
  ".pl",
  ".cgi",
];

const ALLOWED_DOC_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".pptx",
  ".xlsx",
  ".txt",
  ".md",
  ".csv",
];
const ALLOWED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];
const ALLOWED_AUDIO_EXTENSIONS = [".mp3", ".wav", ".m4a", ".webm", ".ogg"];

const ALLOWED_MIME_PREFIXES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/markdown",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/webm",
  "audio/ogg",
  "video/webm", // Some browsers tag MediaRecorder audio/webm blobs as video/webm
];

export interface AttachmentMetadataSummary {
  fileName: string;
  mimeType: string;
  kind: "document" | "image" | "audio";
  sizeBytes: number;
  extractedChars?: number;
  chunksIndexed?: number;
  isVoiceRecording?: boolean;
}

export function detectPromptLanguage(prompt: string): "ar" | "en" {
  const arabicMatches = prompt.match(/[\u0600-\u06FF]/g);
  const latinMatches = prompt.match(/[a-zA-Z]/g);
  const arabicCount = arabicMatches ? arabicMatches.length : 0;
  const latinCount = latinMatches ? latinMatches.length : 0;

  if (arabicCount > 0 && arabicCount >= latinCount * 0.35) {
    return "ar";
  }
  return "en";
}

function classifyAndValidateFile(file: File): {
  ok: boolean;
  error?: string;
  kind?: "document" | "image" | "audio";
  normalizedMime?: string;
} {
  const rawName = (file.name || "attachment").trim();
  const lowerName = rawName.toLowerCase();
  const rawMime = (file.type || "").toLowerCase().split(";")[0]?.trim() ?? "";

  if (file.size <= 0) {
    return { ok: false, error: `File "${rawName}" is empty.` };
  }
  if (file.size > MAX_SINGLE_FILE_BYTES) {
    return {
      ok: false,
      error: `File "${rawName}" exceeds the 15 MB security limit.`,
    };
  }

  if (FORBIDDEN_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
    return {
      ok: false,
      error: `Executable or script file "${rawName}" is rejected for security.`,
    };
  }

  const isDocExt = ALLOWED_DOC_EXTENSIONS.some((ext) =>
    lowerName.endsWith(ext),
  );
  const isImgExt = ALLOWED_IMAGE_EXTENSIONS.some((ext) =>
    lowerName.endsWith(ext),
  );
  const isAudioExt = ALLOWED_AUDIO_EXTENSIONS.some((ext) =>
    lowerName.endsWith(ext),
  );

  const isAllowedMime =
    !rawMime ||
    ALLOWED_MIME_PREFIXES.some(
      (allowed) => rawMime === allowed || rawMime.startsWith(`${allowed}/`),
    );

  if (!isDocExt && !isImgExt && !isAudioExt) {
    return {
      ok: false,
      error: `Unsupported file format for "${rawName}". Allowed: PDF, DOCX, PPTX, XLSX, TXT, PNG, JPG, JPEG, WEBP, MP3, WAV, M4A, WEBM.`,
    };
  }

  if (!isAllowedMime) {
    return {
      ok: false,
      error: `Unsupported MIME type "${rawMime}" for "${rawName}".`,
    };
  }

  if (isImgExt) {
    const mime = lowerName.endsWith(".png")
      ? "image/png"
      : lowerName.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";
    return { ok: true, kind: "image", normalizedMime: mime };
  }

  if (isAudioExt) {
    const mime = lowerName.endsWith(".mp3")
      ? "audio/mp3"
      : lowerName.endsWith(".wav")
        ? "audio/wav"
        : lowerName.endsWith(".m4a")
          ? "audio/mp4"
          : lowerName.endsWith(".ogg")
            ? "audio/ogg"
            : "audio/webm";
    return { ok: true, kind: "audio", normalizedMime: mime };
  }

  const docMime = lowerName.endsWith(".pdf")
    ? "application/pdf"
    : lowerName.endsWith(".docx")
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : lowerName.endsWith(".pptx")
        ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        : lowerName.endsWith(".xlsx")
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "text/plain";

  return { ok: true, kind: "document", normalizedMime: docMime };
}

/**
 * Builds the system instruction for the Unified Gemini Agent.
 * Gemini dynamically understands natural-language student questions in any phrasing or dialect
 * and invokes the appropriate server-validated database and RAG tools via Function Calling.
 */
export function buildUnifiedGeminiAgentSystemInstruction(params: {
  studentDisplayName: string;
  selectedCourseLabel: string | null;
  mode: string;
}): string {
  return [
    "You are Learnix AI Study Assistant, a unified, strictly grounded academic tutor and platform-aware assistant for the authenticated student.",
    `Authenticated Student Name: ${params.studentDisplayName}.`,
    params.selectedCourseLabel
      ? `Active UI Selected Course Context: ${params.selectedCourseLabel}.`
      : "Active UI Selected Course Context: General AI Assistant (No specific course pre-selected).",
    `Requested Study Mode: ${params.mode}.`,
    "AUTOMATIC LANGUAGE RULE: Detect the language used in the student's latest text or voice message and respond in that EXACT same language (Arabic -> Arabic, English -> English, mixed -> primary language of the question).",
    "AGENTIC TOOL-CALLING POLICY: Understand the student's natural-language intent regardless of phrasing or dialect (including formal Arabic, Egyptian/regional colloquial Arabic, or English) and dynamically call the appropriate tools:",
    "1. COURSE CATALOG DISCOVERY & COMPARISONS: Call `search_published_courses`, `get_published_course_details`, `compare_published_courses`, or `get_available_course_categories` when the student asks what courses exist on Learnix, asks about courses in a subject/category, or compares courses. Public catalog discovery works for all published courses even when the student is not enrolled.",
    "2. COURSE DURATION & STRUCTURED METADATA: Call `get_course_duration` or `get_course_metadata` when the student asks how many hours/minutes a course takes or what its metadata is. Report ONLY the verified duration from the tool (`courses.estimated_hours` when > 0, or the complete sum of published `lessons.duration_seconds`). If the tool reports incomplete lesson duration data, explicitly state that lesson duration data is incomplete and NEVER report a partial sum as the total course duration.",
    "3. ENROLLED COURSE EDUCATIONAL CONTENT (RAG): Call `search_enrolled_course_content` whenever the student asks for educational explanations, lecture summaries, concept explanations, flashcards, or practice questions from their course materials. CRITICAL GROUNDING POLICY: You are STRICTLY PROHIBITED from answering academic or course-topic questions using general pretrained knowledge when authorized course sources are required. If `search_enrolled_course_content` returns `accessDeniedNotEnrolled: true`, explain that the student must enroll in that course via 'Explore Courses' (`/student/courses`) to access its internal lessons. If `hasRelevantMatches` is false and no uploaded document covers the topic, clearly state that the authorized course materials do not contain sufficient information on that topic.",
    "4. PERSONAL GRADES, PROGRESS, ASSIGNMENTS, EXAMS & ATTENDANCE: Call `get_my_enrolled_courses`, `get_my_enrollment_details`, `get_my_assignments`, `get_assignment_details`, `get_assignment_submission_status`, `get_my_exams`, `get_exam_details`, `get_my_exam_results`, `get_my_grades`, `get_my_academic_progress`, `get_my_attendance`, or `get_my_academic_report` when the student asks about their personal records. All personal tools are strictly scoped to the authenticated student. If the student asks for another student's private grades, attendance, or records, refuse and explain that student data is strictly isolated.",
    "5. PLATFORM HELP & NAVIGATION: Call `get_platform_help_and_navigation` when the student asks how Learnix works, how to enroll, how to upload documents/images/audio, how to use live voice recording, or where to find pages in the student dashboard. If a feature is not supported in Learnix, state clearly that it is not available.",
    "6. COMBINING MULTIPLE TOOLS: When a student asks a multi-part or mixed question (for example, asking for their grades AND explaining a lecture, or asking if a mobile course exists AND how many hours it takes), call all required tools and synthesize their verified results into one coherent response.",
    "7. MULTIPLE MATCHING COURSES DISAMBIGUATION: When a tool returns multiple matching courses for a broad topic, list the matching courses with their verified details and ask the student which one they want to focus on rather than guessing randomly.",
    "8. FOLLOW-UP CONTINUITY: Use the conversation history to resolve pronouns or references (such as 'it', 'the second one', 'how long does it take?', 'كم مدتها؟'), and call the relevant tool to fetch current verified database data.",
    "9. MULTIMODAL ATTACHMENTS: When the student attaches documents, images, audio files, or a live voice recording in the current turn, analyze the provided extracted text or inline media directly.",
    "Never solve active official exams or reveal official exam answer keys.",
  ].join("\n");
}

/**
 * Builds a safe, strictly grounded response when the external Gemini API returns HTTP 503 or is temporarily unreachable.
 * Uses only verified tool outputs or current-turn uploaded document excerpts—never fabricates ungrounded academic answers.
 */
export function buildSafeAgentProviderFailureResponse(params: {
  detectedLang: "ar" | "en";
  toolOutcomes: GeminiAgentToolExecutionOutcome[];
  documentCitations: AiCitation[];
  attachmentSummaries: AttachmentMetadataSummary[];
  errorCode?: string;
  errorStatus?: number;
}): string {
  const code = (params.errorCode ?? "PROVIDER_UNAVAILABLE").toUpperCase();
  const statusTag = [
    code,
    params.errorStatus ? `HTTP ${params.errorStatus}` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  if (params.toolOutcomes.length > 0) {
    const summaries = params.toolOutcomes
      .map((o) =>
        params.detectedLang === "ar" ? o.summaryTextAr : o.summaryTextEn,
      )
      .filter(Boolean)
      .join("\n\n---\n\n");

    if (summaries) {
      return summaries;
    }
  }

  if (params.documentCitations.length > 0) {
    const docList = params.documentCitations
      .map(
        (c, idx) =>
          `${idx + 1}. **${c.sourceTitle}** (${c.sourceType}): "${c.excerpt.trim()}..."`,
      )
      .join("\n");

    if (params.detectedLang === "ar") {
      return [
        `### تحليل المستندات المرفقة (${statusTag})`,
        `تعذر الاتصال بمحرك Gemini في الوقت الحالي، ولكن تم استخراج المحتوى النصي الموثق من ملفاتك المرفقة بنجاح:`,
        docList,
      ].join("\n\n");
    }

    return [
      `### Uploaded Document Excerpts (${statusTag})`,
      `The Gemini AI service is temporarily unavailable, but here is the verified content extracted from your uploaded document(s):`,
      docList,
    ].join("\n\n");
  }

  const isTimeout = code.includes("TIMEOUT") || code.includes("ABORT");
  const isAuthOrConfig =
    code.includes("KEY_NOT_CONFIGURED") ||
    code.includes("AUTH_CONFIG") ||
    params.errorStatus === 401 ||
    params.errorStatus === 403;
  const isInvalidRequest =
    code.includes("INVALID_REQUEST") ||
    params.errorStatus === 400 ||
    params.errorStatus === 404;

  if (params.detectedLang === "ar") {
    if (isTimeout) {
      return `### انتهت مهلة الاتصال بمحرك الذكاء الاصطناعي (${statusTag})\n\nاستغرق الطلب وقتاً أطول من المهلة المحددة للاتصال بخدمة Gemini. التزاماً بسياسة الموثوقية الأكاديمية في Learnix، لن يتم توليد إجابة غير موثقة. يرجى المحاولة مرة أخرى بعد قليل.`;
    }
    if (isAuthOrConfig) {
      return `### خطأ في إعدادات الاتصال بمحرك الذكاء الاصطناعي (${statusTag})\n\nخدمة الذكاء الاصطناعي بحاجة إلى التحقق من إعدادات مفتاح الخادم. التزاماً بسياسة الموثوقية الأكاديمية، لن يتم توليد إجابة افتراضية غير موثقة.`;
    }
    if (isInvalidRequest) {
      return `### تعذر معالجة الطلب عبر نموذج الذكاء الاصطناعي (${statusTag})\n\nلم يتمكن النموذج المحدد من معالجة هذا الطلب حالياً. التزاماً بسياسة الموثوقية الأكاديمية في Learnix، لن يتم توليد إجابة غير موثقة.`;
    }
    return `### تعذر إكمال الطلب عبر محرك الذكاء الاصطناعي (${statusTag})\n\nعذراً، خدمة الذكاء الاصطناعي (Gemini) تواجه ضغطاً مؤقتاً أو غير متاحة حالياً لمعالجة هذا الطلب. التزاماً بسياسة الموثوقية الأكاديمية في Learnix، لن يتم توليد إجابة افتراضية غير موثقة. يرجى المحاولة مرة أخرى بعد قليل.`;
  }

  if (isTimeout) {
    return `### AI Request Timed Out (${statusTag})\n\nThe request to the Gemini AI service timed out before a response was received. Under Learnix's strict academic grounding policy, an ungrounded fallback answer will not be generated. Please try again shortly.`;
  }
  if (isAuthOrConfig) {
    return `### AI Provider Configuration Error (${statusTag})\n\nThe server could not authenticate with the Gemini AI provider. Under Learnix's strict academic grounding policy, an ungrounded fallback answer will not be generated.`;
  }
  if (isInvalidRequest) {
    return `### AI Model Request Error (${statusTag})\n\nThe configured Gemini model could not process this request format. Under Learnix's strict academic grounding policy, an ungrounded fallback answer will not be generated.`;
  }

  return `### AI Service Temporarily Unavailable (${statusTag})\n\nThe Gemini AI service is temporarily unavailable or experiencing high demand right now. Under Learnix's strict academic grounding policy, an ungrounded fallback answer will not be generated. Please try your request again shortly.`;
}

export async function POST(request: Request) {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") || "";
  let conversationId: string | null = null;
  let selectedCourseId: string | null = null;
  let mode: z.infer<typeof studentAiModeSchema> = "chat";
  let promptText = "";
  let clientSpeechTranscript = "";
  const uploadedFiles: File[] = [];

  if (contentType.includes("multipart/form-data")) {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid multipart/form-data payload." },
        { status: 400 },
      );
    }

    const rawConvId = String(formData.get("conversationId") ?? "").trim();
    conversationId =
      rawConvId && rawConvId !== "null" && rawConvId !== "undefined"
        ? rawConvId
        : null;

    const rawCourseId = String(formData.get("courseId") ?? "").trim();
    selectedCourseId =
      rawCourseId && rawCourseId !== "null" && rawCourseId !== "undefined"
        ? rawCourseId
        : null;

    const rawMode = String(formData.get("mode") ?? "chat").trim();
    const parsedMode = studentAiModeSchema.safeParse(rawMode);
    if (parsedMode.success) mode = parsedMode.data;

    promptText = String(formData.get("prompt") ?? "").trim();
    clientSpeechTranscript = String(
      formData.get("speechTranscript") ?? "",
    ).trim();

    const filesEntries = formData.getAll("files");
    for (const entry of filesEntries) {
      if (entry instanceof File && entry.size > 0) {
        uploadedFiles.push(entry);
      }
    }
  } else {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON payload." },
        { status: 400 },
      );
    }

    const parsed = studentAiJsonSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: parsed.error.issues[0]?.message ?? "Invalid AI request.",
        },
        { status: 400 },
      );
    }
    conversationId = parsed.data.conversationId ?? null;
    selectedCourseId = parsed.data.courseId ?? null;
    mode = parsed.data.mode;
    promptText = parsed.data.prompt;
  }

  if (uploadedFiles.length > MAX_TOTAL_FILES) {
    return NextResponse.json(
      {
        ok: false,
        error: `You can attach up to ${MAX_TOTAL_FILES} files per message.`,
      },
      { status: 400 },
    );
  }

  if (!promptText && !clientSpeechTranscript && uploadedFiles.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "Please enter a message, record voice, or attach a file.",
      },
      { status: 400 },
    );
  }

  const userId = auth.data.userId;
  const studentDisplayName =
    auth.data.fullName || auth.data.email || "Student";
  const supabase = await createSupabaseServerClient();

  // 1. Verify course enrollment & publication status if a course is selected, and enforce Active Official Exam Restrictions
  let selectedCourseLabel: string | null = null;
  if (selectedCourseId) {
    if (auth.data.role === "student") {
      const { data: enrollment } = await supabase
        .from("course_enrollments")
        .select("id")
        .eq("course_id", selectedCourseId)
        .eq("student_id", userId)
        .maybeSingle();

      if (!enrollment) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Course access denied. You can only select courses in which you are enrolled.",
          },
          { status: 403 },
        );
      }
    }

    const { data: courseRow } = await supabase
      .from("courses")
      .select("code, title, status")
      .eq("id", selectedCourseId)
      .maybeSingle();

    if (!courseRow || courseRow.status !== "published") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Course access denied. The selected course is not currently published.",
        },
        { status: 403 },
      );
    }
    selectedCourseLabel = `${courseRow.code} — ${courseRow.title} (courseId: ${selectedCourseId})`;
  }

  // 1b. If conversationId is provided, verify that the conversation belongs to the authenticated userId
  if (conversationId) {
    const { data: ownedConv } = await supabase
      .from("ai_conversations")
      .select("id, user_id")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!ownedConv) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Conversation access denied. You can only access your own AI conversations.",
        },
        { status: 403 },
      );
    }
  }

  if (auth.data.role === "student") {
    const examGuard = await checkStudentActiveExamRestriction({
      studentId: userId,
      prompt: `${promptText} ${clientSpeechTranscript}`.trim(),
    });

    if (examGuard.blocked) {
      await logAiUsage({
        userId,
        roleContext: "student",
        feature: `student:${mode}`,
        provider: "exam-guard",
        courseId: selectedCourseId,
        promptChars: promptText.length,
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

  // 2. Enforce Rate Limiting & Daily Quotas
  const rateLimit = await checkAiRateLimit(userId);
  if (!rateLimit.allowed) {
    await logAiUsage({
      userId,
      roleContext: "student",
      feature: `student:${mode}`,
      provider: "rate-limiter",
      courseId: selectedCourseId,
      promptChars: promptText.length,
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

  // 3. Validate & Process Uploaded Files (Documents, Images, Audio, Live Voice Recordings)
  const attachmentSummaries: AttachmentMetadataSummary[] = [];
  const inlineMediaParts: AiInlineMediaPart[] = [];
  const extractedDocumentBlocks: string[] = [];
  const documentCitations: AiCitation[] = [];
  const conversationScopedDocuments: Array<{
    fileName: string;
    extractedText: string;
  }> = [];

  for (const file of uploadedFiles) {
    const validation = classifyAndValidateFile(file);
    if (!validation.ok || !validation.kind || !validation.normalizedMime) {
      return NextResponse.json(
        { ok: false, error: validation.error ?? "Invalid file attachment." },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const isVoiceRec = file.name.startsWith("voice-message-");

    if (validation.kind === "document") {
      const extractedText = extractReadableTextFromUpload(file.name, buffer);
      const chunks = chunkDocumentText(extractedText);

      let chunksIndexed = 0;
      if (selectedCourseId && chunks.length > 0) {
        const rows = chunks.map((content, idx) => ({
          course_id: selectedCourseId,
          lesson_id: null,
          uploaded_by: userId,
          source_title: file.name,
          source_type: file.name.toLowerCase().endsWith(".pdf")
            ? "pdf"
            : "resource",
          chunk_index: idx,
          content,
        }));
        const { error: insertErr } = await supabase
          .from("ai_document_chunks")
          .insert(rows);
        if (!insertErr) {
          chunksIndexed = rows.length;
        }
      }

      if (extractedText.length > 0) {
        extractedDocumentBlocks.push(
          `[Uploaded Document: ${file.name}]\n${extractedText.slice(0, 12000)}`,
        );
        conversationScopedDocuments.push({
          fileName: file.name,
          extractedText: extractedText.slice(0, 6000),
        });
        documentCitations.push({
          sourceTitle: `Uploaded Document: ${file.name}`,
          sourceType: "document",
          excerpt: extractedText.slice(0, 260),
        });
      } else if (validation.normalizedMime === "application/pdf") {
        inlineMediaParts.push({
          fileName: file.name,
          mimeType: "application/pdf",
          base64Data: buffer.toString("base64"),
          kind: "document",
        });
      }

      attachmentSummaries.push({
        fileName: file.name,
        mimeType: validation.normalizedMime,
        kind: "document",
        sizeBytes: file.size,
        extractedChars: extractedText.length,
        chunksIndexed,
      });
    } else if (validation.kind === "image") {
      inlineMediaParts.push({
        fileName: file.name,
        mimeType: validation.normalizedMime,
        base64Data: buffer.toString("base64"),
        kind: "image",
      });
      attachmentSummaries.push({
        fileName: file.name,
        mimeType: validation.normalizedMime,
        kind: "image",
        sizeBytes: file.size,
      });
    } else if (validation.kind === "audio") {
      inlineMediaParts.push({
        fileName: file.name,
        mimeType: validation.normalizedMime,
        base64Data: buffer.toString("base64"),
        kind: "audio",
      });
      attachmentSummaries.push({
        fileName: file.name,
        mimeType: validation.normalizedMime,
        kind: "audio",
        sizeBytes: file.size,
        isVoiceRecording: isVoiceRec,
      });
    }
  }

  // 4. Fetch recent conversation history (up to last 8 messages) for natural follow-up questions
  // Also recover any conversation-scoped uploaded document excerpts from `ai_messages.structured_payload`
  // so follow-up questions work seamlessly even when `selectedCourseId = null` (strictly isolated by `conversation_id` and `user_id`).
  const conversationHistory: GeminiAgentHistoryTurn[] = [];
  const priorConversationDocumentBlocks: string[] = [];
  if (conversationId) {
    const { data: recentMsgs } = await supabase
      .from("ai_messages")
      .select("sender, content, structured_payload, created_at")
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(8);

    if (recentMsgs && recentMsgs.length > 0) {
      for (const m of [...recentMsgs].reverse()) {
        conversationHistory.push({
          sender: m.sender === "user" ? "user" : "assistant",
          content: m.content,
        });

        if (
          m.sender === "user" &&
          m.structured_payload &&
          typeof m.structured_payload === "object" &&
          !Array.isArray(m.structured_payload)
        ) {
          const payload = m.structured_payload as Record<string, unknown>;
          if (Array.isArray(payload.conversationDocuments)) {
            for (const doc of payload.conversationDocuments) {
              if (
                doc &&
                typeof doc === "object" &&
                typeof (doc as { fileName?: unknown }).fileName === "string" &&
                typeof (doc as { extractedText?: unknown }).extractedText ===
                  "string"
              ) {
                const d = doc as { fileName: string; extractedText: string };
                if (d.extractedText.trim().length > 0) {
                  priorConversationDocumentBlocks.push(
                    `[Previously Uploaded Document in This Conversation: ${d.fileName}]\n${d.extractedText.slice(0, 6000)}`,
                  );
                }
              }
            }
          }
        }
      }
    }
  }

  const effectiveUserQuestion =
    promptText ||
    clientSpeechTranscript ||
    (attachmentSummaries.some((a) => a.isVoiceRecording)
      ? "🎤 Voice Message"
      : attachmentSummaries.length > 0
        ? `Analyze attached file(s): ${attachmentSummaries.map((a) => a.fileName).join(", ")}`
        : "Hello");

  const languageProbeText = [
    promptText,
    clientSpeechTranscript,
    extractedDocumentBlocks.join(" ").slice(0, 400),
  ]
    .filter(Boolean)
    .join(" ");
  const detectedLang = detectPromptLanguage(languageProbeText);

  const displayUserMessage =
    promptText ||
    (clientSpeechTranscript
      ? `🎤 ${clientSpeechTranscript}`
      : attachmentSummaries.some((a) => a.isVoiceRecording)
        ? "🎤 Voice Message"
        : `Attached: ${attachmentSummaries.map((a) => a.fileName).join(", ")}`);

  // 5. Assemble current turn prompt for the Unified Gemini Agent
  const systemInstruction = buildUnifiedGeminiAgentSystemInstruction({
    studentDisplayName,
    selectedCourseLabel,
    mode,
  });

  const userPromptParts: string[] = [
    `Student Message: ${effectiveUserQuestion}`,
  ];

  if (selectedCourseLabel) {
    userPromptParts.push(`Selected Enrolled Course Context: ${selectedCourseLabel}`);
  }

  if (clientSpeechTranscript) {
    userPromptParts.push(
      `Live Voice Transcription Captured from Microphone: "${clientSpeechTranscript}"`,
    );
  }

  if (attachmentSummaries.length > 0) {
    userPromptParts.push(
      `Attached Files in Current Request (${attachmentSummaries.length}): ${attachmentSummaries
        .map(
          (a) =>
            `${a.fileName} (${a.kind}, ${Math.round(a.sizeBytes / 1024)} KB)`,
        )
        .join(", ")}`,
    );
  }

  if (extractedDocumentBlocks.length > 0) {
    userPromptParts.push(
      `\nExtracted Content from Current-Request Uploaded Documents:\n${extractedDocumentBlocks.join("\n\n---\n\n")}`,
    );
  } else if (priorConversationDocumentBlocks.length > 0) {
    userPromptParts.push(
      `\nExtracted Content from Previously Uploaded Documents in This Conversation:\n${priorConversationDocumentBlocks.slice(-2).join("\n\n---\n\n")}`,
    );
  }

  // 6. Execute Unified Gemini Agent Loop with Secure Server-Side Database & RAG Tools
  const agentResult = await runGeminiStudentAgentLoop({
    systemInstruction,
    conversationHistory,
    userPrompt: userPromptParts.join("\n"),
    mediaParts: inlineMediaParts,
    tools: STUDENT_AI_GEMINI_TOOLS,
    executeTool: async (toolName, rawArgs) =>
      executeStudentAiTool({
        toolName,
        rawArgs,
        context: {
          authenticatedStudentId: userId,
          studentDisplayName,
          selectedCourseId,
        },
      }),
    maxIterations: 4,
  });

  const combinedCitations: AiCitation[] = [...documentCitations];
  for (const cit of agentResult.citations) {
    if (
      !combinedCitations.some(
        (c) => c.sourceTitle === cit.sourceTitle && c.excerpt === cit.excerpt,
      )
    ) {
      combinedCitations.push(cit);
    }
  }

  // 7. Safe Provider Failure Handling (e.g., Gemini HTTP 503)
  let finalAssistantText = agentResult.text;
  let finalStatus: "success" | "error" = "success";
  let sanitizedErrorLog: string | null = null;

  if (agentResult.providerFailed || !finalAssistantText) {
    finalStatus = "error";
    sanitizedErrorLog = [
      agentResult.errorCode ?? "PROVIDER_ERROR",
      agentResult.errorStatus ? `HTTP_${agentResult.errorStatus}` : null,
    ]
      .filter(Boolean)
      .join(":");

    finalAssistantText = buildSafeAgentProviderFailureResponse({
      detectedLang,
      toolOutcomes: agentResult.toolOutcomes,
      documentCitations,
      attachmentSummaries,
      errorCode: agentResult.errorCode,
      errorStatus: agentResult.errorStatus,
    });
  }

  // 8. Persist Conversation Turn (including executed tool audit trail and attachment metadata)
  const savedTurn = await persistAiConversationTurn({
    conversationId,
    userId,
    roleContext: "student",
    courseId: selectedCourseId,
    lessonId: null,
    mode,
    userMessage: displayUserMessage,
    assistantMessage: finalAssistantText,
    citations: combinedCitations,
    userStructuredPayload:
      attachmentSummaries.length > 0
        ? {
            attachments: attachmentSummaries,
            speechTranscript: clientSpeechTranscript || null,
            ...(conversationScopedDocuments.length > 0
              ? { conversationDocuments: conversationScopedDocuments }
              : {}),
          }
        : null,
    structuredPayload: {
      ...(attachmentSummaries.length > 0
        ? { processedAttachments: attachmentSummaries }
        : {}),
      ...(agentResult.calledTools.length > 0
        ? { calledTools: agentResult.calledTools }
        : {}),
      provider: agentResult.provider,
      ...(sanitizedErrorLog ? { errorCode: sanitizedErrorLog } : {}),
    },
  });

  await logAiUsage({
    userId,
    roleContext: "student",
    feature: `student:${mode}`,
    provider: agentResult.provider,
    courseId: selectedCourseId,
    promptChars: displayUserMessage.length,
    responseChars: finalAssistantText.length,
    status: finalStatus,
    errorMessage: sanitizedErrorLog,
  });

  return NextResponse.json({
    ok: true,
    data: {
      conversationId: savedTurn.conversationId,
      messageId: savedTurn.assistantMessageId,
      userMessage: displayUserMessage,
      content: finalAssistantText,
      citations: combinedCitations,
      attachments: attachmentSummaries,
      calledTools: agentResult.calledTools,
      provider: agentResult.provider,
      usage: {
        usedLastMinute: rateLimit.usedLastMinute + 1,
        minuteLimit: rateLimit.minuteLimit,
        usedLastDay: rateLimit.usedLastDay + 1,
        dailyLimit: rateLimit.dailyLimit,
      },
    },
  });
}
