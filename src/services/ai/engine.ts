import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types";

export interface AiCitation {
  sourceTitle: string;
  sourceType: string;
  excerpt: string;
  lessonId?: string | null;
}

export interface AiRateLimitResult {
  allowed: boolean;
  usedLastMinute: number;
  usedLastDay: number;
  minuteLimit: number;
  dailyLimit: number;
  retryAfterSeconds?: number;
}

const MINUTE_LIMIT = 12;
const DAILY_LIMIT = 150;

/**
 * Checks per-user request throttling & daily quota using public.ai_usage_logs.
 */
export async function checkAiRateLimit(
  userId: string,
): Promise<AiRateLimitResult> {
  const supabase = await createSupabaseServerClient();
  const now = Date.now();
  const oneMinuteAgo = new Date(now - 60 * 1000).toISOString();
  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const [minRes, dayRes] = await Promise.all([
    supabase
      .from("ai_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", oneMinuteAgo),
    supabase
      .from("ai_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", oneDayAgo),
  ]);

  const usedLastMinute = minRes.count ?? 0;
  const usedLastDay = dayRes.count ?? 0;

  if (usedLastMinute >= MINUTE_LIMIT) {
    return {
      allowed: false,
      usedLastMinute,
      usedLastDay,
      minuteLimit: MINUTE_LIMIT,
      dailyLimit: DAILY_LIMIT,
      retryAfterSeconds: 60,
    };
  }

  if (usedLastDay >= DAILY_LIMIT) {
    return {
      allowed: false,
      usedLastMinute,
      usedLastDay,
      minuteLimit: MINUTE_LIMIT,
      dailyLimit: DAILY_LIMIT,
      retryAfterSeconds: 3600,
    };
  }

  return {
    allowed: true,
    usedLastMinute,
    usedLastDay,
    minuteLimit: MINUTE_LIMIT,
    dailyLimit: DAILY_LIMIT,
  };
}

/**
 * Logs AI usage metadata for auditing, quotas, and monitoring.
 */
export async function logAiUsage(params: {
  userId: string;
  roleContext: "student" | "teacher" | "admin";
  feature: string;
  provider: string;
  courseId?: string | null;
  promptChars: number;
  responseChars: number;
  status: "success" | "blocked_exam" | "rate_limited" | "error";
  errorMessage?: string | null;
}) {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.from("ai_usage_logs").insert({
      user_id: params.userId,
      role_context: params.roleContext,
      feature: params.feature,
      provider: params.provider,
      course_id: params.courseId ?? null,
      prompt_chars: params.promptChars,
      response_chars: params.responseChars,
      status: params.status,
      error_message: params.errorMessage ?? null,
    });
  } catch {
    // Non-blocking usage logging
  }
}

/**
 * Enforces AI Exam Restrictions:
 * 1. Checks if the student currently has an active in-progress official exam attempt.
 * 2. Checks if the prompt attempts to solicit official exam answers, answer keys, or bypass proctoring.
 */
export async function checkStudentActiveExamRestriction(params: {
  studentId: string;
  prompt: string;
}): Promise<{ blocked: boolean; reason?: string }> {
  const supabase = await createSupabaseServerClient();
  const nowIso = new Date().toISOString();

  const { data: activeAttempts } = await supabase
    .from("exam_attempts")
    .select("id, exam_id, expires_at")
    .eq("student_id", params.studentId)
    .eq("status", "in_progress")
    .gt("expires_at", nowIso)
    .limit(1);

  if (activeAttempts && activeAttempts.length > 0) {
    return {
      blocked: true,
      reason:
        "AI Study Assistant is temporarily locked while you have an active official examination in progress. Complete and submit your examination to resume AI study support.",
    };
  }

  const lower = params.prompt.toLowerCase();
  const forbiddenPatterns = [
    "bypass proctor",
    "bypass exam",
    "cheat on exam",
    "reveal answer key",
    "official exam answer",
    "solve my exam",
    "disable camera monitoring",
    "تجاوز المراقبة",
    "حل الامتحان الرسمي",
    "تسريب الإجابات",
  ];

  if (forbiddenPatterns.some((p) => lower.includes(p))) {
    return {
      blocked: true,
      reason:
        "Learnix AI cannot solve official examinations, reveal answer keys, or assist in bypassing examination security controls. You may use Learnix AI for practice quizzes, lesson explanations, and study plans.",
    };
  }

  return { blocked: false };
}

/**
 * Splits uploaded PDF/text document content into overlapping retrieval chunks.
 */
export function chunkDocumentText(
  rawText: string,
  maxChunkChars = 900,
): string[] {
  const cleaned = rawText
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();

  if (!cleaned) return [];
  const paragraphs = cleaned.split(/\n{2,}/);
  const chunks: string[] = [];
  let buffer = "";

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    if (buffer.length + trimmed.length + 2 <= maxChunkChars) {
      buffer = buffer ? `${buffer}\n\n${trimmed}` : trimmed;
    } else {
      if (buffer) chunks.push(buffer);
      if (trimmed.length <= maxChunkChars) {
        buffer = trimmed;
      } else {
        for (let i = 0; i < trimmed.length; i += maxChunkChars) {
          chunks.push(trimmed.slice(i, i + maxChunkChars));
        }
        buffer = "";
      }
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks.slice(0, 60);
}

/**
 * Extracts readable text from a PDF or plain-text buffer without external native dependencies.
 */
export function extractReadableTextFromUpload(
  fileName: string,
  buffer: Buffer,
): string {
  const lower = fileName.toLowerCase();
  if (
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    lower.endsWith(".csv")
  ) {
    return buffer.toString("utf8");
  }

  // Extract printable ASCII / UTF-8 text streams from PDF literal strings & content blocks
  const latin = buffer.toString("latin1");
  const extractedParts: string[] = [];
  const parenRegex = /\(([^()\\]{4,300})\)/g;
  let match: RegExpExecArray | null = parenRegex.exec(latin);
  while (match !== null) {
    const candidate = match[1]?.replace(/[^\x20-\x7E\u0600-\u06FF\n]/g, " ").trim();
    if (candidate && /[a-zA-Z\u0600-\u06FF]{3,}/.test(candidate)) {
      extractedParts.push(candidate);
    }
    match = parenRegex.exec(latin);
  }

  if (extractedParts.length > 0) {
    return extractedParts.join(" ");
  }

  // Fallback printable extraction
  return buffer
    .toString("utf8")
    .replace(/[^\x20-\x7E\u0600-\u06FF\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20000);
}

/**
 * Retrieves relevant grounded course passages from lessons & ai_document_chunks.
 * Strictly respects course authorization via the caller's authenticated Supabase client (RLS).
 */
export async function retrieveGroundedCourseContext(params: {
  courseId: string;
  lessonId?: string | null;
  query: string;
}): Promise<{
  courseTitle: string;
  courseCode: string;
  citations: AiCitation[];
  contextBlock: string;
}> {
  const supabase = await createSupabaseServerClient();

  const [courseRes, lessonsRes, chunksRes] = await Promise.all([
    supabase
      .from("courses")
      .select("id, code, title, subtitle, description")
      .eq("id", params.courseId)
      .maybeSingle(),
    params.lessonId
      ? supabase
          .from("lessons")
          .select("id, title, summary, content_markdown, content_type")
          .eq("course_id", params.courseId)
          .eq("id", params.lessonId)
      : supabase
          .from("lessons")
          .select("id, title, summary, content_markdown, content_type")
          .eq("course_id", params.courseId)
          .order("position", { ascending: true })
          .limit(20),
    supabase
      .from("ai_document_chunks")
      .select("id, source_title, source_type, content, lesson_id")
      .eq("course_id", params.courseId)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const course = courseRes.data;
  const lessons = lessonsRes.data ?? [];
  const chunks = chunksRes.data ?? [];

  const queryTerms = params.query
    .toLowerCase()
    .split(/[^a-z0-9\u0600-\u06FF]+/)
    .filter((w) => w.length >= 3);

  interface ScoredPassage {
    score: number;
    citation: AiCitation;
    fullText: string;
  }

  const candidates: ScoredPassage[] = [];

  if (course && (course.subtitle || course.description)) {
    const text = [course.subtitle, course.description].filter(Boolean).join("\n");
    candidates.push({
      score: 1,
      citation: {
        sourceTitle: `${course.code} — ${course.title} (Course Overview)`,
        sourceType: "course",
        excerpt: text.slice(0, 220),
      },
      fullText: text,
    });
  }

  for (const lesson of lessons) {
    const body = [lesson.summary, lesson.content_markdown]
      .filter(Boolean)
      .join("\n")
      .trim();
    if (!body) continue;
    const hay = `${lesson.title} ${body}`.toLowerCase();
    let score = params.lessonId && lesson.id === params.lessonId ? 10 : 2;
    for (const term of queryTerms) {
      if (hay.includes(term)) score += 3;
    }
    candidates.push({
      score,
      citation: {
        sourceTitle: `Lesson: ${lesson.title}`,
        sourceType: lesson.content_type,
        excerpt: body.slice(0, 240),
        lessonId: lesson.id,
      },
      fullText: body.slice(0, 1400),
    });
  }

  for (const ch of chunks) {
    const hay = `${ch.source_title} ${ch.content}`.toLowerCase();
    let score = 2;
    for (const term of queryTerms) {
      if (hay.includes(term)) score += 4;
    }
    candidates.push({
      score,
      citation: {
        sourceTitle: ch.source_title,
        sourceType: ch.source_type,
        excerpt: ch.content.slice(0, 240),
        lessonId: ch.lesson_id,
      },
      fullText: ch.content.slice(0, 1200),
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  const top = candidates.slice(0, 6);

  const citations = top.map((c) => c.citation);
  const contextBlock = top
    .map(
      (c, i) =>
        `[Source ${i + 1}: ${c.citation.sourceTitle} (${c.citation.sourceType})]\n${c.fullText}`,
    )
    .join("\n\n---\n\n");

  return {
    courseTitle: course?.title ?? "Selected Course",
    courseCode: course?.code ?? "COURSE",
    citations,
    contextBlock,
  };
}

/**
 * Calls server-side LLM provider (Gemini or OpenAI) when configured in server env vars.
 * Never exposes keys to the client; falls back cleanly to a grounded deterministic response
 * if no external LLM API key is configured or if the external provider is unreachable.
 */
export async function callServerAiProvider(params: {
  systemInstruction: string;
  userPrompt: string;
  fallbackResponse: string;
  jsonMode?: boolean;
}): Promise<{ text: string; provider: string }> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;

  // 1. Try Google Gemini API (server-side only)
  if (geminiKey) {
    try {
      const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: params.systemInstruction }],
            },
            contents: [{ role: "user", parts: [{ text: params.userPrompt }] }],
            generationConfig: {
              temperature: 0.3,
              ...(params.jsonMode
                ? { responseMimeType: "application/json" }
                : {}),
            },
          }),
          signal: AbortSignal.timeout(25000),
        },
      );

      if (res.ok) {
        const json = (await res.json()) as {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
          }>;
        };
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) {
          return { text, provider: `gemini:${model}` };
        }
      }
    } catch {
      // Fall through to OpenAI or grounded engine
    }
  }

  // 2. Try OpenAI API (server-side only)
  if (openAiKey) {
    try {
      const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.3,
          ...(params.jsonMode
            ? { response_format: { type: "json_object" } }
            : {}),
          messages: [
            { role: "system", content: params.systemInstruction },
            { role: "user", content: params.userPrompt },
          ],
        }),
        signal: AbortSignal.timeout(25000),
      });

      if (res.ok) {
        const json = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const text = json.choices?.[0]?.message?.content?.trim();
        if (text) {
          return { text, provider: `openai:${model}` };
        }
      }
    } catch {
      // Fall through to grounded engine
    }
  }

  // 3. Deterministic Grounded Engine Fallback (zero fabrication, cites only retrieved course materials)
  return {
    text: params.fallbackResponse,
    provider: "learnix-grounded-rag",
  };
}

/**
 * Helper to save a conversation turn (user + assistant messages) to PostgreSQL.
 */
export async function persistAiConversationTurn(params: {
  conversationId?: string | null;
  userId: string;
  roleContext: "student" | "teacher" | "admin";
  courseId?: string | null;
  lessonId?: string | null;
  mode: string;
  userMessage: string;
  assistantMessage: string;
  citations: AiCitation[];
  structuredPayload?: Record<string, unknown> | null;
}): Promise<{ conversationId: string; assistantMessageId: string | null }> {
  const supabase = await createSupabaseServerClient();
  let convId = params.conversationId ?? null;

  if (!convId) {
    const title = params.userMessage.trim().slice(0, 72) || "AI Study Session";
    const { data: conv } = await supabase
      .from("ai_conversations")
      .insert({
        user_id: params.userId,
        role_context: params.roleContext,
        course_id: params.courseId ?? null,
        lesson_id: params.lessonId ?? null,
        mode: params.mode,
        title,
      })
      .select("id")
      .single();
    convId = conv?.id ?? null;
  } else {
    await supabase
      .from("ai_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", convId)
      .eq("user_id", params.userId);
  }

  if (!convId) {
    return { conversationId: "", assistantMessageId: null };
  }

  await supabase.from("ai_messages").insert({
    conversation_id: convId,
    user_id: params.userId,
    sender: "user",
    content: params.userMessage,
    citations: [] as unknown as Json,
  });

  const { data: assistantRow } = await supabase
    .from("ai_messages")
    .insert({
      conversation_id: convId,
      user_id: params.userId,
      sender: "assistant",
      content: params.assistantMessage,
      citations: params.citations as unknown as Json,
      structured_payload: (params.structuredPayload ?? null) as Json,
    })
    .select("id")
    .single();

  return {
    conversationId: convId,
    assistantMessageId: assistantRow?.id ?? null,
  };
}
