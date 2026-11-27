import "server-only";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { COURSE_CATEGORIES } from "@/lib/constants/categories";
import {
  computeVerifiedCourseDuration,
  expandSemanticQueryTerms,
  getVerifiedPlatformHelpContext,
  retrieveGroundedCourseContext,
  type AiCitation,
  type VerifiedCourseDurationInfo,
} from "@/services/ai/engine";

export interface AiFunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: "OBJECT";
    properties: Record<
      string,
      {
        type: "STRING" | "NUMBER" | "INTEGER" | "BOOLEAN" | "ARRAY";
        description: string;
        enum?: string[];
        items?: { type: "STRING" };
      }
    >;
    required?: string[];
  };
}

export interface StudentToolExecutionContext {
  /** Strictly derived from the authenticated Supabase server session (`auth.data.userId`). Never trusted from model arguments. */
  authenticatedStudentId: string;
  studentDisplayName: string;
  selectedCourseId: string | null;
}

export interface StudentToolExecutionResult {
  toolName: string;
  ok: boolean;
  data: Record<string, unknown>;
  citations: AiCitation[];
  summaryTextEn: string;
  summaryTextAr: string;
}

/**
 * Structured Function Declarations for the Unified Learnix Student AI Agent (Groq `llama-3.3-70b-versatile`).
 * Every tool is backed by existing Supabase tables (`src/types/database.ts`) and strictly enforced server-side.
 */
export const STUDENT_AI_TOOLS: AiFunctionDeclaration[] = [
  // --- 1. Course Catalog ---
  {
    name: "search_published_courses",
    description:
      "Search or list published courses in the Learnix catalog by topic, keyword, or category.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: {
          type: "STRING",
          description: "Optional topic, title, code, or keyword (Arabic or English).",
        },
        category: {
          type: "STRING",
          description: "Optional category name filter.",
        },
      },
    },
  },
  {
    name: "get_published_course_details",
    description:
      "Get public catalog details for a published course (title, code, category, hours, passing score, instructor, enrollment status).",
    parameters: {
      type: "OBJECT",
      properties: {
        courseIdentifier: {
          type: "STRING",
          description: "Course UUID, code, title, or topic keyword.",
        },
      },
      required: ["courseIdentifier"],
    },
  },
  {
    name: "compare_published_courses",
    description:
      "Compare two or more published courses side by side using catalog metadata.",
    parameters: {
      type: "OBJECT",
      properties: {
        courseIdentifiers: {
          type: "ARRAY",
          description: "Two or more course codes, titles, UUIDs, or keywords.",
          items: { type: "STRING" },
        },
      },
      required: ["courseIdentifiers"],
    },
  },
  {
    name: "get_available_course_categories",
    description:
      "List all course categories on Learnix with published course counts.",
    parameters: {
      type: "OBJECT",
      properties: {},
    },
  },

  // --- 2. Student Enrollment ---
  {
    name: "get_my_enrolled_courses",
    description:
      "Get the student's enrolled courses, status, and completion progress.",
    parameters: {
      type: "OBJECT",
      properties: {},
    },
  },
  {
    name: "get_my_enrollment_details",
    description:
      "Get detailed progress and lesson completion count for an enrolled course.",
    parameters: {
      type: "OBJECT",
      properties: {
        courseIdentifier: {
          type: "STRING",
          description: "Course UUID, code, title, or keyword.",
        },
      },
      required: ["courseIdentifier"],
    },
  },

  // --- 3. Assignments ---
  {
    name: "get_my_assignments",
    description:
      "List published assignments across enrolled courses with due dates, points, and submission status.",
    parameters: {
      type: "OBJECT",
      properties: {
        courseIdentifier: {
          type: "STRING",
          description: "Optional course code, title, or UUID.",
        },
      },
    },
  },
  {
    name: "get_assignment_details",
    description:
      "Get full details and submission status for a specific published assignment.",
    parameters: {
      type: "OBJECT",
      properties: {
        assignmentIdentifier: {
          type: "STRING",
          description: "Assignment UUID, title, or course code/title.",
        },
      },
      required: ["assignmentIdentifier"],
    },
  },
  {
    name: "get_assignment_submission_status",
    description:
      "Check the student's assignment submission status, grade, and teacher feedback.",
    parameters: {
      type: "OBJECT",
      properties: {
        assignmentIdentifier: {
          type: "STRING",
          description: "Optional assignment UUID or title.",
        },
      },
    },
  },

  // --- 4. Exams ---
  {
    name: "get_my_exams",
    description:
      "List published exams/quizzes for enrolled courses with duration, marks, attempts, and status.",
    parameters: {
      type: "OBJECT",
      properties: {
        courseIdentifier: {
          type: "STRING",
          description: "Optional course code, title, or UUID.",
        },
      },
    },
  },
  {
    name: "get_exam_details",
    description:
      "Get metadata, instructions, duration, and attempt count for a published exam.",
    parameters: {
      type: "OBJECT",
      properties: {
        examIdentifier: {
          type: "STRING",
          description: "Exam UUID, title, or course code/title.",
        },
      },
      required: ["examIdentifier"],
    },
  },
  {
    name: "get_my_exam_results",
    description:
      "Get the student's published exam scores, pass/fail status, and feedback.",
    parameters: {
      type: "OBJECT",
      properties: {
        courseIdentifier: {
          type: "STRING",
          description: "Optional course code, title, or UUID.",
        },
      },
    },
  },

  // --- 5. Academic Performance ---
  {
    name: "get_my_grades",
    description:
      "Get consolidated exam and assignment grades plus overall average.",
    parameters: {
      type: "OBJECT",
      properties: {
        courseIdentifier: {
          type: "STRING",
          description: "Optional course code, title, or UUID.",
        },
      },
    },
  },
  {
    name: "get_my_academic_progress",
    description:
      "Get course completion percentages, completed lessons, study hours, notes, and certificates.",
    parameters: {
      type: "OBJECT",
      properties: {},
    },
  },
  {
    name: "get_my_attendance",
    description:
      "Get class attendance rate and session records.",
    parameters: {
      type: "OBJECT",
      properties: {
        courseIdentifier: {
          type: "STRING",
          description: "Optional course code, title, or UUID.",
        },
      },
    },
  },
  {
    name: "get_my_academic_report",
    description:
      "Generate a comprehensive personal academic report across courses, exams, assignments, attendance, and study hours.",
    parameters: {
      type: "OBJECT",
      properties: {},
    },
  },

  // --- 6. Course Metadata & Verified Duration ---
  {
    name: "get_course_duration",
    description:
      "Get verified duration (hours/minutes) of a published course.",
    parameters: {
      type: "OBJECT",
      properties: {
        courseIdentifier: {
          type: "STRING",
          description: "Course code, title, UUID, or keyword.",
        },
      },
      required: ["courseIdentifier"],
    },
  },
  {
    name: "get_course_metadata",
    description:
      "Get structured metadata and verified duration breakdown for a published course.",
    parameters: {
      type: "OBJECT",
      properties: {
        courseIdentifier: {
          type: "STRING",
          description: "Course code, title, UUID, or keyword.",
        },
      },
      required: ["courseIdentifier"],
    },
  },

  // --- 7. Enrolled Course Educational RAG Tool ---
  {
    name: "search_enrolled_course_content",
    description:
      "Search the student's enrolled course lessons, chapters, and uploaded documents (RAG).",
    parameters: {
      type: "OBJECT",
      properties: {
        query: {
          type: "STRING",
          description: "Topic, concept, or question to search.",
        },
        courseIdentifier: {
          type: "STRING",
          description: "Optional enrolled course UUID, code, or title.",
        },
      },
      required: ["query"],
    },
  },

  // --- 8. Verified Learnix Platform Help & Navigation Tool ---
  {
    name: "get_platform_help_and_navigation",
    description:
      "Get the official Learnix Platform Guide: navigation pages, enrolling, uploading files, voice recording, assignments, exams, and progress.",
    parameters: {
      type: "OBJECT",
      properties: {
        topic: {
          type: "STRING",
          description: "Optional Learnix feature or how-to topic.",
        },
      },
    },
  },
];

const ALLOWED_TOOL_NAMES = new Set(
  STUDENT_AI_TOOLS.map((t) => t.name),
);

export function isAllowedStudentAiTool(toolName: string): boolean {
  return ALLOWED_TOOL_NAMES.has(toolName);
}

// Strict Zod schemas for tool argument validation
const emptyObjectSchema = z.object({}).passthrough();

const optionalQuerySchema = z.object({
  query: z.string().trim().max(500).optional(),
  category: z.string().trim().max(120).optional(),
});

const courseIdentifierSchema = z.object({
  courseIdentifier: z.string().trim().min(1).max(300),
});

const optionalCourseIdentifierSchema = z.object({
  courseIdentifier: z.string().trim().max(300).optional(),
});

const compareCoursesSchema = z.object({
  courseIdentifiers: z.array(z.string().trim().min(1).max(300)).min(1).max(6),
});

const assignmentIdentifierSchema = z.object({
  assignmentIdentifier: z.string().trim().min(1).max(300),
});

const optionalAssignmentIdentifierSchema = z.object({
  assignmentIdentifier: z.string().trim().max(300).optional(),
  courseIdentifier: z.string().trim().max(300).optional(),
});

const examIdentifierSchema = z.object({
  examIdentifier: z.string().trim().min(1).max(300),
});

const ragSearchSchema = z.object({
  query: z.string().trim().min(1).max(1000),
  courseIdentifier: z.string().trim().max(300).optional(),
});

const optionalPlatformTopicSchema = z.object({
  topic: z.string().trim().max(500).optional(),
});

/**
 * Detects if tool arguments attempt to supply a spoofed student ID, request another student's private record,
 * or request private teacher email addresses.
 */
function checkPrivacyOrCrossStudentAccessAttempt(
  rawArgs: Record<string, unknown> | undefined,
): string | null {
  if (!rawArgs || typeof rawArgs !== "object") return null;

  // Reject any attempt by the model or caller to pass a studentId / userId argument
  const forbiddenArgKeys = [
    "studentid",
    "student_id",
    "userid",
    "user_id",
    "targetstudentid",
    "otherstudentid",
  ];
  for (const key of Object.keys(rawArgs)) {
    if (forbiddenArgKeys.includes(key.toLowerCase())) {
      return "Access denied: Student identity is derived strictly from the authenticated server session. Supplying a studentId or userId argument is prohibited.";
    }
  }

  const serialized = JSON.stringify(rawArgs).toLowerCase();
  const suspiciousPatterns = [
    "other student",
    "another student",
    "all students",
    "classmate",
    "student_id",
    "teacher email",
    "instructor email",
    "طالب آخر",
    "طالب تاني",
    "زميلي",
    "كل الطلاب",
    "درجات الطلاب",
    "ايميل الدكتور",
    "إيميل المحاضر",
    "بريد المحاضر",
  ];
  if (suspiciousPatterns.some((p) => serialized.includes(p))) {
    return "Access denied: Personal academic tools strictly return data belonging only to the authenticated student session, and private user email addresses are never exposed.";
  }
  return null;
}

/**
 * Identifier-format guard (not an intent router): true when the identifier is shaped like a course code
 * (e.g. "ARC-900") or a UUID, in which case only exact matches are acceptable.
 */
function isExplicitCourseCodeOrUuid(identifier: string): boolean {
  const t = identifier.trim();
  return (
    /^[a-z]{2,6}[-_ ]?\d{2,5}$/i.test(t) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)
  );
}

/**
 * Helper to score and match courses by UUID, code, title, category, description, or semantic expansion terms.
 */
function matchCoursesByIdentifier<
  T extends {
    id: string;
    code: string;
    title: string;
    subtitle?: string | null;
    description?: string | null;
    category: string;
    completion_requirements?: string | null;
  },
>(courses: T[], identifier: string): Array<T & { matchScore: number }> {
  const trimmed = identifier.trim();
  if (!trimmed) {
    return courses.map((c) => ({ ...c, matchScore: 1 }));
  }

  const lowerId = trimmed.toLowerCase();

  // 1. Exact ID or exact course code match
  const exact = courses.filter(
    (c) =>
      c.id.toLowerCase() === lowerId || c.code.toLowerCase() === lowerId,
  );
  if (exact.length > 0) {
    return exact.map((c) => ({ ...c, matchScore: 100 }));
  }

  // An explicit course-code-shaped or UUID-shaped identifier that matched nothing exactly must not
  // fall back to fuzzy matching (prevents e.g. "ARC-900" from matching unrelated "architecture" courses).
  // This is an identifier-format guard, not a question/intent router.
  if (isExplicitCourseCodeOrUuid(trimmed)) {
    return [];
  }

  const { directTerms, semanticTerms } = expandSemanticQueryTerms(trimmed);
  const isBroadProgramming =
    lowerId.includes("programming") ||
    lowerId.includes("coding") ||
    lowerId.includes("software") ||
    lowerId.includes("برمجة") ||
    lowerId.includes("البرمجة");

  const scored = courses
    .map((c) => {
      const codeTitleCat = [c.code, c.title, c.subtitle, c.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const fullHay = [
        codeTitleCat,
        c.description,
        c.completion_requirements,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      let score = 0;
      if (codeTitleCat.includes(lowerId)) score += 25;
      else if (fullHay.includes(lowerId)) score += 15;

      for (const term of directTerms) {
        if (codeTitleCat.includes(term)) score += 10;
        else if (fullHay.includes(term)) score += 6;
      }
      for (const term of semanticTerms) {
        if (!directTerms.includes(term)) {
          if (codeTitleCat.includes(term)) score += 7;
          else if (fullHay.includes(term)) score += 4;
        }
      }
      if (
        isBroadProgramming &&
        ["it", "mobile app", "web", "java", "database", "testing", "iot"].includes(
          c.category.toLowerCase(),
        )
      ) {
        score += 6;
      }

      return { ...c, matchScore: score };
    })
    .filter((c) => c.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore);

  return scored;
}

/**
 * Executes an allowlisted Learnix Student AI tool using the authenticated Supabase server client.
 * Enforces strict student data isolation (`authenticatedStudentId` from session),
 * teacher email privacy (`id, full_name` only), course status checks (`status = 'published'`),
 * and enrollment verification before accessing `chapters`, `lessons`, or `ai_document_chunks`.
 */
export async function executeStudentAiTool(params: {
  toolName: string;
  rawArgs: Record<string, unknown> | undefined;
  context: StudentToolExecutionContext;
}): Promise<StudentToolExecutionResult> {
  const { toolName, rawArgs = {}, context } = params;
  const studentId = context.authenticatedStudentId;

  if (!isAllowedStudentAiTool(toolName)) {
    return {
      toolName,
      ok: false,
      data: {
        error: "UNSUPPORTED_TOOL",
        message: `Tool "${toolName}" is not in the server allowlist.`,
      },
      citations: [],
      summaryTextEn: `Requested tool "${toolName}" is not supported.`,
      summaryTextAr: `الأداة المطلوبة "${toolName}" غير مدعومة.`,
    };
  }

  // Global privacy & cross-student argument check across all 19 tools
  const privacyViolation = checkPrivacyOrCrossStudentAccessAttempt(rawArgs);
  if (privacyViolation) {
    return {
      toolName,
      ok: false,
      data: {
        error: "AUTHORIZATION_DENIED",
        message: privacyViolation,
      },
      citations: [],
      summaryTextEn: privacyViolation,
      summaryTextAr:
        "تم رفض الوصول: بيانات الطلاب الآخرين والبريد الإلكتروني الخاص بالمحاضرين محمية ولا يمكن الاطلاع عليها.",
    };
  }

  const supabase = await createSupabaseServerClient();

  try {
    // Fetch authenticated student's enrollment rows once and verify which enrolled courses are currently published (`status = 'published'`)
    const { data: enrollmentRows } = await supabase
      .from("course_enrollments")
      .select(
        "id, course_id, status, progress_percent, enrolled_at, completed_at, last_accessed_at",
      )
      .eq("student_id", studentId)
      .order("enrolled_at", { ascending: false });

    const rawEnrollments = enrollmentRows ?? [];
    const rawEnrolledCourseIds = rawEnrollments.map((e) => e.course_id);

    // Fetch course status for enrolled courses so archived/draft courses are never exposed even if historically enrolled
    const enrolledCoursesMetaRes =
      rawEnrolledCourseIds.length > 0
        ? await supabase
            .from("courses")
            .select(
              "id, code, title, subtitle, description, category, completion_requirements, estimated_hours, passing_score, language, status, teacher_id",
            )
            .in("id", rawEnrolledCourseIds)
            .eq("status", "published")
        : {
            data: [] as Array<{
              id: string;
              code: string;
              title: string;
              subtitle: string | null;
              description: string | null;
              category: string;
              completion_requirements: string | null;
              estimated_hours: number;
              passing_score: number;
              language: string;
              status: string;
              teacher_id: string;
            }>,
          };

    const publishedEnrolledCourses = enrolledCoursesMetaRes.data ?? [];
    const publishedEnrolledCourseMap = new Map(
      publishedEnrolledCourses.map((c) => [c.id, c]),
    );

    // Filter active enrollments strictly to published courses (`status = 'published'`)
    const enrollments = rawEnrollments.filter((e) =>
      publishedEnrolledCourseMap.has(e.course_id),
    );
    const enrolledCourseIds = enrollments.map((e) => e.course_id);
    const enrolledSet = new Set(enrolledCourseIds);

    switch (toolName) {
      // =====================================================================
      // 1. COURSE CATALOG TOOLS (Public metadata of `status = 'published'`)
      // =====================================================================
      case "search_published_courses": {
        const parsed = optionalQuerySchema.safeParse(rawArgs);
        if (!parsed.success) {
          return {
            toolName,
            ok: false,
            data: {
              error: "INVALID_ARGUMENTS",
              message: "Invalid search arguments.",
            },
            citations: [],
            summaryTextEn: "Invalid search parameters provided.",
            summaryTextAr: "معاملات البحث غير صالحة.",
          };
        }
        const query = parsed.data.query ?? "";
        const categoryFilter = parsed.data.category ?? "";

        const { data: publishedRows, error } = await supabase
          .from("courses")
          .select(
            "id, code, title, subtitle, description, category, completion_requirements, estimated_hours, language, passing_score, teacher_id",
          )
          .eq("status", "published")
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw new Error("Failed to query published courses.");

        const rows = publishedRows ?? [];
        const teacherIds = Array.from(new Set(rows.map((r) => r.teacher_id)));
        // PRIVACY RULE: Select ONLY `id, full_name` from `profiles`. Never select or fall back to teacher `email`.
        const profilesRes =
          teacherIds.length > 0
            ? await supabase
                .from("profiles")
                .select("id, full_name")
                .in("id", teacherIds)
            : {
                data: [] as Array<{
                  id: string;
                  full_name: string | null;
                }>,
              };
        const teacherMap = new Map(
          (profilesRes.data ?? []).map((p) => [
            p.id,
            p.full_name?.trim() || "Learnix Instructor",
          ]),
        );

        let filtered = rows;
        if (categoryFilter) {
          const catLower = categoryFilter.toLowerCase();
          filtered = filtered.filter(
            (c) =>
              c.category.toLowerCase().includes(catLower) ||
              catLower.includes(c.category.toLowerCase()),
          );
        }

        const matched = query
          ? matchCoursesByIdentifier(filtered, query)
          : filtered.map((c) => ({ ...c, matchScore: 1 }));

        const finalCourses = (
          matched.length > 0
            ? matched
            : filtered.map((c) => ({ ...c, matchScore: 0 }))
        ).map((c) => ({
          id: c.id,
          code: c.code,
          title: c.title,
          subtitle: c.subtitle,
          description: c.description,
          category: c.category,
          completionRequirements: c.completion_requirements,
          estimatedHours: Number(c.estimated_hours ?? 0),
          language: c.language,
          passingScore: Number(c.passing_score ?? 60),
          instructorName:
            teacherMap.get(c.teacher_id) || "Learnix Instructor",
          isEnrolled: enrolledSet.has(c.id),
          matchScore: c.matchScore,
        }));

        const citations: AiCitation[] = finalCourses.slice(0, 6).map((c) => ({
          sourceTitle: `Catalog: ${c.code} — ${c.title} (${c.category})`,
          sourceType: "catalog",
          excerpt: `${c.description || c.subtitle || "Published course"} • Estimated Hours: ${c.estimatedHours > 0 ? `${c.estimatedHours}h` : "Not specified in course field"} • Instructor: ${c.instructorName}`,
        }));

        const listEn =
          finalCourses.length > 0
            ? finalCourses
                .map(
                  (c, idx) =>
                    `${idx + 1}. **${c.code} — ${c.title}** (Category: \`${c.category}\` | Instructor: ${c.instructorName} | Estimated Hours: ${c.estimatedHours > 0 ? `${c.estimatedHours}h` : "Not recorded in course field"} | Status: ${c.isEnrolled ? "Enrolled" : "Available in Explore Courses"})\n   - ${c.description || c.subtitle || "No description provided."}`,
                )
                .join("\n")
            : "No published courses matched in the catalog.";

        const listAr =
          finalCourses.length > 0
            ? finalCourses
                .map(
                  (c, idx) =>
                    `${idx + 1}. **${c.code} — ${c.title}** (التصنيف: \`${c.category}\` | المحاضر: ${c.instructorName} | الساعات المقدرة: ${c.estimatedHours > 0 ? `${c.estimatedHours} ساعة` : "غير مسجلة في حقل ساعات الدورة"} | الحالة: ${c.isEnrolled ? "مسجل فيها" : "متاحة في استكشاف الدورات"})\n   - ${c.description || c.subtitle || "لا يوجد وصف مسجل."}`,
                )
                .join("\n")
            : "لا توجد دورات منشورة مطابقة في الكتالوج.";

        return {
          toolName,
          ok: true,
          data: {
            totalPublishedCatalogCount: rows.length,
            matchedCount: finalCourses.length,
            specificQueryMatched: query ? matched.length > 0 : true,
            courses: finalCourses,
          },
          citations,
          summaryTextEn: `### Available Published Courses on Learnix (${finalCourses.length})\n\n${listEn}`,
          summaryTextAr: `### الدورات المنشورة المتاحة في منصة Learnix (${finalCourses.length})\n\n${listAr}`,
        };
      }

      case "get_published_course_details": {
        const parsed = courseIdentifierSchema.safeParse(rawArgs);
        if (!parsed.success) {
          return {
            toolName,
            ok: false,
            data: {
              error: "INVALID_ARGUMENTS",
              message: "Missing or invalid courseIdentifier.",
            },
            citations: [],
            summaryTextEn: "Please specify a valid course name or code.",
            summaryTextAr: "يرجى تحديد اسم الدورة أو رمزها بشكل صحيح.",
          };
        }

        // Strictly query ONLY `status = 'published'` courses from `public.courses`
        const { data: publishedRows } = await supabase
          .from("courses")
          .select(
            "id, code, title, subtitle, description, category, completion_requirements, estimated_hours, language, passing_score, teacher_id",
          )
          .eq("status", "published")
          .limit(50);

        const matched = matchCoursesByIdentifier(
          publishedRows ?? [],
          parsed.data.courseIdentifier,
        );

        if (matched.length === 0) {
          return {
            toolName,
            ok: true,
            data: {
              found: false,
              message: `No published course found matching "${parsed.data.courseIdentifier}". Unpublished, draft, or archived courses are not accessible.`,
            },
            citations: [],
            summaryTextEn: `No published course matching "${parsed.data.courseIdentifier}" was found in the Learnix catalog.`,
            summaryTextAr: `لم يتم العثور على دورة منشورة تطابق "${parsed.data.courseIdentifier}" في كتالوج Learnix.`,
          };
        }

        const topCourses = matched.slice(0, 3);
        const teacherIds = Array.from(
          new Set(topCourses.map((c) => c.teacher_id)),
        );

        // ENROLLMENT BOUNDARY: Only query `chapters` and `lessons` for courses in which the authenticated student is enrolled!
        // Public catalog queries (`get_published_course_details`) for non-enrolled students must NEVER retrieve chapter or lesson details.
        const enrolledTopCourseIds = topCourses
          .filter((c) => enrolledSet.has(c.id))
          .map((c) => c.id);

        const [profilesRes, chaptersRes, lessonsMetaRes] = await Promise.all([
          teacherIds.length > 0
            ? supabase
                .from("profiles")
                .select("id, full_name")
                .in("id", teacherIds)
            : Promise.resolve({
                data: [] as Array<{ id: string; full_name: string | null }>,
              }),
          enrolledTopCourseIds.length > 0
            ? supabase
                .from("chapters")
                .select("id, course_id, title, description, position")
                .in("course_id", enrolledTopCourseIds)
                .eq("is_published", true)
                .order("position", { ascending: true })
            : Promise.resolve({
                data: [] as Array<{
                  id: string;
                  course_id: string;
                  title: string;
                  description: string | null;
                  position: number;
                }>,
              }),
          enrolledTopCourseIds.length > 0
            ? supabase
                .from("lessons")
                .select("id, course_id, title, duration_seconds, is_published")
                .in("course_id", enrolledTopCourseIds)
                .eq("is_published", true)
            : Promise.resolve({
                data: [] as Array<{
                  id: string;
                  course_id: string;
                  title: string;
                  duration_seconds: number;
                  is_published: boolean;
                }>,
              }),
        ]);

        const teacherMap = new Map(
          (profilesRes.data ?? []).map((p) => [
            p.id,
            p.full_name?.trim() || "Learnix Instructor",
          ]),
        );

        const detailedList = topCourses.map((c) => {
          const isStudentEnrolled = enrolledSet.has(c.id);
          const courseChapters = isStudentEnrolled
            ? (chaptersRes.data ?? [])
                .filter((ch) => ch.course_id === c.id)
                .map((ch) => ({
                  position: ch.position,
                  title: ch.title,
                  description: ch.description,
                }))
            : [];
          const courseLessons = isStudentEnrolled
            ? (lessonsMetaRes.data ?? []).filter((l) => l.course_id === c.id)
            : [];

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

          return {
            id: c.id,
            code: c.code,
            title: c.title,
            subtitle: c.subtitle,
            description: c.description,
            category: c.category,
            completionRequirements: c.completion_requirements,
            estimatedHours: Number(c.estimated_hours ?? 0),
            verifiedDuration: durationInfo,
            language: c.language,
            passingScore: Number(c.passing_score ?? 60),
            instructorName:
              teacherMap.get(c.teacher_id) || "Learnix Instructor",
            isEnrolled: isStudentEnrolled,
            ...(isStudentEnrolled
              ? {
                  publishedChapters: courseChapters,
                  publishedLessonsCount: courseLessons.length,
                }
              : {
                  enrollmentRequiredForSyllabusNotice:
                    "Protected chapter and lesson details require enrollment in this course.",
                }),
          };
        });

        const citations: AiCitation[] = detailedList.map((c) => ({
          sourceTitle: `Catalog Details: ${c.code} — ${c.title}`,
          sourceType: "catalog",
          excerpt: `${c.description || c.subtitle || "Published course"} • ${c.verifiedDuration.explanationEn}`,
        }));

        const first = detailedList[0]!;
        return {
          toolName,
          ok: true,
          data: {
            found: true,
            multipleMatches: detailedList.length > 1,
            courses: detailedList,
          },
          citations,
          summaryTextEn: `### Course Details — ${first.code} (${first.title})\n- **Category:** ${first.category} | **Instructor:** ${first.instructorName}\n- **Enrollment Status:** ${first.isEnrolled ? "Enrolled" : "Not Enrolled (Available in Explore Courses)"}\n- **Description:** ${first.description || first.subtitle || "N/A"}\n- **Objectives:** ${first.completionRequirements || "N/A"}\n- **Verified Duration:** ${first.verifiedDuration.explanationEn}`,
          summaryTextAr: `### تفاصيل الدورة — ${first.code} (${first.title})\n- **التصنيف:** ${first.category} | **المحاضر:** ${first.instructorName}\n- **حالة التسجيل:** ${first.isEnrolled ? "مسجل في الدورة" : "غير مسجل (متاحة في استكشاف الدورات)"}\n- **الوصف:** ${first.description || first.subtitle || "غير متوفر"}\n- **أهداف التعلم:** ${first.completionRequirements || "غير متوفر"}\n- **المدة الموثقة:** ${first.verifiedDuration.explanationAr}`,
        };
      }

      case "compare_published_courses": {
        const parsed = compareCoursesSchema.safeParse(rawArgs);
        if (!parsed.success) {
          return {
            toolName,
            ok: false,
            data: {
              error: "INVALID_ARGUMENTS",
              message: "Provide at least one valid courseIdentifier to compare.",
            },
            citations: [],
            summaryTextEn: "Please specify which courses you want to compare.",
            summaryTextAr: "يرجى تحديد الدورات التي ترغب في المقارنة بينها.",
          };
        }

        const { data: publishedRows } = await supabase
          .from("courses")
          .select(
            "id, code, title, subtitle, description, category, completion_requirements, estimated_hours, language, passing_score, teacher_id",
          )
          .eq("status", "published")
          .limit(50);

        const rows = publishedRows ?? [];
        const teacherIds = Array.from(new Set(rows.map((r) => r.teacher_id)));
        const profilesRes =
          teacherIds.length > 0
            ? await supabase
                .from("profiles")
                .select("id, full_name")
                .in("id", teacherIds)
            : {
                data: [] as Array<{ id: string; full_name: string | null }>,
              };
        const teacherMap = new Map(
          (profilesRes.data ?? []).map((p) => [
            p.id,
            p.full_name?.trim() || "Learnix Instructor",
          ]),
        );

        const comparedMap = new Map<string, (typeof rows)[number]>();

        for (const ident of parsed.data.courseIdentifiers) {
          const matches = matchCoursesByIdentifier(rows, ident);
          if (matches[0]) {
            comparedMap.set(matches[0].id, matches[0]);
          }
        }

        const selectedCourses =
          comparedMap.size > 0
            ? Array.from(comparedMap.values())
            : rows.slice(0, 4);

        const comparisons = selectedCourses.map((c) => ({
          id: c.id,
          code: c.code,
          title: c.title,
          category: c.category,
          description: c.description || c.subtitle,
          completionRequirements: c.completion_requirements,
          estimatedHours: Number(c.estimated_hours ?? 0),
          language: c.language,
          passingScore: Number(c.passing_score ?? 60),
          instructorName:
            teacherMap.get(c.teacher_id) || "Learnix Instructor",
          isEnrolled: enrolledSet.has(c.id),
        }));

        const citations: AiCitation[] = comparisons.map((c) => ({
          sourceTitle: `Catalog Comparison: ${c.code} — ${c.title}`,
          sourceType: "catalog",
          excerpt: `Category: ${c.category} • Duration: ${c.estimatedHours}h • Instructor: ${c.instructorName} • ${c.description || ""}`,
        }));

        return {
          toolName,
          ok: true,
          data: {
            comparedCoursesCount: comparisons.length,
            courses: comparisons,
          },
          citations,
          summaryTextEn: `### Course Comparison (${comparisons.map((c) => c.code).join(" vs. ")})\n\n${comparisons
            .map(
              (c) =>
                `- **${c.code} — ${c.title}** (\`${c.category}\`, ${c.estimatedHours}h, Instructor: ${c.instructorName}, Passing: ${c.passingScore}%): ${c.description || "No description"}`,
            )
            .join("\n")}`,
          summaryTextAr: `### مقارنة الدورات (${comparisons.map((c) => c.code).join(" مقابل ")})\n\n${comparisons
            .map(
              (c) =>
                `- **${c.code} — ${c.title}** (\`${c.category}\`، ${c.estimatedHours} ساعة، المحاضر: ${c.instructorName}، درجة النجاح: ${c.passingScore}%): ${c.description || "لا يوجد وصف"}`,
            )
            .join("\n")}`,
        };
      }

      case "get_available_course_categories": {
        const parsed = emptyObjectSchema.safeParse(rawArgs);
        if (!parsed.success) {
          return {
            toolName,
            ok: false,
            data: { error: "INVALID_ARGUMENTS" },
            citations: [],
            summaryTextEn: "Invalid arguments.",
            summaryTextAr: "معاملات غير صالحة.",
          };
        }

        const { data: publishedRows } = await supabase
          .from("courses")
          .select("id, category, code, title")
          .eq("status", "published");

        const countsByCategory: Record<
          string,
          { count: number; sampleCourses: string[] }
        > = {};
        for (const cat of COURSE_CATEGORIES) {
          countsByCategory[cat] = { count: 0, sampleCourses: [] };
        }
        for (const r of publishedRows ?? []) {
          const key = r.category || "General";
          if (!countsByCategory[key]) {
            countsByCategory[key] = { count: 0, sampleCourses: [] };
          }
          countsByCategory[key]!.count += 1;
          countsByCategory[key]!.sampleCourses.push(`${r.code} (${r.title})`);
        }

        const activeCategories = Object.entries(countsByCategory)
          .filter(([, v]) => v.count > 0)
          .map(([category, v]) => ({
            category,
            publishedCoursesCount: v.count,
            courses: v.sampleCourses,
          }));

        return {
          toolName,
          ok: true,
          data: {
            supportedPlatformCategories: [...COURSE_CATEGORIES],
            activeCategoriesWithPublishedCourses: activeCategories,
            totalPublishedCourses: (publishedRows ?? []).length,
          },
          citations: [
            {
              sourceTitle: "Learnix Published Course Categories",
              sourceType: "catalog",
              excerpt: `Supported categories: ${COURSE_CATEGORIES.join(", ")}`,
            },
          ],
          summaryTextEn: `### Learnix Course Categories\n- **Supported Categories:** ${COURSE_CATEGORIES.join(", ")}\n- **Categories with Active Published Courses:** ${activeCategories.map((a) => `${a.category} (${a.publishedCoursesCount})`).join(", ") || "None"}`,
          summaryTextAr: `### تصنيفات الدورات في منصة Learnix\n- **التصنيفات المعتمدة:** ${COURSE_CATEGORIES.join("، ")}\n- **التصنيفات التي تحتوي على دورات منشورة حالياً:** ${activeCategories.map((a) => `${a.category} (${a.publishedCoursesCount})`).join("، ") || "لا يوجد"}`,
        };
      }

      // =====================================================================
      // 2. STUDENT ENROLLMENT TOOLS (Authenticated Student Only)
      // =====================================================================
      case "get_my_enrolled_courses": {
        const parsed = emptyObjectSchema.safeParse(rawArgs);
        if (!parsed.success) {
          return {
            toolName,
            ok: false,
            data: { error: "INVALID_ARGUMENTS" },
            citations: [],
            summaryTextEn: "Invalid arguments.",
            summaryTextAr: "معاملات غير صالحة.",
          };
        }

        if (enrolledCourseIds.length === 0) {
          return {
            toolName,
            ok: true,
            data: { enrolledCoursesCount: 0, enrolledCourses: [] },
            citations: [],
            summaryTextEn: "You are not currently enrolled in any published courses.",
            summaryTextAr: "أنت غير مسجل في أي دورة دراسية منشورة حالياً.",
          };
        }

        const enrolledList = enrollments.map((enr) => {
          const c = publishedEnrolledCourseMap.get(enr.course_id);
          return {
            courseId: enr.course_id,
            code: c?.code ?? "COURSE",
            title: c?.title ?? "Enrolled Course",
            category: c?.category ?? "General",
            estimatedHours: Number(c?.estimated_hours ?? 0),
            enrollmentStatus: enr.status,
            progressPercent: Number(enr.progress_percent ?? 0),
            enrolledAt: enr.enrolled_at,
            completedAt: enr.completed_at,
          };
        });

        return {
          toolName,
          ok: true,
          data: {
            enrolledCoursesCount: enrolledList.length,
            enrolledCourses: enrolledList,
          },
          citations: [
            {
              sourceTitle: "Authenticated Student Enrollments Record",
              sourceType: "student_record",
              excerpt: `Enrolled in ${enrolledList.length} course(s): ${enrolledList.map((c) => `${c.code} (${c.progressPercent}%)`).join(", ")}`,
            },
          ],
          summaryTextEn: `### Your Enrolled Courses (${enrolledList.length})\n${enrolledList.map((c) => `- **${c.code} — ${c.title}** (${c.category}): Progress **${c.progressPercent}%** (${c.enrollmentStatus})`).join("\n")}`,
          summaryTextAr: `### دوراتك المسجلة (${enrolledList.length})\n${enrolledList.map((c) => `- **${c.code} — ${c.title}** (${c.category}): نسبة الإنجاز **${c.progressPercent}%** (${c.enrollmentStatus})`).join("\n")}`,
        };
      }

      case "get_my_enrollment_details": {
        const parsed = courseIdentifierSchema.safeParse(rawArgs);
        if (!parsed.success) {
          return {
            toolName,
            ok: false,
            data: {
              error: "INVALID_ARGUMENTS",
              message: "Missing or invalid courseIdentifier.",
            },
            citations: [],
            summaryTextEn: "Please specify a valid course name or code.",
            summaryTextAr: "يرجى تحديد اسم الدورة أو رمزها.",
          };
        }

        if (enrolledCourseIds.length === 0) {
          return {
            toolName,
            ok: true,
            data: {
              enrolled: false,
              message: "No matching enrolled course found for your account.",
            },
            citations: [],
            summaryTextEn: "No matching enrolled course found for your account.",
            summaryTextAr: "لم يتم العثور على دورة مسجلة مطابقة في حسابك.",
          };
        }

        const matched = matchCoursesByIdentifier(
          publishedEnrolledCourses,
          parsed.data.courseIdentifier,
        );
        if (matched.length === 0) {
          return {
            toolName,
            ok: true,
            data: {
              enrolled: false,
              message: `You are not enrolled in an active published course matching "${parsed.data.courseIdentifier}".`,
            },
            citations: [],
            summaryTextEn: `You are not currently enrolled in an active published course matching "${parsed.data.courseIdentifier}".`,
            summaryTextAr: `أنت غير مسجل حالياً في دورة منشورة تطابق "${parsed.data.courseIdentifier}".`,
          };
        }

        const targetCourse = matched[0]!;
        const enr = enrollments.find((e) => e.course_id === targetCourse.id);

        const [totalLessonsRes, completedLessonsRes] = await Promise.all([
          supabase
            .from("lessons")
            .select("id", { count: "exact", head: true })
            .eq("course_id", targetCourse.id)
            .eq("is_published", true),
          supabase
            .from("lesson_progress")
            .select("id", { count: "exact", head: true })
            .eq("student_id", studentId)
            .eq("course_id", targetCourse.id)
            .eq("is_completed", true),
        ]);

        const details = {
          courseId: targetCourse.id,
          code: targetCourse.code,
          title: targetCourse.title,
          category: targetCourse.category,
          enrolled: true,
          enrollmentStatus: enr?.status ?? "active",
          progressPercent: Number(enr?.progress_percent ?? 0),
          enrolledAt: enr?.enrolled_at ?? null,
          completedAt: enr?.completed_at ?? null,
          completedLessonsCount: completedLessonsRes.count ?? 0,
          totalPublishedLessonsCount: totalLessonsRes.count ?? 0,
        };

        return {
          toolName,
          ok: true,
          data: details,
          citations: [
            {
              sourceTitle: `Enrollment Record: ${details.code} — ${details.title}`,
              sourceType: "student_record",
              excerpt: `Progress: ${details.progressPercent}% (${details.completedLessonsCount}/${details.totalPublishedLessonsCount} lessons completed)`,
            },
          ],
          summaryTextEn: `### Enrollment Details — ${details.code} (${details.title})\n- **Status:** ${details.enrollmentStatus} | **Progress:** ${details.progressPercent}%\n- **Lessons Completed:** ${details.completedLessonsCount} / ${details.totalPublishedLessonsCount}`,
          summaryTextAr: `### تفاصيل تسجيلك في دورة ${details.code} (${details.title})\n- **الحالة:** ${details.enrollmentStatus} | **نسبة الإنجاز:** ${details.progressPercent}%\n- **الدروس المكتملة:** ${details.completedLessonsCount} من أصل ${details.totalPublishedLessonsCount}`,
        };
      }

      // =====================================================================
      // 3. ASSIGNMENTS TOOLS (Authenticated Student Only)
      // =====================================================================
      case "get_my_assignments":
      case "get_assignment_details":
      case "get_assignment_submission_status": {
        if (toolName === "get_assignment_details") {
          const parsed = assignmentIdentifierSchema.safeParse(rawArgs);
          if (!parsed.success) {
            return {
              toolName,
              ok: false,
              data: {
                error: "INVALID_ARGUMENTS",
                message: "Missing or invalid assignmentIdentifier.",
              },
              citations: [],
              summaryTextEn: "Please specify a valid assignment title or ID.",
              summaryTextAr: "يرجى تحديد عنوان الواجب أو معرفه.",
            };
          }
        } else {
          const parsed = optionalAssignmentIdentifierSchema.safeParse(rawArgs);
          if (!parsed.success) {
            return {
              toolName,
              ok: false,
              data: { error: "INVALID_ARGUMENTS" },
              citations: [],
              summaryTextEn: "Invalid assignment query arguments.",
              summaryTextAr: "معاملات البحث عن الواجبات غير صالحة.",
            };
          }
        }

        if (enrolledCourseIds.length === 0) {
          return {
            toolName,
            ok: true,
            data: { assignmentsCount: 0, assignments: [] },
            citations: [],
            summaryTextEn:
              "You have no course assignments because you are not enrolled in any courses yet.",
            summaryTextAr:
              "لا توجد واجبات دراسية لأنك غير مسجل في أي دورة حالياً.",
          };
        }

        const [assignmentsRes, submissionsRes] = await Promise.all([
          supabase
            .from("assignments")
            .select(
              "id, course_id, lesson_id, title, description, due_at, max_points, allow_late_submissions, is_published",
            )
            .in("course_id", enrolledCourseIds)
            .eq("is_published", true)
            .order("due_at", { ascending: true }),
          supabase
            .from("assignment_submissions")
            .select(
              "id, assignment_id, status, grade_points, feedback, submitted_at, graded_at",
            )
            .eq("student_id", studentId),
        ]);

        const subMap = new Map(
          (submissionsRes.data ?? []).map((s) => [s.assignment_id, s]),
        );

        const rawFilter =
          (typeof rawArgs.courseIdentifier === "string"
            ? rawArgs.courseIdentifier
            : typeof rawArgs.assignmentIdentifier === "string"
              ? rawArgs.assignmentIdentifier
              : ""
          )
            .trim()
            .toLowerCase();

        let list = (assignmentsRes.data ?? [])
          .filter((a) => a.is_published === true && enrolledSet.has(a.course_id))
          .map((a) => {
            const c = publishedEnrolledCourseMap.get(a.course_id);
            const sub = subMap.get(a.id);
            return {
              assignmentId: a.id,
              title: a.title,
              description: a.description,
              courseId: a.course_id,
              courseCode: c?.code ?? "COURSE",
              courseTitle: c?.title ?? "Course",
              dueAt: a.due_at,
              maxPoints: Number(a.max_points ?? 100),
              allowLateSubmissions: a.allow_late_submissions,
              submissionStatus: sub?.status ?? "not_submitted",
              gradePoints:
                sub?.grade_points !== null && sub?.grade_points !== undefined
                  ? Number(sub.grade_points)
                  : null,
              feedback: sub?.feedback ?? null,
              submittedAt: sub?.submitted_at ?? null,
              gradedAt: sub?.graded_at ?? null,
            };
          });

        if (rawFilter) {
          const filtered = list.filter(
            (a) =>
              a.assignmentId.toLowerCase() === rawFilter ||
              a.title.toLowerCase().includes(rawFilter) ||
              a.courseCode.toLowerCase().includes(rawFilter) ||
              a.courseTitle.toLowerCase().includes(rawFilter),
          );
          if (filtered.length > 0) list = filtered;
        }

        const linesEn =
          list.length > 0
            ? list
                .map(
                  (a) =>
                    `- **${a.title}** (${a.courseCode} — ${a.courseTitle}): Due ${a.dueAt ? a.dueAt.slice(0, 10) : "Open"} | Max: ${a.maxPoints} pts | Status: **${a.submissionStatus}**${a.gradePoints !== null ? ` | Grade: **${a.gradePoints}/${a.maxPoints}**` : ""}${a.feedback ? ` | Feedback: "${a.feedback}"` : ""}`,
                )
                .join("\n")
            : "No published assignments found for your enrolled courses.";

        const linesAr =
          list.length > 0
            ? list
                .map(
                  (a) =>
                    `- **${a.title}** (${a.courseCode} — ${a.courseTitle}): موعد التسليم ${a.dueAt ? a.dueAt.slice(0, 10) : "مفتوح"} | الدرجة العظمى: ${a.maxPoints} | الحالة: **${a.submissionStatus}**${a.gradePoints !== null ? ` | الدرجة: **${a.gradePoints}/${a.maxPoints}**` : ""}${a.feedback ? ` | ملاحظات المحاضر: "${a.feedback}"` : ""}`,
                )
                .join("\n")
            : "لا توجد واجبات منشورة حالياً لدوراتك المسجلة.";

        return {
          toolName,
          ok: true,
          data: {
            totalAssignmentsCount: list.length,
            submittedCount: list.filter(
              (a) => a.submissionStatus !== "not_submitted",
            ).length,
            assignments: list,
          },
          citations: [
            {
              sourceTitle: "Authenticated Student Assignments & Submissions",
              sourceType: "student_record",
              excerpt: `${list.length} published assignment(s) across enrolled courses.`,
            },
          ],
          summaryTextEn: `### Your Course Assignments (${list.length})\n${linesEn}`,
          summaryTextAr: `### واجباتك الدراسية (${list.length})\n${linesAr}`,
        };
      }

      // =====================================================================
      // 4. EXAMS TOOLS (Authenticated Student Only)
      // =====================================================================
      case "get_my_exams":
      case "get_exam_details": {
        if (toolName === "get_exam_details") {
          const parsed = examIdentifierSchema.safeParse(rawArgs);
          if (!parsed.success) {
            return {
              toolName,
              ok: false,
              data: {
                error: "INVALID_ARGUMENTS",
                message: "Missing or invalid examIdentifier.",
              },
              citations: [],
              summaryTextEn: "Please specify a valid exam title or ID.",
              summaryTextAr: "يرجى تحديد عنوان الاختبار أو معرفه.",
            };
          }
        } else {
          const parsed = optionalCourseIdentifierSchema.safeParse(rawArgs);
          if (!parsed.success) {
            return {
              toolName,
              ok: false,
              data: { error: "INVALID_ARGUMENTS" },
              citations: [],
              summaryTextEn: "Invalid exam query arguments.",
              summaryTextAr: "معاملات البحث عن الاختبارات غير صالحة.",
            };
          }
        }

        if (enrolledCourseIds.length === 0) {
          return {
            toolName,
            ok: true,
            data: { examsCount: 0, exams: [] },
            citations: [],
            summaryTextEn:
              "You have no assigned exams because you are not enrolled in any courses yet.",
            summaryTextAr:
              "لا توجد اختبارات متاحة لأنك غير مسجل في أي دورة حالياً.",
          };
        }

        const [examsRes, attemptsRes, resultsRes] = await Promise.all([
          supabase
            .from("exams")
            .select(
              "id, course_id, title, description, instructions, duration_minutes, total_points, passing_score, max_attempts, available_from, available_until, status",
            )
            .in("course_id", enrolledCourseIds)
            .eq("status", "published")
            .order("created_at", { ascending: false }),
          supabase
            .from("exam_attempts")
            .select("id, exam_id, attempt_number, status, submitted_at")
            .eq("student_id", studentId),
          supabase
            .from("results")
            .select(
              "exam_id, score_percent, earned_points, total_points, passed, is_published, graded_at",
            )
            .eq("student_id", studentId)
            .eq("is_published", true),
        ]);

        const resultsByExam = new Map(
          (resultsRes.data ?? []).map((r) => [r.exam_id, r]),
        );

        const rawFilter =
          (typeof rawArgs.courseIdentifier === "string"
            ? rawArgs.courseIdentifier
            : typeof rawArgs.examIdentifier === "string"
              ? rawArgs.examIdentifier
              : ""
          )
            .trim()
            .toLowerCase();

        let examList = (examsRes.data ?? [])
          .filter((e) => e.status === "published" && enrolledSet.has(e.course_id))
          .map((e) => {
            const c = publishedEnrolledCourseMap.get(e.course_id);
            const examAttempts = (attemptsRes.data ?? []).filter(
              (a) => a.exam_id === e.id,
            );
            const publishedResult = resultsByExam.get(e.id);

            return {
              examId: e.id,
              title: e.title,
              description: e.description,
              instructions: e.instructions,
              courseId: e.course_id,
              courseCode: c?.code ?? "COURSE",
              courseTitle: c?.title ?? "Course",
              durationMinutes: e.duration_minutes,
              totalPoints: Number(e.total_points ?? 100),
              passingScorePercent: Number(e.passing_score ?? 50),
              maxAttempts: e.max_attempts,
              attemptsUsed: examAttempts.length,
              availableFrom: e.available_from,
              availableUntil: e.available_until,
              hasPublishedResult: Boolean(publishedResult),
              scorePercent: publishedResult
                ? Number(publishedResult.score_percent)
                : null,
              passed: publishedResult ? publishedResult.passed : null,
            };
          });

        if (rawFilter) {
          const filtered = examList.filter(
            (e) =>
              e.examId.toLowerCase() === rawFilter ||
              e.title.toLowerCase().includes(rawFilter) ||
              e.courseCode.toLowerCase().includes(rawFilter) ||
              e.courseTitle.toLowerCase().includes(rawFilter),
          );
          if (filtered.length > 0) examList = filtered;
        }

        const linesEn =
          examList.length > 0
            ? examList
                .map(
                  (e) =>
                    `- **${e.title}** (${e.courseCode} — ${e.courseTitle}): ${e.durationMinutes} min | Total: ${e.totalPoints} pts | Passing: ${e.passingScorePercent}% | Attempts: ${e.attemptsUsed}/${e.maxAttempts}${e.hasPublishedResult ? ` | Result: **${e.scorePercent?.toFixed(1)}% (${e.passed ? "Passed" : "Failed"})**` : " | Status: **Upcoming / Available**"}`,
                )
                .join("\n")
            : "No published exams found for your enrolled courses.";

        const linesAr =
          examList.length > 0
            ? examList
                .map(
                  (e) =>
                    `- **${e.title}** (${e.courseCode} — ${e.courseTitle}): المدة ${e.durationMinutes} دقيقة | الدرجة الكلية: ${e.totalPoints} | النجاح: ${e.passingScorePercent}% | المحاولات: ${e.attemptsUsed}/${e.maxAttempts}${e.hasPublishedResult ? ` | النتيجة: **${e.scorePercent?.toFixed(1)}% (${e.passed ? "ناجح" : "غير مجتاز"})**` : " | الحالة: **متاح / قادم**"}`,
                )
                .join("\n")
            : "لا توجد اختبارات منشورة حالياً لدوراتك المسجلة.";

        return {
          toolName,
          ok: true,
          data: {
            totalPublishedExamsCount: examList.length,
            upcomingExamsCount: examList.filter((e) => !e.hasPublishedResult)
              .length,
            completedExamsCount: examList.filter((e) => e.hasPublishedResult)
              .length,
            exams: examList,
          },
          citations: [
            {
              sourceTitle: "Authenticated Student Examinations Schedule",
              sourceType: "student_record",
              excerpt: `${examList.length} published examination(s) for enrolled courses.`,
            },
          ],
          summaryTextEn: `### Your Course Examinations (${examList.length})\n${linesEn}`,
          summaryTextAr: `### اختبارات دوراتك المسجلة (${examList.length})\n${linesAr}`,
        };
      }

      case "get_my_exam_results": {
        const parsed = optionalCourseIdentifierSchema.safeParse(rawArgs);
        if (!parsed.success) {
          return {
            toolName,
            ok: false,
            data: { error: "INVALID_ARGUMENTS" },
            citations: [],
            summaryTextEn: "Invalid exam results query arguments.",
            summaryTextAr: "معاملات البحث عن نتائج الاختبارات غير صالحة.",
          };
        }
        const filterStr = (parsed.data.courseIdentifier ?? "").toLowerCase();

        const { data: resultsData } = await supabase
          .from("results")
          .select(
            "id, exam_id, course_id, earned_points, total_points, score_percent, passed, feedback, graded_at, is_published",
          )
          .eq("student_id", studentId)
          .eq("is_published", true)
          .order("graded_at", { ascending: false });

        const results = (resultsData ?? []).filter(
          (r) => r.is_published === true,
        );
        const courseIds = Array.from(new Set(results.map((r) => r.course_id)));
        const examIds = Array.from(new Set(results.map((r) => r.exam_id)));

        const [coursesRes, examsRes] = await Promise.all([
          courseIds.length > 0
            ? supabase
                .from("courses")
                .select("id, code, title")
                .in("id", courseIds)
            : Promise.resolve({
                data: [] as Array<{ id: string; code: string; title: string }>,
              }),
          examIds.length > 0
            ? supabase.from("exams").select("id, title").in("id", examIds)
            : Promise.resolve({
                data: [] as Array<{ id: string; title: string }>,
              }),
        ]);

        const courseMap = new Map(
          (coursesRes.data ?? []).map((c) => [c.id, c]),
        );
        const examMap = new Map(
          (examsRes.data ?? []).map((e) => [e.id, e.title]),
        );

        let formattedResults = results.map((r) => {
          const c = courseMap.get(r.course_id);
          return {
            resultId: r.id,
            examId: r.exam_id,
            examTitle: examMap.get(r.exam_id) ?? "Examination",
            courseId: r.course_id,
            courseCode: c?.code ?? "COURSE",
            courseTitle: c?.title ?? "Course",
            earnedPoints: Number(r.earned_points ?? 0),
            totalPoints: Number(r.total_points ?? 0),
            scorePercent: Number(r.score_percent ?? 0),
            passed: r.passed,
            feedback: r.feedback,
            gradedAt: r.graded_at,
          };
        });

        if (filterStr) {
          const filtered = formattedResults.filter(
            (r) =>
              r.courseCode.toLowerCase().includes(filterStr) ||
              r.courseTitle.toLowerCase().includes(filterStr) ||
              r.examTitle.toLowerCase().includes(filterStr),
          );
          if (filtered.length > 0) formattedResults = filtered;
        }

        const overallAverage =
          formattedResults.length > 0
            ? Number(
                (
                  formattedResults.reduce((s, r) => s + r.scorePercent, 0) /
                  formattedResults.length
                ).toFixed(1),
              )
            : 0;

        const linesEn =
          formattedResults.length > 0
            ? formattedResults
                .map(
                  (r) =>
                    `- **${r.examTitle}** (${r.courseCode} — ${r.courseTitle}): **${r.scorePercent.toFixed(1)}%** (${r.earnedPoints}/${r.totalPoints} pts) — ${r.passed ? "Passed" : "Needs Revision"}`,
                )
                .join("\n")
            : "No published exam results recorded yet.";

        const linesAr =
          formattedResults.length > 0
            ? formattedResults
                .map(
                  (r) =>
                    `- **${r.examTitle}** (${r.courseCode} — ${r.courseTitle}): **${r.scorePercent.toFixed(1)}%** (${r.earnedPoints}/${r.totalPoints}) — ${r.passed ? "ناجح" : "يحتاج مراجعة"}`,
                )
                .join("\n")
            : "لا توجد نتائج اختبارات منشورة حتى الآن.";

        return {
          toolName,
          ok: true,
          data: {
            examsTakenCount: formattedResults.length,
            examsPassedCount: formattedResults.filter((r) => r.passed).length,
            overallExamAveragePercent: overallAverage,
            results: formattedResults,
          },
          citations: [
            {
              sourceTitle: "Authenticated Student Published Exam Results",
              sourceType: "student_record",
              excerpt: `Overall Exam Average: ${overallAverage}% across ${formattedResults.length} published exam(s).`,
            },
          ],
          summaryTextEn: `### Your Published Exam Results (Average: ${overallAverage}%)\n${linesEn}`,
          summaryTextAr: `### نتائج اختباراتك المنشورة (المتوسط العام: ${overallAverage}%)\n${linesAr}`,
        };
      }

      // =====================================================================
      // 5. ACADEMIC PERFORMANCE TOOLS (Authenticated Student Only)
      // =====================================================================
      case "get_my_grades": {
        const parsed = optionalCourseIdentifierSchema.safeParse(rawArgs);
        if (!parsed.success) {
          return {
            toolName,
            ok: false,
            data: { error: "INVALID_ARGUMENTS" },
            citations: [],
            summaryTextEn: "Invalid grades query arguments.",
            summaryTextAr: "معاملات البحث عن الدرجات غير صالحة.",
          };
        }

        const examRes = await executeStudentAiTool({
          toolName: "get_my_exam_results",
          rawArgs,
          context,
        });
        const assignRes = await executeStudentAiTool({
          toolName: "get_my_assignments",
          rawArgs,
          context,
        });

        return {
          toolName,
          ok: true,
          data: {
            studentName: context.studentDisplayName,
            examResults: examRes.data,
            assignmentGrades: assignRes.data,
          },
          citations: [...examRes.citations, ...assignRes.citations],
          summaryTextEn: `${examRes.summaryTextEn}\n\n${assignRes.summaryTextEn}`,
          summaryTextAr: `${examRes.summaryTextAr}\n\n${assignRes.summaryTextAr}`,
        };
      }

      case "get_my_academic_progress": {
        const parsed = emptyObjectSchema.safeParse(rawArgs);
        if (!parsed.success) {
          return {
            toolName,
            ok: false,
            data: { error: "INVALID_ARGUMENTS" },
            citations: [],
            summaryTextEn: "Invalid arguments.",
            summaryTextAr: "معاملات غير صالحة.",
          };
        }

        const [studyRes, completedLessonsRes, notesRes, certsRes] =
          await Promise.all([
            supabase
              .from("study_sessions")
              .select("duration_seconds")
              .eq("student_id", studentId),
            supabase
              .from("lesson_progress")
              .select("id", { count: "exact", head: true })
              .eq("student_id", studentId)
              .eq("is_completed", true),
            supabase
              .from("lesson_notes")
              .select("id", { count: "exact", head: true })
              .eq("student_id", studentId),
            supabase
              .from("certificates")
              .select(
                "id, certificate_number, course_id, final_score, issued_at",
              )
              .eq("student_id", studentId),
          ]);

        const totalStudySeconds = (studyRes.data ?? []).reduce(
          (s, r) => s + Number(r.duration_seconds ?? 0),
          0,
        );
        const totalStudyHours = Number((totalStudySeconds / 3600).toFixed(1));

        const coursesProgress = enrollments.map((e) => {
          const c = publishedEnrolledCourseMap.get(e.course_id);
          return {
            courseId: e.course_id,
            code: c?.code ?? "COURSE",
            title: c?.title ?? "Course",
            progressPercent: Number(e.progress_percent ?? 0),
            status: e.status,
          };
        });

        const avgProgress =
          coursesProgress.length > 0
            ? Number(
                (
                  coursesProgress.reduce((s, c) => s + c.progressPercent, 0) /
                  coursesProgress.length
                ).toFixed(1),
              )
            : 0;

        const completedCoursesCount = coursesProgress.filter(
          (c) => c.progressPercent >= 100 || c.status === "completed",
        ).length;

        return {
          toolName,
          ok: true,
          data: {
            studentName: context.studentDisplayName,
            enrolledCoursesCount: coursesProgress.length,
            completedCoursesCount,
            averageCourseProgressPercent: avgProgress,
            totalStudyHours,
            completedLessonsCount: completedLessonsRes.count ?? 0,
            personalNotesCount: notesRes.count ?? 0,
            certificatesCount: (certsRes.data ?? []).length,
            certificates: certsRes.data ?? [],
            coursesProgress,
          },
          citations: [
            {
              sourceTitle: "Authenticated Student Learning Progress Record",
              sourceType: "student_record",
              excerpt: `Avg Course Completion: ${avgProgress}% • Study Hours: ${totalStudyHours}h • Completed Lessons: ${completedLessonsRes.count ?? 0}`,
            },
          ],
          summaryTextEn: `### Your Learning Progress — ${context.studentDisplayName}\n- **Enrolled Courses:** ${coursesProgress.length} (Completed: ${completedCoursesCount}, Average Completion: **${avgProgress}%**)\n- **Total Study Hours:** ${totalStudyHours}h\n- **Completed Lessons:** ${completedLessonsRes.count ?? 0} | **Personal Notes:** ${notesRes.count ?? 0} | **Certificates:** ${(certsRes.data ?? []).length}`,
          summaryTextAr: `### تقدمك الدراسي — ${context.studentDisplayName}\n- **الدورات المسجلة:** ${coursesProgress.length} (المكتملة: ${completedCoursesCount}، متوسط الإنجاز: **${avgProgress}%**)\n- **إجمالي ساعات الدراسة:** ${totalStudyHours} ساعة\n- **الدروس المكتملة:** ${completedLessonsRes.count ?? 0} | **الملاحظات:** ${notesRes.count ?? 0} | **الشهادات:** ${(certsRes.data ?? []).length}`,
        };
      }

      case "get_my_attendance": {
        const parsed = optionalCourseIdentifierSchema.safeParse(rawArgs);
        if (!parsed.success) {
          return {
            toolName,
            ok: false,
            data: { error: "INVALID_ARGUMENTS" },
            citations: [],
            summaryTextEn: "Invalid attendance query arguments.",
            summaryTextAr: "معاملات البحث عن الحضور غير صالحة.",
          };
        }

        const { data: recordsData } = await supabase
          .from("attendance_records")
          .select("id, attendance_id, status, remarks, recorded_at")
          .eq("student_id", studentId)
          .order("recorded_at", { ascending: false });

        const records = recordsData ?? [];
        const attendanceIds = Array.from(
          new Set(records.map((r) => r.attendance_id)),
        );

        const sessionsRes =
          attendanceIds.length > 0
            ? await supabase
                .from("attendance")
                .select("id, course_id, session_date, topic")
                .in("id", attendanceIds)
            : {
                data: [] as Array<{
                  id: string;
                  course_id: string;
                  session_date: string;
                  topic: string | null;
                }>,
              };

        const sessionMap = new Map(
          (sessionsRes.data ?? []).map((s) => [s.id, s]),
        );

        const totalSessions = records.length;
        const presentCount = records.filter(
          (r) =>
            r.status === "present" ||
            r.status === "late" ||
            r.status === "excused",
        ).length;
        const absentCount = records.filter((r) => r.status === "absent").length;
        const attendanceRatePercent =
          totalSessions > 0
            ? Number(((presentCount / totalSessions) * 100).toFixed(1))
            : 100;

        const sessionsList = records.slice(0, 12).map((r) => {
          const sess = sessionMap.get(r.attendance_id);
          return {
            recordId: r.id,
            status: r.status,
            remarks: r.remarks,
            sessionDate: sess?.session_date ?? r.recorded_at.slice(0, 10),
            topic: sess?.topic ?? "Class Session",
          };
        });

        return {
          toolName,
          ok: true,
          data: {
            attendanceRatePercent,
            totalRecordedSessions: totalSessions,
            presentOrExcusedCount: presentCount,
            absentCount,
            recentSessions: sessionsList,
          },
          citations: [
            {
              sourceTitle: "Authenticated Student Attendance Record",
              sourceType: "student_record",
              excerpt: `Attendance Rate: ${attendanceRatePercent}% (${presentCount}/${totalSessions} sessions attended).`,
            },
          ],
          summaryTextEn: `### Your Class Attendance\n- **Attendance Rate:** **${attendanceRatePercent}%** (${presentCount} present/late/excused, ${absentCount} absent out of ${totalSessions} recorded sessions)`,
          summaryTextAr: `### سجل حضورك الدراسي\n- **نسبة الحضور:** **${attendanceRatePercent}%** (${presentCount} حضور/بعذر، ${absentCount} غياب من أصل ${totalSessions} جلسة مسجلة)`,
        };
      }

      case "get_my_academic_report": {
        const parsed = emptyObjectSchema.safeParse(rawArgs);
        if (!parsed.success) {
          return {
            toolName,
            ok: false,
            data: { error: "INVALID_ARGUMENTS" },
            citations: [],
            summaryTextEn: "Invalid arguments.",
            summaryTextAr: "معاملات غير صالحة.",
          };
        }

        const [progressTool, examsTool, resultsTool, assignTool, attendTool] =
          await Promise.all([
            executeStudentAiTool({
              toolName: "get_my_academic_progress",
              rawArgs: {},
              context,
            }),
            executeStudentAiTool({
              toolName: "get_my_exams",
              rawArgs: {},
              context,
            }),
            executeStudentAiTool({
              toolName: "get_my_exam_results",
              rawArgs: {},
              context,
            }),
            executeStudentAiTool({
              toolName: "get_my_assignments",
              rawArgs: {},
              context,
            }),
            executeStudentAiTool({
              toolName: "get_my_attendance",
              rawArgs: {},
              context,
            }),
          ]);

        return {
          toolName,
          ok: true,
          data: {
            studentName: context.studentDisplayName,
            progress: progressTool.data,
            examSchedule: examsTool.data,
            examResults: resultsTool.data,
            assignments: assignTool.data,
            attendance: attendTool.data,
          },
          citations: [
            ...progressTool.citations,
            ...resultsTool.citations,
            ...assignTool.citations,
            ...attendTool.citations,
          ],
          summaryTextEn: [
            progressTool.summaryTextEn,
            resultsTool.summaryTextEn,
            assignTool.summaryTextEn,
            attendTool.summaryTextEn,
          ].join("\n\n"),
          summaryTextAr: [
            progressTool.summaryTextAr,
            resultsTool.summaryTextAr,
            assignTool.summaryTextAr,
            attendTool.summaryTextAr,
          ].join("\n\n"),
        };
      }

      // =====================================================================
      // 6. COURSE METADATA & VERIFIED DURATION TOOLS
      // =====================================================================
      case "get_course_duration":
      case "get_course_metadata": {
        const parsed = courseIdentifierSchema.safeParse(rawArgs);
        if (!parsed.success) {
          return {
            toolName,
            ok: false,
            data: {
              error: "INVALID_ARGUMENTS",
              message: "Please provide a valid courseIdentifier.",
            },
            citations: [],
            summaryTextEn:
              "Please specify which course you want duration or metadata for.",
            summaryTextAr: "يرجى تحديد الدورة المطلوب معرفة مدتها أو بياناتها.",
          };
        }

        // COURSE STATUS BOUNDARY: Strictly query ONLY `status = 'published'` courses.
        // Never expose `draft` or `archived` courses even if their ID exists in historical enrollment records.
        const { data: allPublishedCourses } = await supabase
          .from("courses")
          .select(
            "id, code, title, subtitle, description, category, completion_requirements, estimated_hours, language, passing_score, status, teacher_id",
          )
          .eq("status", "published")
          .limit(60);

        const visibleRows = (allPublishedCourses ?? []).filter(
          (c) => c.status === "published",
        );
        let matched = matchCoursesByIdentifier(
          visibleRows,
          parsed.data.courseIdentifier,
        );

        // Stage 2 deep content fallback: if course title/metadata didn't match the student's topic keyword
        // (e.g. "Mobile App" when the official course name is different), search ONLY the student's enrolled published courses
        if (
          matched.length === 0 &&
          enrolledCourseIds.length > 0 &&
          !isExplicitCourseCodeOrUuid(parsed.data.courseIdentifier)
        ) {
          const grounded = await retrieveGroundedCourseContext({
            courseIds: enrolledCourseIds,
            query: parsed.data.courseIdentifier,
          });
          if (grounded.matchedCourses.length > 0) {
            const matchedIds = new Set(
              grounded.matchedCourses.map((m) => m.courseId),
            );
            matched = visibleRows
              .filter((r) => matchedIds.has(r.id))
              .map((r) => ({ ...r, matchScore: 50 }));
          }
        }

        if (matched.length === 0) {
          return {
            toolName,
            ok: true,
            data: {
              found: false,
              message: `No published course found matching "${parsed.data.courseIdentifier}". Unpublished, draft, or archived courses cannot be accessed.`,
            },
            citations: [],
            summaryTextEn: `No published course matching "${parsed.data.courseIdentifier}" was found.`,
            summaryTextAr: `لم يتم العثور على دورة منشورة تطابق "${parsed.data.courseIdentifier}".`,
          };
        }

        const topMatched = matched.slice(0, 4);
        const teacherIds = Array.from(
          new Set(topMatched.map((c) => c.teacher_id)),
        );

        // ENROLLMENT BOUNDARY: Query `lessons` and `chapters` ONLY for courses in which the authenticated student is enrolled!
        // Non-enrolled courses must NEVER trigger queries against `public.chapters` or `public.lessons`.
        const enrolledMatchedIds = topMatched
          .filter((c) => enrolledSet.has(c.id))
          .map((c) => c.id);

        const [profilesRes, lessonsRes, chaptersRes] = await Promise.all([
          teacherIds.length > 0
            ? supabase
                .from("profiles")
                .select("id, full_name")
                .in("id", teacherIds)
            : Promise.resolve({
                data: [] as Array<{ id: string; full_name: string | null }>,
              }),
          enrolledMatchedIds.length > 0
            ? supabase
                .from("lessons")
                .select("id, course_id, title, duration_seconds, is_published")
                .in("course_id", enrolledMatchedIds)
                .eq("is_published", true)
            : Promise.resolve({
                data: [] as Array<{
                  id: string;
                  course_id: string;
                  title: string;
                  duration_seconds: number;
                  is_published: boolean;
                }>,
              }),
          enrolledMatchedIds.length > 0
            ? supabase
                .from("chapters")
                .select("id, course_id, title, position")
                .in("course_id", enrolledMatchedIds)
                .eq("is_published", true)
                .order("position", { ascending: true })
            : Promise.resolve({
                data: [] as Array<{
                  id: string;
                  course_id: string;
                  title: string;
                  position: number;
                }>,
              }),
        ]);

        const teacherMap = new Map(
          (profilesRes.data ?? []).map((p) => [
            p.id,
            p.full_name?.trim() || "Learnix Instructor",
          ]),
        );

        const durationResults: Array<{
          courseId: string;
          code: string;
          title: string;
          category: string;
          description: string | null;
          completionRequirements: string | null;
          language: string;
          passingScore: number;
          instructorName: string;
          isEnrolled: boolean;
          chapters?: string[];
          durationInfo: VerifiedCourseDurationInfo;
        }> = topMatched.map((c) => {
          const isStudentEnrolled = enrolledSet.has(c.id);
          const courseLessons = isStudentEnrolled
            ? (lessonsRes.data ?? []).filter((l) => l.course_id === c.id)
            : [];
          const courseChapters = isStudentEnrolled
            ? (chaptersRes.data ?? [])
                .filter((ch) => ch.course_id === c.id)
                .map((ch) => ch.title)
            : undefined;

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

          return {
            courseId: c.id,
            code: c.code,
            title: c.title,
            category: c.category,
            description: c.description || c.subtitle,
            completionRequirements: c.completion_requirements,
            language: c.language,
            passingScore: Number(c.passing_score ?? 60),
            instructorName:
              teacherMap.get(c.teacher_id) || "Learnix Instructor",
            isEnrolled: isStudentEnrolled,
            ...(isStudentEnrolled ? { chapters: courseChapters } : {}),
            durationInfo,
          };
        });

        const citations: AiCitation[] = durationResults.map((d) => ({
          sourceTitle: `${d.code} — ${d.title} (Verified Course Metadata & Duration)`,
          sourceType: "course_metadata",
          excerpt: d.durationInfo.explanationEn,
        }));

        return {
          toolName,
          ok: true,
          data: {
            found: true,
            multipleMatches: durationResults.length > 1,
            courses: durationResults,
          },
          citations,
          summaryTextEn: durationResults
            .map(
              (d) =>
                `### ${d.code} — ${d.title} (${d.category})\n- ${d.durationInfo.explanationEn}${d.description ? `\n- **Overview:** ${d.description}` : ""}`,
            )
            .join("\n\n"),
          summaryTextAr: durationResults
            .map(
              (d) =>
                `### ${d.code} — ${d.title} (${d.category})\n- ${d.durationInfo.explanationAr}${d.description ? `\n- **نظرة عامة:** ${d.description}` : ""}`,
            )
            .join("\n\n"),
        };
      }

      // =====================================================================
      // 7. ENROLLED COURSE CONTENT RAG TOOL (`search_enrolled_course_content`)
      // =====================================================================
      case "search_enrolled_course_content": {
        const parsed = ragSearchSchema.safeParse(rawArgs);
        if (!parsed.success) {
          return {
            toolName,
            ok: false,
            data: {
              error: "INVALID_ARGUMENTS",
              message: "Missing or invalid query for RAG search.",
            },
            citations: [],
            summaryTextEn:
              "Please provide a valid topic or question to search your course materials.",
            summaryTextAr:
              "يرجى تحديد الموضوع المطلوب البحث عنه في مواد دورتك.",
          };
        }

        if (enrolledCourseIds.length === 0) {
          return {
            toolName,
            ok: true,
            data: {
              enrolledCoursesCount: 0,
              hasRelevantMatches: false,
              accessDeniedOrNotEnrolled: true,
              message:
                "You are not currently enrolled in any published courses. Protected lesson content and course documents require enrollment.",
            },
            citations: [],
            summaryTextEn:
              "You are not enrolled in any published courses yet. Please enroll in a course via Explore Courses (`/student/courses`) to access its lessons and study materials.",
            summaryTextAr:
              "أنت غير مسجل في أي دورة منشورة حالياً. يرجى التسجيل في الدورة عبر صفحة استكشاف الدورات (`/student/courses`) للوصول إلى الدروس والمواد التعليمية.",
          };
        }

        // Verify selectedCourseId (if active) is in the student's published enrolled courses
        let targetCourseIds =
          context.selectedCourseId && enrolledSet.has(context.selectedCourseId)
            ? [context.selectedCourseId]
            : enrolledCourseIds;

        if (parsed.data.courseIdentifier) {
          // Search ONLY published courses (`status = 'published'`) so archived/draft courses are never matched
          const { data: publishedCourses } = await supabase
            .from("courses")
            .select(
              "id, code, title, subtitle, description, category, completion_requirements, status",
            )
            .eq("status", "published");

          const matchedAny = matchCoursesByIdentifier(
            (publishedCourses ?? []).filter((c) => c.status === "published"),
            parsed.data.courseIdentifier,
          );

          if (matchedAny.length === 0) {
            return {
              toolName,
              ok: true,
              data: {
                hasRelevantMatches: false,
                courseNotFoundOrUnpublished: true,
                message: `No published course found matching "${parsed.data.courseIdentifier}". Unpublished, draft, or archived courses cannot be accessed.`,
              },
              citations: [],
              summaryTextEn: `No published course matching "${parsed.data.courseIdentifier}" was found.`,
              summaryTextAr: `لم يتم العثور على دورة منشورة تطابق "${parsed.data.courseIdentifier}".`,
            };
          }

          const matchedEnrolled = matchedAny.filter((c) =>
            enrolledSet.has(c.id),
          );
          if (matchedEnrolled.length === 0) {
            const nonEnrolledCourse = matchedAny[0]!;
            return {
              toolName,
              ok: true,
              data: {
                hasRelevantMatches: false,
                accessDeniedNotEnrolled: true,
                requestedCourseCode: nonEnrolledCourse.code,
                requestedCourseTitle: nonEnrolledCourse.title,
                message: `Enrollment required: The student is NOT enrolled in "${nonEnrolledCourse.code} — ${nonEnrolledCourse.title}". Protected lesson titles, lesson explanations, and internal course documents can only be retrieved for enrolled courses. Public catalog metadata is available via get_published_course_details.`,
              },
              citations: [],
              summaryTextEn: `### Course Enrollment Required\nYou are not currently enrolled in **${nonEnrolledCourse.code} — ${nonEnrolledCourse.title}**. Under Learnix security rules, internal lessons and course documents are restricted to enrolled students. You can view its public summary or enroll in it from **Explore Courses** (\`/student/courses\`).`,
              summaryTextAr: `### يلزم التسجيل في الدورة أولاً\nأنت غير مسجل حالياً في دورة **${nonEnrolledCourse.code} — ${nonEnrolledCourse.title}**. وفقاً لقواعد الأمان في Learnix، لا يمكن الوصول إلى محتوى الدروس والمواد الداخلية إلا للطلاب المسجلين في الدورة. يمكنك الاطلاع على ملخصها العام أو التسجيل فيها عبر صفحة **استكشاف الدورات** (\`/student/courses\`).`,
            };
          }
          targetCourseIds = matchedEnrolled.map((c) => c.id);
        }

        const grounded = await retrieveGroundedCourseContext({
          courseId:
            targetCourseIds.length === 1 ? targetCourseIds[0]! : null,
          courseIds: targetCourseIds,
          preloadedCourses: publishedEnrolledCourses,
          query: parsed.data.query,
          allowBroadCourseFallback: false,
        });

        const citationLines = grounded.citations
          .map(
            (c, idx) =>
              `${idx + 1}. **${c.sourceTitle}** (${c.sourceType}): "${c.excerpt.trim()}..."`,
          )
          .join("\n");

        return {
          toolName,
          ok: true,
          data: {
            hasRelevantMatches: grounded.hasRelevantMatches,
            courseScope: `${grounded.courseCode} — ${grounded.courseTitle}`,
            matchedEnrolledCourses: grounded.matchedCourses.map((mc) => ({
              courseId: mc.courseId,
              courseCode: mc.courseCode,
              courseTitle: mc.courseTitle,
              courseCategory: mc.courseCategory,
              matchReasons: mc.matchReasons,
              verifiedDuration: mc.durationInfo,
            })),
            retrievedPassagesContext: grounded.contextBlock,
            citations: grounded.citations,
          },
          citations: grounded.citations,
          summaryTextEn: grounded.hasRelevantMatches
            ? `### Authorized Enrolled Course Sources (${grounded.courseCode} — ${grounded.courseTitle})\n\n${citationLines}`
            : `No matching educational passages were found in your enrolled course materials for "${parsed.data.query}".`,
          summaryTextAr: grounded.hasRelevantMatches
            ? `### المصادر المعتمدة من دوراتك المسجلة (${grounded.courseCode} — ${grounded.courseTitle})\n\n${citationLines}`
            : `لم يتم العثور على مقاطع تعليمية مطابقة في مواد دوراتك المسجلة حول "${parsed.data.query}".`,
        };
      }

      // =====================================================================
      // 8. PLATFORM HELP & NAVIGATION TOOL (`get_platform_help_and_navigation`)
      // =====================================================================
      case "get_platform_help_and_navigation": {
        const parsed = optionalPlatformTopicSchema.safeParse(rawArgs);
        if (!parsed.success) {
          return {
            toolName,
            ok: false,
            data: { error: "INVALID_ARGUMENTS" },
            citations: [],
            summaryTextEn: "Invalid platform help arguments.",
            summaryTextAr: "معاملات مساعدة المنصة غير صالحة.",
          };
        }

        const help = getVerifiedPlatformHelpContext();
        return {
          toolName,
          ok: true,
          data: {
            platformGuide: help.contextBlock,
          },
          citations: [help.citation],
          summaryTextEn: `### Official Learnix Platform Guide & Student Navigation\n- **Overview (\`/student\`):** Dashboard summary of enrolled courses, active assignments, upcoming exams, and latest grades.\n- **Explore Courses (\`/student/courses\`):** Browse all published courses by category, flip course cards for details, and click **Enroll Now**.\n- **My Learning (\`/student/my-learning\`):** Interactive Learning Orbit to study enrolled courses and open lessons.\n- **Exams (\`/student/exams\`):** View assigned course examinations, open the Exam Details modal, launch the Secure Exam Runner, and review attempt history.\n- **AI Study Assistant (\`/student/ai-assistant\`):** Ask questions in Arabic or English, attach \`PDF\`, \`DOCX\`, \`PPTX\`, \`XLSX\`, \`TXT\`, images, or audio files, or use live voice recording with active **Send** and **Cancel** buttons.\n- **Performance (\`/student/performance\`):** Inspect your Overall Exam Average, study hours, score charts, strengths, and official grades.\n- **Profile (\`/student/profile\`):** View certificates, milestones, and account preferences.`,
          summaryTextAr: `### دليل استخدام منصة Learnix للطالب\n- **نظرة عامة (\`/student\`):** ملخص الدورات المسجلة، والواجبات النشطة، والاختبارات القادمة، وأحدث الدرجات.\n- **استكشاف الدورات (\`/student/courses\`):** تصفح جميع الدورات المنشورة حسب التصنيف واضغط على **Enroll Now / التسجيل الآن** للتسجيل الفوري.\n- **تعلمي (\`/student/my-learning\`):** مدار التعلم التفاعلي لمتابعة دوراتك المسجلة وفتح الدروس.\n- **الاختبارات (\`/student/exams\`):** عرض اختبارات دوراتك المسجلة وتفاصيلها وبدء الاختبار ومراجعة سجل المحاولات.\n- **المساعد الذكي (\`/student/ai-assistant\`):** اطرح أسئلتك بالعربية أو الإنجليزية، وارفع ملفات (\`PDF\`, \`DOCX\`, \`PPTX\`, \`XLSX\`, \`TXT\`) أو صوراً أو ملفات صوتية، أو استخدم التسجيل الصوتي المباشر مع أزرار **إرسال (Send)** و**إلغاء (Cancel)** أثناء التسجيل.\n- **الأداء (\`/student/performance\`):** متابعة متوسط الاختبارات وساعات الدراسة والرسوم البيانية ونقاط القوة والدرجات الرسمية.\n- **الملف الشخصي (\`/student/profile\`):** عرض الشهادات والإنجازات وإعدادات الحساب.`,
        };
      }

      default: {
        return {
          toolName,
          ok: false,
          data: { error: "UNSUPPORTED_TOOL" },
          citations: [],
          summaryTextEn: `Tool "${toolName}" is not supported.`,
          summaryTextAr: `الأداة "${toolName}" غير مدعومة.`,
        };
      }
    }
  } catch {
    // Sanitized error handling: never expose raw database error messages, stack traces, or table details
    return {
      toolName,
      ok: false,
      data: {
        error: "TOOL_EXECUTION_ERROR",
        message:
          "The requested database tool encountered a temporary retrieval error and could not complete. Do not fabricate or guess the result.",
      },
      citations: [],
      summaryTextEn: `Tool "${toolName}" encountered a temporary retrieval error. In accordance with Learnix grounding policy, no data will be fabricated.`,
      summaryTextAr: `حدث خطأ مؤقت أثناء استرجاع البيانات عبر الأداة "${toolName}". التزاماً بسياسة الموثوقية في Learnix، لن يتم تخمين أو اختلاق أي بيانات.`,
    };
  }
}
