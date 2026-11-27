/**
 * Shared scope, language detection, and polite off-topic redirection helpers
 * for the Learnix Student and Teacher AI Assistants.
 */

export const LEARNIX_OFF_TOPIC_REDIRECT_AR =
  "آسف، أنا مساعد Learnix ومخصص لمساعدتك في المواد الدراسية والكورسات واستخدام المنصة. ممكن تتوجه لمساعد AI متخصص في الموضوع ده عشان يقدر يساعدك بشكل أفضل.";

export const LEARNIX_OFF_TOPIC_REDIRECT_EN =
  "I'm sorry, I'm the Learnix educational assistant, and I specialize in courses, learning materials, and using the Learnix platform. You may want to ask an AI assistant specialized in that topic for a more suitable answer.";

export function detectAssistantLanguage(text: string): "ar" | "en" {
  const arabicMatches = text.match(/[\u0600-\u06FF]/g);
  const latinMatches = text.match(/[a-zA-Z]/g);
  const arabicCount = arabicMatches ? arabicMatches.length : 0;
  const latinCount = latinMatches ? latinMatches.length : 0;

  if (arabicCount > 0 && arabicCount >= latinCount * 0.35) {
    return "ar";
  }
  return "en";
}

export function getPoliteOffTopicRedirection(lang: "ar" | "en"): string {
  return lang === "ar"
    ? LEARNIX_OFF_TOPIC_REDIRECT_AR
    : LEARNIX_OFF_TOPIC_REDIRECT_EN;
}

const EDUCATIONAL_OR_PLATFORM_SIGNALS: ReadonlyArray<RegExp> = [
  /\b(?:learnix|course|courses|lesson|lessons|chapter|module|lecture|syllabus|curriculum|study|studying|learn|learning|quiz|quizzes|exam|exams|test|assignment|assignments|homework|grade|grades|score|progress|attendance|certificate|teacher|instructor|professor|student|enroll|enrollment|dashboard|platform|upload|pdf|docx|pptx|slide|slides|note|notes|flashcard|flashcards|summary|summarize|explain|definition|concept|formula|theorem|solve|practice|rubric|feedback)\b/i,
  /\b(?:code|coding|program|programming|software|algorithm|data\s*structure|function|variable|class|object|array|loop|recursion|sql|select|insert|update|delete|join|database|postgres|mysql|nosql|schema|table|index|normalization|html|css|javascript|typescript|react|nextjs|next\.js|node|python|java|kotlin|swift|flutter|dart|android|ios|mobile|web|api|http|rest|json|cloud|aws|azure|docker|kubernetes|linux|git|cybersecurity|security|encryption|network|testing|unit\s*test|agile|scrum|bpmn|iot|sensor|analytics|statistics|probability|math|mathematics|calculus|algebra|matrix|linear|physics|chemistry|biology|economics|accounting|engineering)\b/i,
  /(?:ليرنكس|منصة|المنصة|كورس|كورسات|دورة|دورات|درس|دروس|محاضرة|محاضرات|فصل|وحدة|مادة|مواد|مذاكرة|دراسة|تعلم|تعليم|اختبار|اختبارات|امتحان|امتحانات|كويز|واجب|واجبات|درجة|درجات|تقييم|تقدم|حضور|شهادة|معلم|مدرس|دكتور|طالب|طلاب|تسجيل|ملف|ملفات|ملخص|لخص|اشرح|شرح|مفهوم|تعريف|قانون|معادلة|مسألة|تدريب|مراجعة|أسئلة|اسئلة|برمجة|كود|خوارزمية|قاعدة\s*بيانات|قواعد\s*البيانات|داتابيز|جدول|استعلام|تطبيق|ويب|موبايل|شبكات|أمن|تشفير|سحابة|تحليل\s*بيانات|رياضيات|تفاضل|تكامل|جبر|إحصاء|احصاء|فيزياء|كيمياء|أحياء|هندسة)/i,
];

const CLEAR_UNRELATED_TOPIC_PATTERNS: ReadonlyArray<RegExp> = [
  // Cooking & food recipes
  /\b(?:recipe\s+for|how\s+to\s+(?:cook|bake|fry|grill)|ingredients\s+for\s+(?:pizza|pasta|cake|biryani|burger|sushi|lasagna|cookies|shawarma|koshary))\b/i,
  /(?:طريقة\s+عمل\s+(?:البيتزا|الكشري|البسبوسة|الكيكة?|الشاورما|المكرونة|الفراخ|المحشي|الكنافة|البرياني)|وصفة\s+(?:طبخ|أكل|اكل|حلى|حلويات))/i,
  // Sports match scores, teams, betting
  /\b(?:who\s+won\s+the\s+(?:match|game|world\s+cup|champions\s+league|premier\s+league|nba|super\s+bowl)|football\s+score|soccer\s+match\s+tonight|sports\s+betting|real\s+madrid\s+vs|barcelona\s+vs)\b/i,
  /(?:نتيجة\s+(?:مباراة|ماتش)|موعد\s+(?:مباراة|ماتش)|مين\s+(?:كسب|هيكسب)\s+(?:الماتش|المباراة)|الأهلي\s+والزمالك|الاهلي\s+والزمالك|دوري\s+أبطال\s+أوروبا|كأس\s+العالم)/i,
  // Horoscopes & astrology
  /\b(?:my\s+horoscope|zodiac\s+sign\s+prediction|astrology\s+reading|tarot\s+reading)\b/i,
  /(?:توقعات\s+الأبراج|توقعات\s+الابراج|حظك\s+اليوم|برج\s+(?:الحمل|الثور|الجوزاء|السرطان|الأسد|العذراء|الميزان|العقرب|القوس|الجدي|الدلو|الحوت))/i,
  // Weather forecasts
  /\b(?:weather\s+forecast\s+(?:today|tomorrow|in)|will\s+it\s+rain\s+tomorrow\s+in)\b/i,
  /(?:حالة\s+الطقس\s+(?:اليوم|بكرة|غدا|غداً)|درجة\s+الحرارة\s+(?:النهاردة|اليوم|بكرة))/i,
  // Entertainment / celebrity gossip / movie recommendations
  /\b(?:celebrity\s+gossip|recommend\s+a\s+(?:netflix|horror|action|comedy|romantic)\s+(?:movie|series)|box\s+office\s+movies)\b/i,
  /(?:رشحلي\s+(?:فيلم|مسلسل)|أخبار\s+الفنانين|اخبار\s+المشاهير|مسلسلات\s+رمضان)/i,
  // Crypto/stock price speculation & travel booking
  /\b(?:bitcoin\s+price\s+prediction|which\s+meme\s+coin\s+to\s+buy|book\s+a\s+cheap\s+flight|best\s+hotels\s+in\s+dubai)\b/i,
  /(?:توقعات\s+سعر\s+البيتكوين|حجز\s+طيران|أفضل\s+فنادق\s+للسياحة)/i,
];

/**
 * High-precision pre-check that ONLY flags unmistakably non-educational, non-Learnix prompts
 * when zero educational, technical, academic, or platform signals appear in the message.
 * Nuanced or borderline prompts are always passed to the Groq LLM with scope instructions.
 */
export function detectClearlyUnrelatedOffTopicPrompt(prompt: string): {
  isOffTopic: boolean;
  detectedLang: "ar" | "en";
  redirectionMessage?: string;
} {
  const trimmed = prompt.trim();
  const detectedLang = detectAssistantLanguage(trimmed);
  if (!trimmed) {
    return { isOffTopic: false, detectedLang };
  }

  // Never block if any educational, technical, course, or Learnix keyword is present
  if (EDUCATIONAL_OR_PLATFORM_SIGNALS.some((rx) => rx.test(trimmed))) {
    return { isOffTopic: false, detectedLang };
  }

  if (CLEAR_UNRELATED_TOPIC_PATTERNS.some((rx) => rx.test(trimmed))) {
    return {
      isOffTopic: true,
      detectedLang,
      redirectionMessage: getPoliteOffTopicRedirection(detectedLang),
    };
  }

  return { isOffTopic: false, detectedLang };
}

/**
 * Shared prompt policy block injected into both Student and Teacher AI Assistants.
 */
export function buildLearnixScopeAndRedirectionPolicy(): string {
  return [
    "=== LEARNIX AI SCOPE & OFF-TOPIC REDIRECTION POLICY ===",
    "You are the Learnix educational assistant. You MUST helpfully answer questions related to:",
    "- The user's selected course, lessons, chapters, and study topics.",
    "- Uploaded educational materials (PDFs, documents, slides, notes).",
    "- Legitimate course-related and academic/technical questions (for example: programming, SQL, databases, mathematics, computer science, engineering, data analysis, cybersecurity, or exam/quiz preparation), EVEN IF the exact example or subtopic is not explicitly written in the current lesson.",
    "- Student learning progress, assignments, quizzes, and grades (using only verified authorized data).",
    "- How to use Learnix, Learnix platform features, navigation, and student or teacher workflows.",
    "AMBIGUOUS QUESTIONS RULE:",
    "- If a user's question is brief or ambiguous, ask a short, friendly clarifying question instead of rejecting it. NEVER use the off-topic redirection for legitimate educational or technical questions.",
    "OFF-TOPIC QUESTIONS RULE:",
    "- ONLY if the user asks about a topic completely unrelated to education, academic learning, courses, or the Learnix platform (such as cooking recipes, sports match scores, horoscopes, celebrity gossip, movies, weather forecasts, or shopping), DO NOT answer the unrelated question.",
    "- Instead, respond politely, shortly, warmly, professionally, and non-judgmentally in the user's language:",
    `  * If the user writes in Arabic, respond naturally (for example): "${LEARNIX_OFF_TOPIC_REDIRECT_AR}"`,
    `  * If the user writes in English, respond naturally (for example): "${LEARNIX_OFF_TOPIC_REDIRECT_EN}"`,
    "- Never scold the user or make them feel they did something wrong.",
  ].join("\n");
}
