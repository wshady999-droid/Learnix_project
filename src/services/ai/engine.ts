import "server-only";

import zlib from "node:zlib";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types";

export interface AiInlineMediaPart {
  fileName: string;
  mimeType: string;
  base64Data: string;
  kind: "image" | "audio" | "document";
}

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
 * Decodes common XML entities after stripping tags from Office Open XML entries.
 */
function decodeXmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
}

/**
 * Extracts XML text entries from a ZIP archive buffer (DOCX, PPTX, XLSX) using Node's built-in `zlib.inflateRawSync`.
 * Requires zero external packages.
 */
function extractTextFromOfficeZip(
  buffer: Buffer,
  kind: "docx" | "pptx" | "xlsx",
): string {
  const entries: Array<{ name: string; content: string }> = [];
  let offset = 0;

  // Find End of Central Directory (EOCD) signature 0x06054b50 from the end of the buffer
  let eocdOffset = -1;
  const minEocdSearch = Math.max(0, buffer.length - 65557);
  for (let i = buffer.length - 22; i >= minEocdSearch; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset !== -1) {
    const cdEntriesCount = buffer.readUInt16LE(eocdOffset + 10);
    const cdOffset = buffer.readUInt32LE(eocdOffset + 16);
    let ptr = cdOffset;

    for (let idx = 0; idx < cdEntriesCount && ptr + 46 <= buffer.length; idx++) {
      const sig = buffer.readUInt32LE(ptr);
      if (sig !== 0x02014b50) break;

      const compressionMethod = buffer.readUInt16LE(ptr + 10);
      const compressedSize = buffer.readUInt32LE(ptr + 20);
      const fileNameLen = buffer.readUInt16LE(ptr + 28);
      const extraLen = buffer.readUInt16LE(ptr + 30);
      const commentLen = buffer.readUInt16LE(ptr + 32);
      const localHeaderOffset = buffer.readUInt32LE(ptr + 42);

      const entryName = buffer
        .subarray(ptr + 46, ptr + 46 + fileNameLen)
        .toString("utf8");

      ptr += 46 + fileNameLen + extraLen + commentLen;

      const isTargetXml =
        (kind === "docx" &&
          (entryName === "word/document.xml" ||
            entryName.startsWith("word/header") ||
            entryName.startsWith("word/footer"))) ||
        (kind === "pptx" &&
          (entryName.startsWith("ppt/slides/slide") ||
            entryName.startsWith("ppt/notesSlides/notesSlide")) &&
          entryName.endsWith(".xml")) ||
        (kind === "xlsx" &&
          (entryName === "xl/sharedStrings.xml" ||
            (entryName.startsWith("xl/worksheets/sheet") &&
              entryName.endsWith(".xml"))));

      if (!isTargetXml) continue;
      if (localHeaderOffset + 30 > buffer.length) continue;
      if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) continue;

      const localNameLen = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLen = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const dataEnd = dataStart + compressedSize;
      if (dataEnd > buffer.length) continue;

      const slice = buffer.subarray(dataStart, dataEnd);
      try {
        let xmlString = "";
        if (compressionMethod === 0) {
          xmlString = slice.toString("utf8");
        } else if (compressionMethod === 8) {
          xmlString = zlib.inflateRawSync(slice).toString("utf8");
        }
        if (xmlString) {
          entries.push({ name: entryName, content: xmlString });
        }
      } catch {
        // Skip corrupt entry
      }
    }
  } else {
    // Fallback sequential Local File Header scan if EOCD isn't standard
    while (offset + 30 <= buffer.length) {
      const sig = buffer.readUInt32LE(offset);
      if (sig !== 0x04034b50) break;
      const flags = buffer.readUInt16LE(offset + 6);
      const compressionMethod = buffer.readUInt16LE(offset + 8);
      const compressedSize = buffer.readUInt32LE(offset + 18);
      const fileNameLen = buffer.readUInt16LE(offset + 26);
      const extraLen = buffer.readUInt16LE(offset + 28);
      const entryName = buffer
        .subarray(offset + 30, offset + 30 + fileNameLen)
        .toString("utf8");
      const dataStart = offset + 30 + fileNameLen + extraLen;
      if ((flags & 0x08) !== 0 || compressedSize === 0) break;
      const dataEnd = dataStart + compressedSize;
      if (dataEnd > buffer.length) break;

      const isTargetXml =
        entryName.endsWith(".xml") &&
        (entryName.startsWith("word/") ||
          entryName.startsWith("ppt/slides/") ||
          entryName.startsWith("xl/"));

      if (isTargetXml) {
        try {
          const slice = buffer.subarray(dataStart, dataEnd);
          const xmlString =
            compressionMethod === 0
              ? slice.toString("utf8")
              : compressionMethod === 8
                ? zlib.inflateRawSync(slice).toString("utf8")
                : "";
          if (xmlString) entries.push({ name: entryName, content: xmlString });
        } catch {
          // Ignore
        }
      }
      offset = dataEnd;
    }
  }

  if (entries.length === 0) return "";

  entries.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true }),
  );

  const extractedSections: string[] = [];
  for (const entry of entries) {
    const withLineBreaks = entry.content
      .replace(/<\/w:p>/g, "\n")
      .replace(/<\/a:p>/g, "\n")
      .replace(/<\/si>/g, "\n")
      .replace(/<\/row>/g, "\n")
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<w:br[^/>]*\/>/g, "\n");

    const stripped = decodeXmlEntities(
      withLineBreaks.replace(/<[^>]+>/g, " "),
    )
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n+/g, "\n")
      .trim();

    if (stripped) {
      if (kind === "pptx" && entry.name.includes("slide")) {
        const slideMatch = entry.name.match(/slide(\d+)\.xml/);
        const label = slideMatch ? `[Slide ${slideMatch[1]}]` : `[Slide]`;
        extractedSections.push(`${label}\n${stripped}`);
      } else {
        extractedSections.push(stripped);
      }
    }
  }

  return extractedSections.join("\n\n").trim();
}

/**
 * Extracts readable text from a PDF, DOCX, PPTX, XLSX, or plain-text buffer without external native dependencies.
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
    return buffer.toString("utf8").trim();
  }

  if (lower.endsWith(".docx")) {
    return extractTextFromOfficeZip(buffer, "docx");
  }

  if (lower.endsWith(".pptx")) {
    return extractTextFromOfficeZip(buffer, "pptx");
  }

  if (lower.endsWith(".xlsx")) {
    return extractTextFromOfficeZip(buffer, "xlsx");
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

  // Fallback printable extraction for text-based PDFs
  return buffer
    .toString("utf8")
    .replace(/[^\x20-\x7E\u0600-\u06FF\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20000);
}

export interface VerifiedCourseDurationInfo {
  courseId: string;
  courseCode: string;
  courseTitle: string;
  courseCategory: string;
  source:
    | "course_estimated_hours"
    | "summed_lessons"
    | "incomplete_lesson_durations"
    | "unavailable";
  recordedEstimatedHours: number | null;
  totalPublishedLessons: number;
  lessonsWithValidDuration: number;
  missingDurationLessons: number;
  summedLessonSeconds: number;
  summedLessonHours: number | null;
  summedLessonMinutes: number | null;
  explanationEn: string;
  explanationAr: string;
}

export interface MatchedEnrolledCourseSummary {
  courseId: string;
  courseCode: string;
  courseTitle: string;
  courseCategory: string;
  matchScore: number;
  matchReasons: string[];
  durationInfo: VerifiedCourseDurationInfo;
}

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "what",
  "how",
  "why",
  "when",
  "where",
  "who",
  "which",
  "can",
  "you",
  "explain",
  "tell",
  "me",
  "my",
  "about",
  "please",
  "help",
  "create",
  "make",
  "generate",
  "summarize",
  "summary",
  "course",
  "courses",
  "lesson",
  "lessons",
  "study",
  "many",
  "much",
  "hours",
  "hour",
  "time",
  "duration",
  "long",
  "take",
  "takes",
  "does",
  "اشرح",
  "اشرحلي",
  "يعني",
  "ايه",
  "ما",
  "هو",
  "هي",
  "كيف",
  "كم",
  "عدد",
  "لماذا",
  "في",
  "من",
  "عن",
  "على",
  "الى",
  "إلى",
  "هذا",
  "هذه",
  "هل",
  "ممكن",
  "اريد",
  "أريد",
  "ملخص",
  "لخص",
  "دورة",
  "كورس",
  "ساعة",
  "ساعات",
  "مدة",
  "وقت",
  "ياخذ",
  "يأخذ",
  "تأخذ",
  "تاخذ",
  "تستغرق",
  "يستغرق",
]);

/**
 * Bilingual semantic concept clusters mapping user expressions (English & Arabic)
 * to domain keywords, categories, frameworks, and related concepts.
 */
const SEMANTIC_CONCEPT_CLUSTERS: ReadonlyArray<{
  conceptId: string;
  triggers: readonly string[];
  expansions: readonly string[];
}> = [
  {
    conceptId: "mobile_development",
    triggers: [
      "mobile",
      "mobile app",
      "mobile apps",
      "mobile application",
      "mobile applications",
      "mobile development",
      "android",
      "ios",
      "flutter",
      "react native",
      "kotlin",
      "swift",
      "cross-platform",
      "cross platform",
      "smartphone",
      "موبايل",
      "الموبايل",
      "هاتف",
      "الهواتف",
      "جوال",
      "الجوال",
      "تطبيقات الموبايل",
      "تطبيقات الهاتف",
      "تطبيقات الجوال",
      "تطوير التطبيقات",
      "برمجة التطبيقات",
      "اندرويد",
      "أندرويد",
      "ايفون",
      "آيفون",
      "فلاتر",
    ],
    expansions: [
      "mobile",
      "mobile app",
      "application",
      "android",
      "ios",
      "flutter",
      "react native",
      "kotlin",
      "swift",
      "cross-platform",
      "dart",
      "موبايل",
      "تطبيقات",
      "هواتف",
      "اندرويد",
      "أندرويد",
    ],
  },
  {
    conceptId: "web_development",
    triggers: [
      "web",
      "website",
      "web app",
      "web development",
      "frontend",
      "front-end",
      "backend",
      "back-end",
      "fullstack",
      "full-stack",
      "html",
      "css",
      "javascript",
      "typescript",
      "react",
      "nextjs",
      "next.js",
      "nodejs",
      "ويب",
      "الويب",
      "موقع",
      "مواقع",
      "تطوير الويب",
      "برمجة المواقع",
      "تصميم المواقع",
      "فرونت اند",
      "باك اند",
    ],
    expansions: [
      "web",
      "frontend",
      "backend",
      "fullstack",
      "html",
      "css",
      "javascript",
      "typescript",
      "react",
      "next.js",
      "ويب",
      "مواقع",
    ],
  },
  {
    conceptId: "database_systems",
    triggers: [
      "database",
      "databases",
      "db",
      "dbms",
      "sql",
      "postgres",
      "postgresql",
      "mysql",
      "nosql",
      "data modeling",
      "erd",
      "relational",
      "قاعدة بيانات",
      "قواعد البيانات",
      "قواعد بيانات",
      "داتابيز",
      "نمذجة البيانات",
    ],
    expansions: [
      "database",
      "databases",
      "sql",
      "postgresql",
      "mysql",
      "relational",
      "data modeling",
      "schema",
      "query",
      "قواعد البيانات",
      "قاعدة بيانات",
      "بيانات",
    ],
  },
  {
    conceptId: "cybersecurity",
    triggers: [
      "cybersecurity",
      "cyber security",
      "security",
      "infosec",
      "network security",
      "ethical hacking",
      "penetration testing",
      "pentest",
      "cryptography",
      "encryption",
      "أمن سيبراني",
      "الامن السيبراني",
      "الأمن السيبراني",
      "امن المعلومات",
      "أمن المعلومات",
      "حماية",
      "تشفير",
      "اختراق اخلاقي",
    ],
    expansions: [
      "cybersecurity",
      "security",
      "network",
      "encryption",
      "cryptography",
      "vulnerability",
      "firewall",
      "أمن",
      "سيبراني",
      "حماية",
      "تشفير",
    ],
  },
  {
    conceptId: "cloud_computing",
    triggers: [
      "cloud",
      "cloud computing",
      "aws",
      "azure",
      "gcp",
      "docker",
      "kubernetes",
      "devops",
      "serverless",
      "سحابة",
      "الحوسبة السحابية",
      "حوسبة سحابية",
      "كلاود",
    ],
    expansions: [
      "cloud",
      "cloud computing",
      "aws",
      "azure",
      "gcp",
      "docker",
      "kubernetes",
      "devops",
      "سحابية",
      "الحوسبة السحابية",
    ],
  },
  {
    conceptId: "data_analysis_ai",
    triggers: [
      "data analysis",
      "data analytics",
      "data science",
      "machine learning",
      "artificial intelligence",
      "analytics",
      "statistics",
      "python data",
      "pandas",
      "visualization",
      "تحليل البيانات",
      "تحليل بيانات",
      "علم البيانات",
      "ذكاء اصطناعي",
      "الذكاء الاصطناعي",
      "تعلم الآلة",
      "احصاء",
    ],
    expansions: [
      "data analysis",
      "analytics",
      "data science",
      "statistics",
      "visualization",
      "machine learning",
      "تحليل البيانات",
      "بيانات",
      "إحصاء",
    ],
  },
  {
    conceptId: "java_programming",
    triggers: [
      "java",
      "oop",
      "object oriented",
      "object-oriented",
      "jvm",
      "spring",
      "spring boot",
      "جافا",
      "برمجة كائنية",
      "البرمجة الكائنية",
    ],
    expansions: [
      "java",
      "oop",
      "object-oriented",
      "class",
      "inheritance",
      "polymorphism",
      "jvm",
      "spring",
      "جافا",
      "كائنية",
    ],
  },
  {
    conceptId: "software_testing",
    triggers: [
      "testing",
      "software testing",
      "qa",
      "quality assurance",
      "unit test",
      "unit testing",
      "integration testing",
      "automation testing",
      "selenium",
      "cypress",
      "اختبار البرمجيات",
      "اختبارات البرمجيات",
      "جودة البرمجيات",
      "ضمان الجودة",
    ],
    expansions: [
      "testing",
      "qa",
      "quality assurance",
      "unit",
      "integration",
      "automation",
      "test case",
      "اختبار",
      "جودة",
    ],
  },
  {
    conceptId: "iot_embedded",
    triggers: [
      "iot",
      "internet of things",
      "embedded",
      "arduino",
      "raspberry pi",
      "sensors",
      "microcontroller",
      "انترنت الاشياء",
      "إنترنت الأشياء",
      "الأنظمة المدمجة",
      "حساسات",
    ],
    expansions: [
      "iot",
      "internet of things",
      "embedded",
      "sensor",
      "sensors",
      "arduino",
      "microcontroller",
      "إنترنت الأشياء",
      "انترنت الاشياء",
    ],
  },
  {
    conceptId: "project_management_bpm",
    triggers: [
      "project management",
      "agile",
      "scrum",
      "kanban",
      "pmp",
      "bpm",
      "business process",
      "bpmn",
      "workflow",
      "إدارة المشاريع",
      "ادارة المشاريع",
      "اجايل",
      "سكرم",
      "إدارة العمليات",
    ],
    expansions: [
      "project management",
      "agile",
      "scrum",
      "kanban",
      "bpm",
      "business process",
      "bpmn",
      "إدارة المشاريع",
      "ادارة المشاريع",
    ],
  },
];

/**
 * Normalizes a token by removing common English plurals/suffixes and Arabic definite article "ال".
 */
function normalizeStemToken(word: string): string[] {
  const variants = new Set<string>([word]);
  if (word.startsWith("ال") && word.length > 4) {
    variants.add(word.slice(2));
  }
  if (word === "apps" || word === "application" || word === "applications") {
    variants.add("app");
    variants.add("application");
  }
  if (word === "app") {
    variants.add("application");
  }
  if (word.endsWith("ing") && word.length > 5) {
    variants.add(word.slice(0, -3));
  }
  if (word.endsWith("ment") && word.length > 6) {
    variants.add(word.slice(0, -4));
  }
  if (word.endsWith("ies") && word.length > 5) {
    variants.add(`${word.slice(0, -3)}y`);
  } else if (word.endsWith("es") && word.length > 4) {
    variants.add(word.slice(0, -2));
  } else if (word.endsWith("s") && word.length > 3) {
    variants.add(word.slice(0, -1));
  }
  return Array.from(variants);
}

/**
 * Tokenizes a student query into meaningful search terms (>= 2 chars, excluding generic stopwords).
 */
export function extractMeaningfulQueryTerms(query: string): string[] {
  const rawTokens = query
    .toLowerCase()
    .split(/[^a-z0-9\u0621-\u064A]+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));

  const out = new Set<string>();
  for (const token of rawTokens) {
    for (const v of normalizeStemToken(token)) {
      if (v.length >= 2 && !STOPWORDS.has(v)) {
        out.add(v);
      }
    }
  }
  return Array.from(out);
}

/**
 * Expands a user query into direct terms AND bilingual semantic domain terms.
 */
export function expandSemanticQueryTerms(query: string): {
  directTerms: string[];
  semanticTerms: string[];
  matchedConceptIds: string[];
} {
  const lowerQuery = query.toLowerCase();
  const directTerms = extractMeaningfulQueryTerms(query);
  const semanticSet = new Set<string>(directTerms);
  const matchedConceptIds: string[] = [];

  for (const cluster of SEMANTIC_CONCEPT_CLUSTERS) {
    const triggered = cluster.triggers.some(
      (trig) =>
        lowerQuery.includes(trig) ||
        directTerms.includes(trig),
    );
    if (triggered) {
      matchedConceptIds.push(cluster.conceptId);
      for (const exp of cluster.expansions) {
        semanticSet.add(exp.toLowerCase());
      }
    }
  }

  return {
    directTerms,
    semanticTerms: Array.from(semanticSet),
    matchedConceptIds,
  };
}

/**
 * Detects whether the student's question is asking about course duration / hours / length.
 */
export function isCourseDurationQuery(query: string): boolean {
  const lower = query.toLowerCase();
  const durationPatterns = [
    "how many hours",
    "how much time",
    "how long",
    "course duration",
    "duration of",
    "total hours",
    "total time",
    "hours does",
    "hours the",
    "estimated hours",
    "كم ساعة",
    "كم ساعه",
    "عدد ساعات",
    "عدد الساعات",
    "مدة دورة",
    "مدة الدورة",
    "مدة كورس",
    "مدة الكورس",
    "كم مدة",
    "كم يستغرق",
    "كم تستغرق",
    "كم وقت",
    "ياخذ وقت",
    "يأخذ وقت",
    "تأخذ وقت",
  ];
  return durationPatterns.some((p) => lower.includes(p));
}

/**
 * Computes verified course duration strictly from database fields:
 * 1. `courses.estimated_hours` when > 0.
 * 2. Otherwise, sum of published `lessons.duration_seconds` ONLY when every published lesson has `duration_seconds > 0`.
 * 3. If some published lessons have `duration_seconds <= 0`, explicitly reports incomplete lesson duration data and never treats a partial sum as the total course duration.
 */
export function computeVerifiedCourseDuration(params: {
  course: {
    id: string;
    code: string;
    title: string;
    category: string;
    estimated_hours: number | null;
  };
  courseLessons: Array<{
    id: string;
    course_id: string;
    title: string;
    duration_seconds: number | null;
    is_published?: boolean;
  }>;
}): VerifiedCourseDurationInfo {
  const { course } = params;
  // Deduplicate lessons strictly by lesson.id and verify lesson.course_id === course.id
  const uniqueLessonsMap = new Map<
    string,
    { id: string; title: string; durationSeconds: number }
  >();
  for (const l of params.courseLessons) {
    if (l.course_id !== course.id) continue;
    if (l.is_published === false) continue;
    if (!uniqueLessonsMap.has(l.id)) {
      uniqueLessonsMap.set(l.id, {
        id: l.id,
        title: l.title,
        durationSeconds: Number(l.duration_seconds ?? 0),
      });
    }
  }

  const validCourseLessons = Array.from(uniqueLessonsMap.values());
  const totalPublishedLessons = validCourseLessons.length;
  const lessonsWithValidDuration = validCourseLessons.filter(
    (l) => Number.isFinite(l.durationSeconds) && l.durationSeconds > 0,
  ).length;
  const missingDurationLessons =
    totalPublishedLessons - lessonsWithValidDuration;
  const summedLessonSeconds = validCourseLessons.reduce(
    (sum, l) => sum + (l.durationSeconds > 0 ? l.durationSeconds : 0),
    0,
  );

  const recordedEstimatedHours =
    typeof course.estimated_hours === "number" &&
    Number.isFinite(course.estimated_hours) &&
    course.estimated_hours > 0
      ? Number(course.estimated_hours)
      : null;

  // Priority 1: Direct recorded course duration (`courses.estimated_hours > 0`)
  if (recordedEstimatedHours !== null) {
    const lessonNoteEn =
      totalPublishedLessons > 0 && missingDurationLessons === 0
        ? ` (Additionally, all ${totalPublishedLessons} published lessons have recorded durations totaling ${Number((summedLessonSeconds / 3600).toFixed(2))} hours / ${Math.round(summedLessonSeconds / 60)} minutes).`
        : totalPublishedLessons > 0
          ? ` (Course contains ${totalPublishedLessons} published lessons).`
          : "";

    const lessonNoteAr =
      totalPublishedLessons > 0 && missingDurationLessons === 0
        ? ` (بالإضافة إلى ذلك، تحتوي الدورة على ${totalPublishedLessons} دروس منشورة بمجموع مدد مسجلة يبلغ ${Number((summedLessonSeconds / 3600).toFixed(2))} ساعة / ${Math.round(summedLessonSeconds / 60)} دقيقة).`
        : totalPublishedLessons > 0
          ? ` (تحتوي الدورة على ${totalPublishedLessons} دروس منشورة).`
          : "";

    return {
      courseId: course.id,
      courseCode: course.code,
      courseTitle: course.title,
      courseCategory: course.category,
      source: "course_estimated_hours",
      recordedEstimatedHours,
      totalPublishedLessons,
      lessonsWithValidDuration,
      missingDurationLessons,
      summedLessonSeconds,
      summedLessonHours:
        totalPublishedLessons > 0 && missingDurationLessons === 0
          ? Number((summedLessonSeconds / 3600).toFixed(2))
          : null,
      summedLessonMinutes:
        totalPublishedLessons > 0 && missingDurationLessons === 0
          ? Math.round(summedLessonSeconds / 60)
          : null,
      explanationEn: `**${course.code} — ${course.title}** has a verified course duration of **${recordedEstimatedHours} hours**, retrieved directly from the official course record (\`courses.estimated_hours\`) in the database.${lessonNoteEn}`,
      explanationAr: `تبلغ المدة المسجلة لدورة **${course.code} — ${course.title}** في قاعدة البيانات **${recordedEstimatedHours} ساعة**، وهي مستخرجة مباشرة من السجل الرسمي للدورة (\`courses.estimated_hours\`).${lessonNoteAr}`,
    };
  }

  // Priority 2: No direct course duration (`estimated_hours` is 0/null), check individual lessons
  if (totalPublishedLessons > 0 && missingDurationLessons === 0) {
    const hoursExact = Number((summedLessonSeconds / 3600).toFixed(2));
    const totalMinutes = Math.round(summedLessonSeconds / 60);
    const wholeHours = Math.floor(totalMinutes / 60);
    const remMinutes = totalMinutes % 60;
    const formattedEn =
      wholeHours > 0
        ? `${wholeHours} hr ${remMinutes} min (${hoursExact} hours / ${totalMinutes} minutes)`
        : `${totalMinutes} minutes (${hoursExact} hours)`;
    const formattedAr =
      wholeHours > 0
        ? `${wholeHours} ساعة و ${remMinutes} دقيقة (${hoursExact} ساعة / ${totalMinutes} دقيقة)`
        : `${totalMinutes} دقيقة (${hoursExact} ساعة)`;

    return {
      courseId: course.id,
      courseCode: course.code,
      courseTitle: course.title,
      courseCategory: course.category,
      source: "summed_lessons",
      recordedEstimatedHours: null,
      totalPublishedLessons,
      lessonsWithValidDuration,
      missingDurationLessons: 0,
      summedLessonSeconds,
      summedLessonHours: hoursExact,
      summedLessonMinutes: totalMinutes,
      explanationEn: `**${course.code} — ${course.title}** does not have a single pre-set course-level hour field (\`courses.estimated_hours\` is 0), so its duration was calculated by summing the recorded durations (\`lessons.duration_seconds\`) across **all ${totalPublishedLessons} published lessons**: **${formattedEn}**.`,
      explanationAr: `لا يوجد حقل ساعات إجمالي مسجل مسبقاً على مستوى دورة **${course.code} — ${course.title}** (\`courses.estimated_hours\` = 0)، لذلك تم حساب المدة الكلية عن طريق جمع مدد جميع الدروس المنشورة البالغ عددها **${totalPublishedLessons} دروس** (\`lessons.duration_seconds\`): **${formattedAr}**.`,
    };
  }

  // Priority 3: Partial / Incomplete lesson durations (never treat partial sum as total course duration)
  if (totalPublishedLessons > 0 && lessonsWithValidDuration > 0) {
    const partialMinutes = Math.round(summedLessonSeconds / 60);
    return {
      courseId: course.id,
      courseCode: course.code,
      courseTitle: course.title,
      courseCategory: course.category,
      source: "incomplete_lesson_durations",
      recordedEstimatedHours: null,
      totalPublishedLessons,
      lessonsWithValidDuration,
      missingDurationLessons,
      summedLessonSeconds,
      summedLessonHours: null,
      summedLessonMinutes: null,
      explanationEn: `**${course.code} — ${course.title}** does not have a direct course duration recorded in \`courses.estimated_hours\`, and its lesson duration data is **incomplete**: only **${lessonsWithValidDuration} of ${totalPublishedLessons} published lessons** have a recorded duration (${partialMinutes} minutes across those ${lessonsWithValidDuration} lessons, while ${missingDurationLessons} lesson(s) have no duration recorded). Under Learnix's grounding rules, a partial sum is not reported as the total course duration.`,
      explanationAr: `لا تتوفر مدة إجمالية مسجلة مباشرة لدورة **${course.code} — ${course.title}** في حقل (\`courses.estimated_hours\`)، كما أن بيانات مدد الدروس **غير مكتملة**: تتوفر مدة مسجلة لـ **${lessonsWithValidDuration} فقط من أصل ${totalPublishedLessons} دروس منشورة** (${partialMinutes} دقيقة لتلك الدروس، بينما لا توجد مدة مسجلة لـ ${missingDurationLessons} دروس). التزاماً بسياسة الدقة في Learnix، لا يتم اعتبار المجموع الجزئي مدةً كاملة للدورة.`,
    };
  }

  // Priority 4: Neither course duration nor any lesson duration is recorded
  return {
    courseId: course.id,
    courseCode: course.code,
    courseTitle: course.title,
    courseCategory: course.category,
    source: "unavailable",
    recordedEstimatedHours: null,
    totalPublishedLessons,
    lessonsWithValidDuration: 0,
    missingDurationLessons: totalPublishedLessons,
    summedLessonSeconds: 0,
    summedLessonHours: null,
    summedLessonMinutes: null,
    explanationEn: `No verified course duration is recorded in the database for **${course.code} — ${course.title}** (\`courses.estimated_hours\` is not set, and none of the ${totalPublishedLessons} published lesson(s) have a recorded \`duration_seconds\` value). I will not invent or estimate a duration.`,
    explanationAr: `لا تتوفر مدة زمنية مسجلة في قاعدة البيانات لدورة **${course.code} — ${course.title}** (لم يتم تحديد \`courses.estimated_hours\`، ولا توجد مدة مسجلة في \`lessons.duration_seconds\` لأي من الدروس البالغ عددها ${totalPublishedLessons}). لن أقوم بتخمين أو تقدير مدة غير مسجلة.`,
  };
}

export interface PreloadedCourseMetadata {
  id: string;
  code: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  category: string;
  completion_requirements: string | null;
  estimated_hours: number | null;
}

/**
 * Retrieves relevant grounded course passages from lessons, chapters, course metadata & ai_document_chunks.
 * STRICT ACCESS SCOPE: Queries ONLY the course IDs passed in `courseId` / `courseIds` (which for students must strictly be their enrolled course IDs)
 * and respects Supabase RLS via the caller's authenticated server client.
 *
 * TWO-STAGE STRUCTURED & RAG RETRIEVAL:
 * - For duration/metadata queries (`isDurationQuery`), starts with Stage 1 lightweight structured retrieval
 *   (`courses`, `chapters`, and `lessons` metadata/durations WITHOUT `content_markdown` or `ai_document_chunks`).
 * - If Stage 1 structured metadata does not identify a matching course, automatically falls back to Stage 2
 *   deeper content-based discovery (`lessons.content_markdown` and `ai_document_chunks.content`) so semantic accuracy is never sacrificed.
 * - Reuses `preloadedCourses` when already fetched by the caller to eliminate duplicate `courses` table queries.
 */
export async function retrieveGroundedCourseContext(params: {
  courseId?: string | null;
  courseIds?: string[];
  preloadedCourses?: PreloadedCourseMetadata[];
  lessonId?: string | null;
  query: string;
  allowBroadCourseFallback?: boolean;
}): Promise<{
  courseTitle: string;
  courseCode: string;
  citations: AiCitation[];
  contextBlock: string;
  hasRelevantMatches: boolean;
  matchedCourses: MatchedEnrolledCourseSummary[];
  isDurationQuery: boolean;
  usedLightweightStructuredOnly?: boolean;
}> {
  const targetCourseIds = Array.from(
    new Set(
      [
        ...(params.courseId ? [params.courseId] : []),
        ...(params.courseIds ?? []),
      ].filter(Boolean),
    ),
  );

  const durationAsked = isCourseDurationQuery(params.query);

  if (targetCourseIds.length === 0) {
    return {
      courseTitle: "No Enrolled Course",
      courseCode: "NONE",
      citations: [],
      contextBlock: "",
      hasRelevantMatches: false,
      matchedCourses: [],
      isDurationQuery: durationAsked,
    };
  }

  const supabase = await createSupabaseServerClient();

  // Reuse preloaded courses when provided by the caller (e.g., from getAuthenticatedStudentAcademicSnapshot)
  // to avoid duplicate `courses` queries; otherwise fetch strictly for `targetCourseIds`.
  const targetSet = new Set(targetCourseIds);
  const preloadedFiltered = (params.preloadedCourses ?? []).filter((c) =>
    targetSet.has(c.id),
  );
  const canReusePreloadedCourses =
    preloadedFiltered.length === targetCourseIds.length &&
    preloadedFiltered.length > 0;

  const startWithLightweightStructured =
    durationAsked && !params.allowBroadCourseFallback && !params.lessonId;

  type LessonRetrievalRow = {
    id: string;
    course_id: string;
    chapter_id: string;
    title: string;
    summary: string | null;
    content_markdown: string | null;
    content_type: string;
    duration_seconds: number;
    is_published: boolean;
    position: number;
  };

  type ChunkRetrievalRow = {
    id: string;
    course_id: string;
    source_title: string;
    source_type: string;
    content: string;
    lesson_id: string | null;
  };

  const [coursesRes, chaptersRes, stage1LessonsRes, stage1ChunksRes] =
    await Promise.all([
      canReusePreloadedCourses
        ? Promise.resolve({ data: preloadedFiltered, error: null })
        : supabase
            .from("courses")
            .select(
              "id, code, title, subtitle, description, category, completion_requirements, estimated_hours",
            )
            .in("id", targetCourseIds),
      supabase
        .from("chapters")
        .select("id, course_id, title, description, position")
        .in("course_id", targetCourseIds)
        .eq("is_published", true)
        .order("position", { ascending: true })
        .limit(100),
      startWithLightweightStructured
        ? supabase
            .from("lessons")
            .select(
              "id, course_id, chapter_id, title, summary, content_type, duration_seconds, is_published, position",
            )
            .in("course_id", targetCourseIds)
            .eq("is_published", true)
            .order("position", { ascending: true })
            .limit(200)
        : params.lessonId
          ? supabase
              .from("lessons")
              .select(
                "id, course_id, chapter_id, title, summary, content_markdown, content_type, duration_seconds, is_published, position",
              )
              .in("course_id", targetCourseIds)
              .eq("id", params.lessonId)
          : supabase
              .from("lessons")
              .select(
                "id, course_id, chapter_id, title, summary, content_markdown, content_type, duration_seconds, is_published, position",
              )
              .in("course_id", targetCourseIds)
              .eq("is_published", true)
              .order("position", { ascending: true })
              .limit(200),
      startWithLightweightStructured
        ? Promise.resolve({ data: [] as ChunkRetrievalRow[], error: null })
        : supabase
            .from("ai_document_chunks")
            .select("id, course_id, source_title, source_type, content, lesson_id")
            .in("course_id", targetCourseIds)
            .order("created_at", { ascending: false })
            .limit(60),
    ]);

  const courses = coursesRes.data ?? [];
  const chapters = chaptersRes.data ?? [];
  let lessons: LessonRetrievalRow[] = (stage1LessonsRes.data ?? []).map(
    (l) => ({
      ...l,
      content_markdown:
        "content_markdown" in l && typeof l.content_markdown === "string"
          ? l.content_markdown
          : null,
    }),
  );
  let chunks: ChunkRetrievalRow[] = stage1ChunksRes.data ?? [];
  let usedLightweightStructuredOnly = startWithLightweightStructured;

  const courseMap = new Map(courses.map((c) => [c.id, c]));
  const primaryCourse =
    (params.courseId ? courseMap.get(params.courseId) : courses[0]) ??
    courses[0];

  const { directTerms, semanticTerms } = expandSemanticQueryTerms(params.query);

  function countMatchesInText(haystackLower: string): {
    directMatches: number;
    semanticMatches: number;
    matchedTerms: string[];
  } {
    let directMatches = 0;
    let semanticMatches = 0;
    const matchedTerms: string[] = [];

    for (const term of directTerms) {
      if (haystackLower.includes(term)) {
        directMatches += 1;
        matchedTerms.push(term);
      }
    }
    for (const term of semanticTerms) {
      if (!directTerms.includes(term) && haystackLower.includes(term)) {
        semanticMatches += 1;
        matchedTerms.push(term);
      }
    }
    return { directMatches, semanticMatches, matchedTerms };
  }

  function evaluateCourseMatches(
    currentLessons: LessonRetrievalRow[],
    currentChunks: ChunkRetrievalRow[],
  ): MatchedEnrolledCourseSummary[] {
    const results: MatchedEnrolledCourseSummary[] = [];

    for (const c of courses) {
      const courseLessons = currentLessons.filter((l) => l.course_id === c.id);
      const courseChapters = chapters.filter((ch) => ch.course_id === c.id);
      const courseChunks = currentChunks.filter((ch) => ch.course_id === c.id);

      const durationInfo = computeVerifiedCourseDuration({
        course: {
          id: c.id,
          code: c.code,
          title: c.title,
          category: c.category,
          estimated_hours: c.estimated_hours,
        },
        courseLessons,
      });

      let courseScore = params.courseId === c.id ? 25 : 0;
      const matchReasons: string[] = [];

      const titleAndCategoryHay = [c.code, c.title, c.subtitle, c.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const titleMatch = countMatchesInText(titleAndCategoryHay);
      if (titleMatch.directMatches > 0 || titleMatch.semanticMatches > 0) {
        courseScore +=
          titleMatch.directMatches * 10 + titleMatch.semanticMatches * 6;
        matchReasons.push(
          `Course title/category (${c.category}): matched [${titleMatch.matchedTerms.slice(0, 4).join(", ")}]`,
        );
      }

      const descHay = [c.description, c.completion_requirements]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const descMatch = countMatchesInText(descHay);
      if (descMatch.directMatches > 0 || descMatch.semanticMatches > 0) {
        courseScore +=
          descMatch.directMatches * 7 + descMatch.semanticMatches * 4;
        matchReasons.push(
          `Course description/objectives: matched [${descMatch.matchedTerms.slice(0, 4).join(", ")}]`,
        );
      }

      const chaptersHay = courseChapters
        .map((ch) => `${ch.title} ${ch.description ?? ""}`)
        .join(" ")
        .toLowerCase();
      const chMatch = countMatchesInText(chaptersHay);
      if (chMatch.directMatches > 0 || chMatch.semanticMatches > 0) {
        courseScore += chMatch.directMatches * 5 + chMatch.semanticMatches * 3;
        matchReasons.push(
          `Chapters: matched [${chMatch.matchedTerms.slice(0, 4).join(", ")}]`,
        );
      }

      const lessonsHay = courseLessons
        .map(
          (l) =>
            `${l.title} ${l.summary ?? ""} ${(l.content_markdown ?? "").slice(0, 600)}`,
        )
        .join(" ")
        .toLowerCase();
      const lessonMatch = countMatchesInText(lessonsHay);
      if (lessonMatch.directMatches > 0 || lessonMatch.semanticMatches > 0) {
        courseScore +=
          lessonMatch.directMatches * 6 + lessonMatch.semanticMatches * 4;
        matchReasons.push(
          `Lesson content: matched [${lessonMatch.matchedTerms.slice(0, 4).join(", ")}]`,
        );
      }

      const chunksHay = courseChunks
        .map((ch) => `${ch.source_title} ${ch.content.slice(0, 500)}`)
        .join(" ")
        .toLowerCase();
      const chunkMatch = countMatchesInText(chunksHay);
      if (chunkMatch.directMatches > 0 || chunkMatch.semanticMatches > 0) {
        courseScore +=
          chunkMatch.directMatches * 5 + chunkMatch.semanticMatches * 3;
        matchReasons.push(
          `Course documents: matched [${chunkMatch.matchedTerms.slice(0, 4).join(", ")}]`,
        );
      }

      const hasNoTopicFilter =
        directTerms.length === 0 && semanticTerms.length === 0;
      if (
        courseScore > 0 ||
        params.allowBroadCourseFallback ||
        (durationAsked && hasNoTopicFilter)
      ) {
        results.push({
          courseId: c.id,
          courseCode: c.code,
          courseTitle: c.title,
          courseCategory: c.category,
          matchScore: courseScore || 1,
          matchReasons:
            matchReasons.length > 0
              ? matchReasons
              : ["Enrolled course in active scope"],
          durationInfo,
        });
      }
    }

    results.sort((a, b) => b.matchScore - a.matchScore);
    return results;
  }

  // Stage 1 evaluation: check if lightweight structured metadata identified relevant course(s)
  let matchedCourses = evaluateCourseMatches(lessons, chunks);

  // Stage 2 automatic fallback: if we started with lightweight structured metadata (omitting content_markdown & chunks)
  // and found NO matching course, fall back to deeper content-based discovery so semantic accuracy is never sacrificed.
  if (startWithLightweightStructured && matchedCourses.length === 0) {
    usedLightweightStructuredOnly = false;
    const [deepLessonsRes, deepChunksRes] = await Promise.all([
      supabase
        .from("lessons")
        .select("id, course_id, content_markdown")
        .in("course_id", targetCourseIds)
        .eq("is_published", true)
        .limit(200),
      supabase
        .from("ai_document_chunks")
        .select("id, course_id, source_title, source_type, content, lesson_id")
        .in("course_id", targetCourseIds)
        .order("created_at", { ascending: false })
        .limit(60),
    ]);

    const markdownMap = new Map(
      (deepLessonsRes.data ?? []).map((l) => [l.id, l.content_markdown]),
    );
    lessons = lessons.map((l) => ({
      ...l,
      content_markdown: markdownMap.get(l.id) ?? null,
    }));
    chunks = deepChunksRes.data ?? [];
    matchedCourses = evaluateCourseMatches(lessons, chunks);
  }

  const matchedCourseIdsSet = new Set(matchedCourses.map((m) => m.courseId));

  // 2. Build Scored Passages & Citations (including Course Overview & Verified Duration Metadata for matched courses)
  interface ScoredPassage {
    score: number;
    citation: AiCitation;
    fullText: string;
  }

  const candidates: ScoredPassage[] = [];

  for (const mc of matchedCourses) {
    const c = courseMap.get(mc.courseId);
    if (!c) continue;

    const courseChapters = chapters.filter((ch) => ch.course_id === c.id);
    const courseLessons = lessons.filter((l) => l.course_id === c.id);

    const overviewLines = [
      `Course: ${c.code} — ${c.title}`,
      `Category: ${c.category}`,
      c.subtitle ? `Subtitle: ${c.subtitle}` : null,
      c.description ? `Description: ${c.description}` : null,
      c.completion_requirements
        ? `Learning Objectives / Completion Requirements: ${c.completion_requirements}`
        : null,
      `Verified Duration Data: ${mc.durationInfo.explanationEn}`,
      courseChapters.length > 0
        ? `Chapters (${courseChapters.length}): ${courseChapters.map((ch) => ch.title).join("; ")}`
        : null,
      courseLessons.length > 0
        ? `Published Lessons (${courseLessons.length}): ${courseLessons
            .slice(0, 12)
            .map(
              (l) =>
                `${l.position}. ${l.title} (${l.duration_seconds > 0 ? `${Math.round(l.duration_seconds / 60)}m` : "no duration recorded"})`,
            )
            .join("; ")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    candidates.push({
      score: mc.matchScore + (durationAsked ? 30 : 5),
      citation: {
        sourceTitle: `${c.code} — ${c.title} (Course Metadata & Duration)`,
        sourceType: "course",
        excerpt: mc.durationInfo.explanationEn.slice(0, 240),
      },
      fullText: overviewLines,
    });
  }

  for (const lesson of lessons) {
    const parentCourse = courseMap.get(lesson.course_id);
    const coursePrefix = parentCourse ? `${parentCourse.code}: ` : "";
    const body = [lesson.summary, lesson.content_markdown]
      .filter(Boolean)
      .join("\n")
      .trim();

    const hay = `${lesson.title} ${body}`.toLowerCase();
    const match = countMatchesInText(hay);
    const isExplicitLesson = Boolean(
      params.lessonId && lesson.id === params.lessonId,
    );
    const parentMatched = matchedCourseIdsSet.has(lesson.course_id);

    const score =
      match.directMatches * 8 +
      match.semanticMatches * 5 +
      (isExplicitLesson ? 20 : 0) +
      (parentMatched && params.allowBroadCourseFallback ? 2 : 0);

    if (
      match.directMatches > 0 ||
      match.semanticMatches > 0 ||
      isExplicitLesson ||
      (parentMatched && params.allowBroadCourseFallback)
    ) {
      const durationLabel =
        lesson.duration_seconds > 0
          ? `Duration: ${Math.round(lesson.duration_seconds / 60)} min (${lesson.duration_seconds}s)`
          : "Duration: Not recorded";
      const textBlock = [
        `Lesson: ${lesson.title} (${durationLabel})`,
        body ? body.slice(0, 1300) : null,
      ]
        .filter(Boolean)
        .join("\n");

      candidates.push({
        score,
        citation: {
          sourceTitle: `${coursePrefix}Lesson: ${lesson.title}`,
          sourceType: lesson.content_type,
          excerpt: (body || durationLabel).slice(0, 240),
          lessonId: lesson.id,
        },
        fullText: textBlock,
      });
    }
  }

  for (const ch of chunks) {
    const hay = `${ch.source_title} ${ch.content}`.toLowerCase();
    const match = countMatchesInText(hay);
    const parentCourse = courseMap.get(ch.course_id);
    const coursePrefix = parentCourse ? `${parentCourse.code}: ` : "";
    const parentMatched = matchedCourseIdsSet.has(ch.course_id);

    const score =
      match.directMatches * 9 +
      match.semanticMatches * 5 +
      (parentMatched && params.allowBroadCourseFallback ? 2 : 0);

    if (
      match.directMatches > 0 ||
      match.semanticMatches > 0 ||
      (parentMatched && params.allowBroadCourseFallback)
    ) {
      candidates.push({
        score,
        citation: {
          sourceTitle: `${coursePrefix}${ch.source_title}`,
          sourceType: ch.source_type,
          excerpt: ch.content.slice(0, 240),
          lessonId: ch.lesson_id,
        },
        fullText: ch.content.slice(0, 1200),
      });
    }
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
    courseTitle:
      matchedCourses.length === 1
        ? matchedCourses[0]!.courseTitle
        : targetCourseIds.length > 1 && !params.courseId
          ? "Enrolled Courses"
          : (primaryCourse?.title ?? "Selected Course"),
    courseCode:
      matchedCourses.length === 1
        ? matchedCourses[0]!.courseCode
        : targetCourseIds.length > 1 && !params.courseId
          ? "ENROLLED"
          : (primaryCourse?.code ?? "COURSE"),
    citations,
    contextBlock,
    hasRelevantMatches: top.length > 0 || matchedCourses.length > 0,
    matchedCourses,
    isDurationQuery: durationAsked,
    usedLightweightStructuredOnly,
  };
}

/**
 * Returns verified Learnix platform navigation, features, and how-to documentation
 * grounded strictly in the actual application routes and implemented UI features.
 */
export function getVerifiedPlatformHelpContext(): {
  contextBlock: string;
  citation: AiCitation;
} {
  const contextBlock = [
    "=== VERIFIED LEARNIX PLATFORM GUIDE & WORKFLOWS ===",
    "1. Platform Overview & Features:",
    "   - Learnix is an AI-powered learning management system (LMS) combining structured online courses, multimedia lessons, assignments, smart quizzes/examinations, real-time messaging & notifications, analytics, and the Groq-powered Learnix AI Assistant.",
    "   - Supports 5 languages (English, Arabic with full RTL, German, Italian, French) and persistent dark/light themes.",
    "2. Student Workflows & Navigation:",
    "   - Overview (`/student`): Dashboard summary of enrolled courses, completion progress, upcoming quizzes, active assignments, latest grades, study hours, and notifications.",
    "   - Explore Courses (`/student/courses`): Browse all published courses, filter by category, search by title/code/teacher, view approved student reviews, flip course cards for details, and click 'Enroll Now'.",
    "   - My Learning (`/student/my-learning`): Interactive Learning Orbit showing enrolled courses, chapters, lessons, downloadable learning resources/PDFs, Lesson Viewer (`/student/courses/[lessonId]`), and post-completion course/teacher reviews.",
    "   - Assignments (`/student/assignments`): View published course assignments, instructions, due dates, rubrics, submit written answers or file attachments, and view teacher-approved grades & feedback.",
    "   - Exams / Quizzes (`/student/exams`): View published course quizzes, attempt limits, duration, marks, launch the Secure Exam Runner (`/student/exams/[examId]`), and review completed attempt results.",
    "   - AI Study Assistant (`/student/ai-assistant`): Course-aware academic tutor supporting text chat, enrolled course context selection, conversation history, document uploads (PDF, DOCX, PPTX, XLSX, TXT up to 15 MB), and live voice recording.",
    "   - Performance (`/student/performance`) & Attendance (`/student/attendance`): Track exam averages, assignment grades, completion charts, strengths, revision areas, and attendance records.",
    "   - Messages (`/messages`), Notifications (`/notifications`), and Profile (`/student/profile`): Real-time chat with instructors, instant platform notifications, earned certificates, and account settings.",
    "3. Teacher Workflows & Navigation:",
    "   - Overview (`/teacher`) & Courses (`/teacher/courses`): Create courses (with automatic course code generation and cover image), organize chapters & lessons, upload PDFs/videos/learning resources, and publish courses.",
    "   - Quizzes & AI Quiz Generator (`/teacher/exams`): Generate clean course-grounded quizzes with Learnix AI, replace or edit individual questions, preview student-facing quiz layout, manage the Question Bank, and monitor student attempts.",
    "   - Assignments & Grading (`/teacher/grading`): Create assignments with rubrics, review student submissions, generate AI grading suggestions/feedback, and click 'Approve & Publish Grade' (human-in-the-loop).",
    "   - Students (`/teacher/students`), Analytics (`/teacher/analytics`), and AI Teacher Assistant (`/teacher/ai-assistant`): Monitor enrolled student progress, identify struggling learners or missing assignments, chat directly with students, and draft teaching plans.",
    "4. Unsupported Features Policy:",
    "   - Features not part of Learnix (such as paid checkout/subscriptions or built-in live video calls) should be clearly noted as unavailable on Learnix.",
  ].join("\n");

  return {
    contextBlock,
    citation: {
      sourceTitle: "Learnix Platform Guide & Workflows Reference",
      sourceType: "platform_guide",
      excerpt:
        "Official Learnix Student and Teacher navigation, courses, assignments, quizzes, AI assistant, messaging, and analytics workflows.",
    },
  };
}

const GROQ_CHAT_COMPLETIONS_URL =
  "https://api.groq.com/openai/v1/chat/completions";
const GROQ_AUDIO_TRANSCRIPTIONS_URL =
  "https://api.groq.com/openai/v1/audio/transcriptions";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

interface GroqToolCallPayload {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface GroqChatMessagePayload {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: GroqToolCallPayload[];
  tool_call_id?: string;
  name?: string;
}

function supportsGroqJsonObjectMode(model: string): boolean {
  const lower = model.toLowerCase();
  return (
    lower.includes("gpt-oss") ||
    lower.startsWith("openai/") ||
    lower.includes("qwen") ||
    lower.includes("llama-3") ||
    lower.includes("llama3") ||
    lower.includes("mixtral") ||
    lower.includes("gemma") ||
    lower.includes("deepseek")
  );
}

function stripThinkingAndJsonFences(
  rawText: string,
  jsonMode: boolean,
): string {
  const withoutThink = rawText
    .replace(/^<think>[\s\S]*?<\/think>\s*/i, "")
    .trim();
  if (jsonMode && withoutThink.startsWith("```")) {
    return withoutThink
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }
  return withoutThink;
}

function normalizeToolSchemaForGroq(
  schema: unknown,
): Record<string, unknown> {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return { type: "object", properties: {} };
  }
  const raw = schema as Record<string, unknown>;
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (key === "type" && typeof value === "string") {
      normalized.type = value.toLowerCase();
    } else if (
      key === "properties" &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      const props: Record<string, unknown> = {};
      for (const [propName, propVal] of Object.entries(
        value as Record<string, unknown>,
      )) {
        props[propName] = normalizeToolSchemaForGroq(propVal);
      }
      normalized.properties = props;
    } else if (key === "items" && value && typeof value === "object") {
      normalized.items = normalizeToolSchemaForGroq(value);
    } else {
      normalized[key] = value;
    }
  }

  if (normalized.type === "object" && !normalized.properties) {
    normalized.properties = {};
  }

  return normalized;
}

function formatFunctionDeclarationsForGroq(
  tools: AiAgentFunctionDeclaration[],
): Array<Record<string, unknown>> {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: normalizeToolSchemaForGroq(tool.parameters),
    },
  }));
}

function parseRecoveredXmlToolCalls(
  failedGeneration: string | undefined,
): GroqToolCallPayload[] {
  if (!failedGeneration) return [];
  const recovered: GroqToolCallPayload[] = [];
  const regex =
    /<function=([a-zA-Z0-9_]+)(?:>|\s+)(\{[\s\S]*?\})?\s*<\/function>/g;
  let match: RegExpExecArray | null = regex.exec(failedGeneration);
  let idx = 0;

  while (match !== null) {
    const fnName = match[1]?.trim();
    const rawArgs = match[2]?.trim() || "{}";
    if (fnName) {
      try {
        const parsedArgs = JSON.parse(rawArgs);
        recovered.push({
          id: `call_recovered_${idx++}`,
          type: "function",
          function: {
            name: fnName,
            arguments: JSON.stringify(parsedArgs ?? {}),
          },
        });
      } catch {
        // Ignore malformed XML tool fragment
      }
    }
    match = regex.exec(failedGeneration);
  }

  return recovered;
}

/**
 * Invokes the centralized Supabase Edge Function (`learnix-ai`) which reads
 * `AI_PROVIDER`, `GROQ_API_KEY`, and `GROQ_MODEL` securely from Supabase Edge Function Secrets.
 */
async function invokeLearnixAiEdgeFunction(
  payload: Record<string, unknown>,
): Promise<{
  ok: boolean;
  text?: string;
  message?: {
    role?: string;
    content?: string | null;
    tool_calls?: GroqToolCallPayload[];
  };
  provider?: string;
  secretMissing?: boolean;
  errorCode?: string;
  status?: number;
  retryAfterSeconds?: number;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.functions.invoke("learnix-ai", {
      body: payload,
    });

    if (error) {
      const msg = error.message || "";
      const ctx = (error as { context?: Response }).context;
      let bodyCode = "";
      let retryAfterSeconds: number | undefined;
      const status = ctx?.status;
      if (ctx && typeof ctx.clone === "function") {
        try {
          const errJson = (await ctx.clone().json()) as {
            errorCode?: string;
            retryAfterSeconds?: number;
          };
          bodyCode = errJson?.errorCode ?? "";
          retryAfterSeconds = errJson?.retryAfterSeconds;
        } catch {
          // Ignore non-JSON error body
        }
      }
      if (
        bodyCode === "EDGE_SECRET_NOT_SET" ||
        msg.includes("EDGE_SECRET_NOT_SET") ||
        status === 503 ||
        msg.includes("503")
      ) {
        return {
          ok: false,
          secretMissing: true,
          errorCode: "EDGE_SECRET_NOT_SET",
          status: status ?? 503,
        };
      }
      return {
        ok: false,
        errorCode:
          status === 429
            ? bodyCode || "GROQ_RATE_LIMITED"
            : bodyCode || "EDGE_INVOKE_ERROR",
        status,
        retryAfterSeconds,
      };
    }

    const parsed = data as {
      ok?: boolean;
      text?: string;
      message?: {
        role?: string;
        content?: string | null;
        tool_calls?: GroqToolCallPayload[];
      };
      provider?: string;
      errorCode?: string;
      status?: number;
      retryAfterSeconds?: number;
    } | null;

    if (!parsed || parsed.ok !== true) {
      return {
        ok: false,
        secretMissing: parsed?.errorCode === "EDGE_SECRET_NOT_SET",
        errorCode: parsed?.errorCode ?? "EDGE_PROVIDER_FAILED",
        status: parsed?.status,
        retryAfterSeconds: parsed?.retryAfterSeconds,
      };
    }

    return {
      ok: true,
      text: parsed.text,
      message: parsed.message,
      provider: parsed.provider ?? `edge:groq:${DEFAULT_GROQ_MODEL}`,
    };
  } catch {
    return { ok: false, secretMissing: true, errorCode: "EDGE_UNREACHABLE" };
  }
}

async function callServerGroqCompletion(params: {
  apiKey: string;
  model: string;
  messages: GroqChatMessagePayload[];
  tools?: Array<Record<string, unknown>>;
  jsonMode?: boolean;
  temperature?: number;
  fetchFn?: typeof fetch;
}): Promise<{
  ok: boolean;
  status: number;
  modelUsed: string;
  message?: {
    role?: string;
    content?: string | null;
    tool_calls?: GroqToolCallPayload[];
  };
  errorCode?: string;
}> {
  const fetchImpl = params.fetchFn ?? fetch;
  const modelToUse = params.model.trim() || DEFAULT_GROQ_MODEL;
  const hasTools = Boolean(params.tools && params.tools.length > 0);
  const useJsonMode =
    Boolean(params.jsonMode) &&
    !hasTools &&
    supportsGroqJsonObjectMode(modelToUse);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchImpl(GROQ_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${params.apiKey}`,
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: params.messages,
          temperature: params.temperature ?? 0.2,
          ...(hasTools
            ? {
                tools: params.tools,
                tool_choice: "auto",
              }
            : {}),
          ...(useJsonMode
            ? { response_format: { type: "json_object" } }
            : {}),
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (res.status === 429 && attempt === 0) {
        const retryAfterSec = Number.parseFloat(
          res.headers.get("retry-after") || "4",
        );
        const waitMs = Math.min(Math.max(retryAfterSec * 1000, 1500), 7000);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      if (res.ok) {
        const json = (await res.json()) as {
          model?: string;
          choices?: Array<{
            message?: {
              role?: string;
              content?: string | null;
              tool_calls?: GroqToolCallPayload[];
            };
          }>;
        };
        const firstMessage = json.choices?.[0]?.message;
        if (!firstMessage) {
          return {
            ok: false,
            status: 502,
            modelUsed: json.model || modelToUse,
            errorCode: "GROQ_EMPTY_RESPONSE",
          };
        }
        return {
          ok: true,
          status: 200,
          modelUsed: json.model || modelToUse,
          message: firstMessage,
        };
      }

      let errCode = "";
      let errMessage = "";
      let failedGeneration: string | undefined;
      try {
        const errBody = (await res.json()) as {
          error?: {
            code?: string;
            type?: string;
            message?: string;
            failed_generation?: string;
          };
        };
        errCode = (
          errBody.error?.code ||
          errBody.error?.type ||
          ""
        ).toLowerCase();
        errMessage = (errBody.error?.message || "").toLowerCase();
        failedGeneration = errBody.error?.failed_generation;
      } catch {
        // Ignore non-JSON error body
      }

      if (res.status === 400 && errCode === "tool_use_failed") {
        const recovered = parseRecoveredXmlToolCalls(failedGeneration);
        if (recovered.length > 0) {
          return {
            ok: true,
            status: 200,
            modelUsed: modelToUse,
            message: {
              role: "assistant",
              content: null,
              tool_calls: recovered,
            },
          };
        }
      }

      const isModelUnavailable =
        errCode.includes("model_not_found") ||
        errCode.includes("model_decommissioned") ||
        (res.status === 404 && errMessage.includes("model"));

      const mappedCode =
        res.status === 401 || res.status === 403
          ? "GROQ_INVALID_API_KEY"
          : isModelUnavailable
            ? "GROQ_INVALID_MODEL"
            : res.status === 404
              ? "GROQ_ENDPOINT_NOT_FOUND"
              : res.status === 429
                ? "GROQ_RATE_LIMITED"
                : res.status >= 400 && res.status < 500
                  ? "GROQ_INVALID_REQUEST"
                  : `GROQ_HTTP_${res.status}`;

      return {
        ok: false,
        status: res.status,
        modelUsed: modelToUse,
        errorCode: mappedCode,
      };
    } catch (err) {
      const errName =
        err instanceof Error && err.name
          ? err.name.toUpperCase()
          : "NETWORK_ERROR";
      const isTimeout =
        errName.includes("TIMEOUT") || errName.includes("ABORT");
      return {
        ok: false,
        status: isTimeout ? 504 : 502,
        modelUsed: modelToUse,
        errorCode: isTimeout ? "GROQ_TIMEOUT" : `GROQ_${errName}`,
      };
    }
  }

  return {
    ok: false,
    status: 429,
    modelUsed: modelToUse,
    errorCode: "GROQ_RATE_LIMITED",
  };
}

export async function callServerAiProvider(params: {
  systemInstruction: string;
  userPrompt: string;
  fallbackResponse: string;
  jsonMode?: boolean;
  mediaParts?: AiInlineMediaPart[];
}): Promise<{
  text: string;
  provider: string;
  transcribedAudioText?: string;
  providerFailed?: boolean;
  errorStatus?: number;
  errorCode?: string;
}> {
  const mediaParts = params.mediaParts ?? [];

  // 1. Primary: Centralized Supabase Edge Function (`learnix-ai`) backed by Groq Edge Function Secrets
  const edgeRes = await invokeLearnixAiEdgeFunction({
    mode: "generate",
    systemInstruction: params.systemInstruction,
    userPrompt: params.userPrompt,
    jsonMode: params.jsonMode ?? false,
    mediaParts,
  });

  if (edgeRes.ok && edgeRes.text?.trim()) {
    const candidateText = stripThinkingAndJsonFences(
      edgeRes.text,
      Boolean(params.jsonMode),
    );

    if (params.jsonMode) {
      try {
        JSON.parse(candidateText);
        return {
          text: candidateText,
          provider: edgeRes.provider ?? `edge:groq:${DEFAULT_GROQ_MODEL}`,
        };
      } catch {
        // Fall through to local Groq fallback or safe fallback if malformed JSON
      }
    } else {
      return {
        text: candidateText,
        provider: edgeRes.provider ?? `edge:groq:${DEFAULT_GROQ_MODEL}`,
      };
    }
  }

  // 2. Server-only Groq API fallback (for local development when GROQ_API_KEY is configured in .env.local)
  const groqKey = (process.env.GROQ_API_KEY ?? "").trim();
  const groqModel = (process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL).trim();
  const aiProvider = (process.env.AI_PROVIDER || "groq").trim().toLowerCase();

  let lastFailure: { status?: number; code: string } | null =
    !edgeRes.ok && !edgeRes.secretMissing && edgeRes.errorCode
      ? { status: edgeRes.status, code: edgeRes.errorCode }
      : null;

  if (
    aiProvider === "groq" &&
    groqKey &&
    !groqKey.toLowerCase().includes("your_groq_api_key")
  ) {
    const transcribedAudioSegments: string[] = [];
    const audioParts = mediaParts.filter((m) => m.kind === "audio");

    for (const audio of audioParts) {
      try {
        const audioBuffer = Buffer.from(audio.base64Data, "base64");
        const blob = new Blob([audioBuffer], { type: audio.mimeType });
        const form = new FormData();
        form.append("file", blob, audio.fileName || "recording.webm");
        form.append("model", "whisper-large-v3-turbo");

        const whisperRes = await fetch(GROQ_AUDIO_TRANSCRIPTIONS_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${groqKey}` },
          body: form,
          signal: AbortSignal.timeout(20000),
        });
        if (whisperRes.ok) {
          const wJson = (await whisperRes.json()) as { text?: string };
          if (wJson.text?.trim()) {
            transcribedAudioSegments.push(
              `[Audio Transcription (${audio.fileName})]: ${wJson.text.trim()}`,
            );
          }
        }
      } catch {
        // Non-fatal audio transcription failure
      }
    }

    const attachmentNotes = mediaParts
      .filter((m) => m.kind !== "audio")
      .map((m) => `[Attached File Metadata: ${m.fileName} (${m.mimeType})]`);

    const combinedUserPrompt = [
      params.userPrompt,
      ...transcribedAudioSegments,
      ...attachmentNotes,
    ]
      .filter(Boolean)
      .join("\n\n");

    let systemContent = params.systemInstruction.trim();
    if (
      params.jsonMode &&
      !/\bjson\b/i.test(`${systemContent} ${combinedUserPrompt}`)
    ) {
      systemContent = `${systemContent}\nRespond strictly with a valid JSON object.`;
    }

    const groqRes = await callServerGroqCompletion({
      apiKey: groqKey,
      model: groqModel,
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: combinedUserPrompt },
      ],
      jsonMode: params.jsonMode,
      temperature: 0.2,
    });

    if (groqRes.ok && groqRes.message?.content?.trim()) {
      const cleaned = stripThinkingAndJsonFences(
        groqRes.message.content,
        Boolean(params.jsonMode),
      );

      if (params.jsonMode) {
        try {
          JSON.parse(cleaned);
          return {
            text: cleaned,
            provider: `groq:${groqRes.modelUsed}`,
            transcribedAudioText:
              transcribedAudioSegments.length > 0
                ? transcribedAudioSegments.join("\n")
                : undefined,
          };
        } catch {
          lastFailure = { status: 502, code: "GROQ_MALFORMED_JSON" };
        }
      } else {
        return {
          text: cleaned,
          provider: `groq:${groqRes.modelUsed}`,
          transcribedAudioText:
            transcribedAudioSegments.length > 0
              ? transcribedAudioSegments.join("\n")
              : undefined,
        };
      }
    } else {
      lastFailure = {
        status: groqRes.status,
        code: groqRes.errorCode ?? "GROQ_GENERATE_FAILED",
      };
    }
  }

  if (lastFailure) {
    return {
      text: params.fallbackResponse,
      provider: "provider-error-fallback",
      providerFailed: true,
      errorStatus: lastFailure.status,
      errorCode: lastFailure.code,
    };
  }

  return {
    text: params.fallbackResponse,
    provider: "learnix-grounded-rag",
  };
}

export interface AiAgentHistoryTurn {
  sender: "user" | "assistant";
  content: string;
}

export interface AiAgentFunctionDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AiAgentToolExecutionOutcome {
  toolName: string;
  ok: boolean;
  data: Record<string, unknown>;
  citations: AiCitation[];
  summaryTextEn: string;
  summaryTextAr: string;
}

/**
 * Unified Groq Agentic Loop using OpenAI-compatible Tool Calling (`llama-3.3-70b-versatile`)
 * via the centralized `learnix-ai` Supabase Edge Function.
 */
export async function runStudentAiAgentLoop(params: {
  systemInstruction: string;
  conversationHistory: AiAgentHistoryTurn[];
  userPrompt: string;
  mediaParts?: AiInlineMediaPart[];
  tools: AiAgentFunctionDeclaration[];
  executeTool: (
    toolName: string,
    rawArgs: Record<string, unknown> | undefined,
  ) => Promise<AiAgentToolExecutionOutcome>;
  maxIterations?: number;
  customFetch?: typeof fetch;
}): Promise<{
  text: string;
  provider: string;
  calledTools: Array<{
    toolName: string;
    args: Record<string, unknown>;
    ok: boolean;
  }>;
  toolOutcomes: AiAgentToolExecutionOutcome[];
  citations: AiCitation[];
  providerFailed: boolean;
  errorStatus?: number;
  errorCode?: string;
}> {
  const groqKey = (process.env.GROQ_API_KEY ?? "").trim();
  const configuredModel = (
    process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL
  ).trim();
  const maxIterations = Math.min(Math.max(params.maxIterations ?? 4, 1), 6);

  const calledTools: Array<{
    toolName: string;
    args: Record<string, unknown>;
    ok: boolean;
  }> = [];
  const toolOutcomes: AiAgentToolExecutionOutcome[] = [];
  const collectedCitations: AiCitation[] = [];
  const executedCallCache = new Map<string, AiAgentToolExecutionOutcome>();

  const hasLocalGroqKey =
    Boolean(groqKey) && !groqKey.toLowerCase().includes("your_groq_api_key");

  const normalizedTools = formatFunctionDeclarationsForGroq(params.tools);

  const messages: GroqChatMessagePayload[] = [];
  for (const turn of params.conversationHistory) {
    const cleanText = turn.content.trim();
    if (!cleanText) continue;
    messages.push({
      role: turn.sender === "user" ? "user" : "assistant",
      content: cleanText.slice(0, 1800),
    });
  }

  const nonDocAttachmentNotes = (params.mediaParts ?? []).map(
    (m) => `[Attached ${m.kind}: ${m.fileName} (${m.mimeType})]`,
  );
  const currentTurnContent = [params.userPrompt, ...nonDocAttachmentNotes]
    .filter(Boolean)
    .join("\n\n");

  messages.push({
    role: "user",
    content: currentTurnContent,
  });

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    try {
      let assistantMsg: {
        role?: string;
        content?: string | null;
        tool_calls?: GroqToolCallPayload[];
      } | null = null;
      let resolvedProvider = `edge:groq:${configuredModel}`;

      // 1. Primary: Invoke Supabase Edge Function (`learnix-ai`) unless customFetch is injected for tests
      if (!params.customFetch) {
        const edgeTurn = await invokeLearnixAiEdgeFunction({
          mode: "agent_turn",
          systemInstruction: params.systemInstruction,
          messages,
          tools: normalizedTools,
          temperature: 0.2,
        });

        if (edgeTurn.ok && edgeTurn.message) {
          assistantMsg = edgeTurn.message;
          resolvedProvider =
            edgeTurn.provider ?? `edge:groq:${DEFAULT_GROQ_MODEL}`;
        } else if (!edgeTurn.secretMissing && !hasLocalGroqKey) {
          return {
            text: "",
            provider: "provider-error-fallback",
            calledTools,
            toolOutcomes,
            citations: collectedCitations,
            providerFailed: true,
            errorStatus: edgeTurn.status,
            errorCode: edgeTurn.errorCode ?? "GROQ_EDGE_AGENT_ERROR",
          };
        }
      }

      // 2. Server-only Groq fallback when GROQ_API_KEY is configured locally or customFetch is provided
      if (!assistantMsg) {
        if (!hasLocalGroqKey && !params.customFetch) {
          return {
            text: "",
            provider: "groq-unconfigured",
            calledTools,
            toolOutcomes,
            citations: collectedCitations,
            providerFailed: true,
            errorCode: "GROQ_KEY_NOT_CONFIGURED",
          };
        }

        const serverRes = await callServerGroqCompletion({
          apiKey: groqKey || "test-groq-key",
          model: configuredModel,
          messages: [
            { role: "system", content: params.systemInstruction },
            ...messages,
          ],
          tools: normalizedTools,
          temperature: 0.2,
          fetchFn: params.customFetch,
        });

        if (!serverRes.ok || !serverRes.message) {
          return {
            text: "",
            provider: "provider-error-fallback",
            calledTools,
            toolOutcomes,
            citations: collectedCitations,
            providerFailed: true,
            errorStatus: serverRes.status,
            errorCode: serverRes.errorCode ?? "GROQ_AGENT_ERROR",
          };
        }

        assistantMsg = serverRes.message;
        resolvedProvider = `groq:${serverRes.modelUsed}`;
      }

      const rawToolCalls = Array.isArray(assistantMsg.tool_calls)
        ? assistantMsg.tool_calls
        : [];

      if (rawToolCalls.length === 0) {
        const finalText = stripThinkingAndJsonFences(
          assistantMsg.content ?? "",
          false,
        );
        if (finalText) {
          return {
            text: finalText,
            provider: resolvedProvider,
            calledTools,
            toolOutcomes,
            citations: collectedCitations,
            providerFailed: false,
          };
        }

        return {
          text: "",
          provider: "provider-error-fallback",
          calledTools,
          toolOutcomes,
          citations: collectedCitations,
          providerFailed: true,
          errorCode: "GROQ_EMPTY_TEXT",
        };
      }

      // Append assistant message with tool_calls into the OpenAI-compatible conversation history
      messages.push({
        role: "assistant",
        content: assistantMsg.content ?? null,
        tool_calls: rawToolCalls,
      });

      for (const tc of rawToolCalls) {
        const fnName = tc.function?.name?.trim() ?? "";
        const callId = tc.id || `call_${iteration}_${fnName}`;
        let parsedArgs: Record<string, unknown> = {};
        if (tc.function?.arguments) {
          try {
            const decoded = JSON.parse(tc.function.arguments);
            if (decoded && typeof decoded === "object" && !Array.isArray(decoded)) {
              parsedArgs = decoded as Record<string, unknown>;
            }
          } catch {
            parsedArgs = {};
          }
        }

        const dedupeKey = `${fnName}::${JSON.stringify(parsedArgs)}`;
        let outcome = executedCallCache.get(dedupeKey);

        if (!outcome) {
          outcome = await params.executeTool(fnName, parsedArgs);
          executedCallCache.set(dedupeKey, outcome);
          toolOutcomes.push(outcome);
          calledTools.push({
            toolName: fnName,
            args: parsedArgs,
            ok: outcome.ok,
          });
          for (const cit of outcome.citations) {
            if (
              !collectedCitations.some(
                (existing) =>
                  existing.sourceTitle === cit.sourceTitle &&
                  existing.excerpt === cit.excerpt,
              )
            ) {
              collectedCitations.push(cit);
            }
          }
        }

        messages.push({
          role: "tool",
          tool_call_id: callId,
          name: fnName,
          content: JSON.stringify({
            ok: outcome.ok,
            result: outcome.data,
          }),
        });
      }
    } catch (err) {
      const rawName =
        err instanceof Error && err.name ? err.name.toUpperCase() : "NETWORK_ERROR";
      const isTimeout =
        rawName.includes("TIMEOUT") || rawName.includes("ABORT");
      return {
        text: "",
        provider: "provider-error-fallback",
        calledTools,
        toolOutcomes,
        citations: collectedCitations,
        providerFailed: true,
        errorCode: isTimeout ? "GROQ_REQUEST_TIMEOUT" : `GROQ_${rawName}`,
      };
    }
  }

  return {
    text: "",
    provider: "provider-error-fallback",
    calledTools,
    toolOutcomes,
    citations: collectedCitations,
    providerFailed: true,
    errorCode: "GROQ_MAX_TOOL_ITERATIONS_REACHED",
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
  userStructuredPayload?: Record<string, unknown> | null;
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
    structured_payload: (params.userStructuredPayload ?? null) as Json,
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
