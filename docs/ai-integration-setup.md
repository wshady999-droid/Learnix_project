# Centralized Gemini AI Integration Setup Guide

Learnix uses a centralized, server-only AI architecture powered by **Google Gemini** (`learnix-ai` Supabase Edge Function + Next.js Server Route Handlers).

## Security Guarantees

1. **Zero Frontend Key Exposure**: The Gemini API key is **never** placed in client components, browser network calls, or `NEXT_PUBLIC_*` / `VITE_*` variables.
2. **Supabase Edge Function Secrets**: All requests authenticate the logged-in user's JWT and invoke the deployed `learnix-ai` Edge Function (`supabase/functions/learnix-ai/index.ts`).
3. **Human-in-the-Loop Grading**: AI-generated assignment and short-answer quiz grades are stored strictly as unpublished suggestions (`is_published = false`) until a teacher reviews, edits if needed, and clicks **Approve & Publish Grade**.
4. **Role & Course Isolation**: Students can only query materials, assignments, and grades belonging to their own enrollments; teachers can only query courses and students they teach; active quiz attempts automatically lock the Student AI Assistant.
5. **Rate Limiting & Auditing**: Every AI request is throttled (12 req/min, 150 req/day per user) and recorded in `public.ai_usage_logs`.

---

## Configuring Supabase Edge Function Secrets (Recommended)

Set the following secrets in **Supabase Dashboard → Edge Functions → Secrets** (or via the Supabase CLI):

```bash
supabase secrets set AI_PROVIDER=gemini
supabase secrets set GEMINI_API_KEY=YOUR_GEMINI_API_KEY
supabase secrets set GEMINI_MODEL=gemini-2.5-flash
```

### Supported Key Formats
- **Google AI Studio Keys (`AIza...`)**: Automatically routed to `https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent`.
- **Vertex AI Express Mode Keys (`AQ....`)**: Automatically routed to `https://aiplatform.googleapis.com/v1/publishers/google/models/{GEMINI_MODEL}:generateContent`.

### Local Server Development Fallback (`.env.local`)
For local Next.js server-only testing (never committed to Git), you may also set in `.env.local`:

```env
AI_PROVIDER=gemini
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_MODEL=gemini-2.5-flash
```

---

## Supported Centralized AI Capabilities

| Capability | Endpoint / Service | Role |
| :--- | :--- | :--- |
| **Student AI Assistant** (Chat, Lesson Explanations, Course Summaries, Practice Questions, Assignment/Quiz Explanations, Recommendations) | `POST /api/ai/student` → `learnix-ai` | Student |
| **Teacher AI Assistant & Performance Insights** | `POST /api/ai/teacher` → `learnix-ai` | Teacher / Admin |
| **AI Quiz Generation & Single-Question Replacement** | `POST /api/ai/teacher` (`mode: "exam_generator" \| "question_replacement"`) → `learnix-ai` | Teacher / Admin |
| **AI Assignment Grading Suggestions** (Reads written answers + PDF/DOCX/PPTX/TXT files + teacher rubric) | `POST /api/ai/grade-assignment` → `learnix-ai` | Teacher / Admin |
| **AI Quiz Short-Answer / Essay Grading Suggestions** | `POST /api/ai/grade-essay` → `learnix-ai` | Teacher / Admin |
