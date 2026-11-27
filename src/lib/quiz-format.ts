/**
 * Pure formatting and sanitization helpers ensuring generated and student-facing quizzes
 * contain ONLY sequential questions and clearly labeled answer choices (A, B, C, D...),
 * without course codes, subject names, internal IDs, or AI introductory text.
 */

const BRACKETED_OR_BARE_UUID_REGEX =
  /(?:\(\s*|\[\s*)?\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b(?:\s*\)|\s*\])?/gi;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function getOptionLetter(index: number): string {
  if (index >= 0 && index < 26) {
    return String.fromCharCode(65 + index);
  }
  return String(index + 1);
}

/**
 * Removes leading choice labels (e.g. "A. ", "B) ", "(C) ", "1. ") from an option's text
 * so UI/text renderers can consistently apply clean "A. ", "B. ", "C. ", "D. " prefixes.
 */
export function sanitizeQuizOptionText(rawOption: string): string {
  return rawOption
    .replace(/\r\n/g, " ")
    .replace(BRACKETED_OR_BARE_UUID_REGEX, "")
    .replace(/^\s*(?:\([A-Za-z0-9]\)|[A-Za-z]\s*[.):-]|[0-9]{1,2}\s*[.):-])\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Strips course codes, course/subject headers, internal UUIDs, draft tags,
 * and redundant leading question numbers from a single question prompt.
 */
export function sanitizeQuizQuestionPrompt(
  rawPrompt: string,
  forbiddenContext?: {
    courseCode?: string | null;
    courseTitle?: string | null;
    subjectName?: string | null;
  },
): string {
  let cleaned = rawPrompt
    .replace(/\r\n/g, "\n")
    .replace(BRACKETED_OR_BARE_UUID_REGEX, "")
    .replace(/^\[Draft for Teacher Review\]\s*/i, "")
    .trim();

  // Remove explicit lines at the top of a question that repeat Course / Subject / Code / ID metadata
  cleaned = cleaned
    .replace(
      /^(?:(?:course|subject|course\s*code|subject\s*code|course\s*id|exam\s*id|module\s*code)\s*[:\-—][^\n]*\n+)+/gi,
      "",
    )
    .trim();

  const tokensToStrip = [
    forbiddenContext?.courseCode?.trim(),
    forbiddenContext?.courseTitle?.trim(),
    forbiddenContext?.subjectName?.trim(),
  ].filter((t): t is string => Boolean(t && t.length >= 2));

  for (const token of tokensToStrip) {
    const escaped = escapeRegExp(token);
    // Strip bracketed or colon/dash-prefixed course/subject labels at the beginning of the prompt
    cleaned = cleaned
      .replace(new RegExp(`^\\s*\\[\\s*${escaped}\\s*\\]\\s*[:\\-—]?\\s*`, "i"), "")
      .replace(new RegExp(`^\\s*\\(\\s*${escaped}\\s*\\)\\s*[:\\-—]?\\s*`, "i"), "")
      .replace(new RegExp(`^\\s*${escaped}\\s*[:\\-—]+\\s*`, "i"), "");
  }

  // Also strip generic bracketed course-code prefixes like "[CS-101] " or "CS-101: " at start of prompt
  cleaned = cleaned
    .replace(/^\s*\[[A-Z]{2,6}[-_\s]?\d{2,4}[A-Z]?\]\s*[:\-—]?\s*/, "")
    .replace(/^\s*[A-Z]{2,6}-\d{2,4}[A-Z]?\s*(?:[:—]|-\s+)\s*/, "");

  // Strip redundant leading "Question 1:" / "Q1." / "1." so sequential numbering is controlled cleanly
  cleaned = cleaned
    .replace(
      /^\s*(?:question|q|السؤال|سؤال)\s*\d+\s*[:.)\-—]\s*/i,
      "",
    )
    .replace(/^\s*\d+\s*[.):]\s+/, "")
    .trim();

  return cleaned;
}

/**
 * Formats an array of quiz questions into clean student-facing text containing ONLY
 * sequential questions (`Question 1:`, `Question 2:`, ...) and labeled options (`A.`, `B.`, `C.`, `D.`).
 */
export function formatCleanQuizQuestionsText(
  questions: ReadonlyArray<{
    prompt: string;
    options?: ReadonlyArray<{ optionText: string }>;
  }>,
  forbiddenContext?: {
    courseCode?: string | null;
    courseTitle?: string | null;
    subjectName?: string | null;
  },
): string {
  return questions
    .map((q, qIdx) => {
      const cleanPrompt = sanitizeQuizQuestionPrompt(q.prompt, forbiddenContext);
      const header = `Question ${qIdx + 1}:\n${cleanPrompt}`;

      const cleanOptions = (q.options ?? [])
        .map((opt) => sanitizeQuizOptionText(opt.optionText))
        .filter((txt) => txt.length > 0);

      if (cleanOptions.length === 0) {
        return header;
      }

      const optionsBlock = cleanOptions
        .map((optText, optIdx) => `${getOptionLetter(optIdx)}. ${optText}`)
        .join("\n");

      return `${header}\n\n${optionsBlock}`;
    })
    .join("\n\n");
}
