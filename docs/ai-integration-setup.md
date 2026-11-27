# Centralized Groq AI Integration Setup Guide

Learnix uses a centralized, server-only AI architecture powered by **Groq** (`supabase/functions/learnix-ai/index.ts` Supabase Edge Function + Next.js Server Route Handlers) using Groq's OpenAI-compatible Chat Completions API (`https://api.groq.com/openai/v1/chat/completions`).

---

## 1. Security Guarantees

1. **Zero Frontend Key Exposure**: `GROQ_API_KEY` is **never** placed in client components, browser network calls, logs, Git commits, or `NEXT_PUBLIC_*` / `VITE_*` variables.
2. **Supabase Edge Function Secrets**: Production AI requests authenticate the user's JWT + active profile status and invoke the `learnix-ai` Edge Function (`supabase/functions/learnix-ai/index.ts`), which reads `GROQ_API_KEY`, `GROQ_MODEL`, and `AI_PROVIDER` securely via `Deno.env.get(...)`.
3. **Human-in-the-Loop Grading**: AI-generated assignment and short-answer/essay grades are stored strictly as unpublished suggestions (`is_published = false`) until a teacher reviews, edits if needed, and clicks **Approve & Publish Grade**.
4. **Role & Course Isolation**: Students can only query internal materials, assignments, and grades belonging to their own enrollments; teachers can only query courses and students they own; active official exam attempts automatically lock the Student AI Assistant.
5. **Rate Limiting & Error Resilience**: Every AI request is throttled (`12 req/min`, `150 req/day` per user), audited in `public.ai_usage_logs`, protected by a 30-second timeout, and validated for strict JSON integrity before returning structured responses.

---

## 2. Creating a Groq API Key

1. Sign in to the Groq Cloud Console at https://console.groq.com.
2. Navigate to **API Keys** (`https://console.groq.com/keys`).
3. Click **Create API Key**, enter a descriptive name (e.g., `learnix-supabase-edge`), and copy the generated key (`gsk_...`).
4. Store the key **only** in Supabase Edge Function Secrets (and optionally in your local gitignored `.env.local` for local server fallback). Never commit it to Git.

---

## 3. Supabase Edge Function Secrets Configuration

Configure the following secrets in **Supabase Dashboard → Project Settings / Edge Functions → Secrets** (or via the Supabase CLI):

```bash
supabase secrets set AI_PROVIDER=groq
supabase secrets set GROQ_API_KEY=your_groq_api_key_here
supabase secrets set GROQ_MODEL=openai/gpt-oss-120b
```

> **Model Availability Note:** Groq retired `llama-3.3-70b-versatile` (and `llama-3.1-8b-instant`) for standard developer/free keys, returning `HTTP 404` (`model_not_found`). Verified active chat/tool-calling/JSON models on Groq include `openai/gpt-oss-120b` (recommended default), `openai/gpt-oss-20b`, and `qwen/qwen3.8-27b`.
>
> **Migration Note (Temporary Legacy Secrets):** Keep the old `GEMINI_API_KEY` and `GEMINI_MODEL` secrets in Supabase temporarily until the Groq deployment has been verified end-to-end in production; once verified, they can be safely removed via `supabase secrets unset GEMINI_API_KEY GEMINI_MODEL`.

---

## 4. Required Environment Variables

| Variable | Location | Required | Default / Example | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `AI_PROVIDER` | Supabase Edge Secrets (optional `.env.local`) | Yes | `groq` | Selects Groq as the active AI provider |
| `GROQ_API_KEY` | Supabase Edge Secrets (optional `.env.local`) | Yes | *(secret `gsk_...`)* | Authenticates server/Edge requests to `https://api.groq.com/openai/v1` |
| `GROQ_MODEL` | Supabase Edge Secrets (optional `.env.local`) | Yes | `openai/gpt-oss-120b` | Default Groq model for chat, tool calling, quiz JSON generation, and grading |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` / Hosting | Yes | `https://<project-ref>.supabase.co` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local` / Hosting | Yes | `sb_publishable_...` | Public anon/publishable key (protected by RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` / Hosting (Server-Only) | Recommended | *(secret)* | Server-only admin provisioning & privileged server tasks |

### Configuring or Switching the Groq Model

To change the active Groq model without editing application code:
1. Update `GROQ_MODEL` in **Supabase Dashboard → Edge Functions → Secrets** (for example `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, or `qwen/qwen3.8-27b`).
2. Ensure any chosen replacement model supports OpenAI-compatible tool calling (`tools`) and JSON object mode (`response_format: { type: "json_object" }`).

### Deploying the `learnix-ai` Edge Function (After Approval)

```bash
npx supabase functions deploy learnix-ai --project-ref <your-project-ref>
```

---

## 5. Supported Centralized AI Capabilities

| Capability | Endpoint / Service | Role |
| :--- | :--- | :--- |
| **Student AI Assistant** (Course Materials, Academic/Technical Q&A, Practice Quizzes, Summaries, Flashcards, Verified Progress, Platform Help, Polite Off-Topic Redirection) | `POST /api/ai/student` → `learnix-ai` (`mode: "agent_turn"`) | Student |
| **Teacher AI Assistant & Analytics Insights** (Performance Analysis, Missing Work, Teaching Plans, Platform Help, Polite Off-Topic Redirection) | `POST /api/ai/teacher` → `learnix-ai` (`mode: "generate"`) | Teacher / Admin |
| **Clean AI Quiz Generation & Question Replacement** (Sequential questions + `A. / B. / C. / D.` choices only, grounded in uploaded PDFs & lessons) | `POST /api/ai/teacher` (`mode: "exam_generator" \| "question_generator" \| "pdf_questions" \| "lesson_questions" \| "question_replacement"`) → `learnix-ai` | Teacher / Admin |
| **AI Assignment Grading Suggestions** (Evaluates written answers + extracted PDF/DOCX/PPTX/TXT text against rubric) | `POST /api/ai/grade-assignment` → `learnix-ai` | Teacher / Admin |
| **AI Quiz Short-Answer / Essay Grading Suggestions** | `POST /api/ai/grade-essay` → `learnix-ai` | Teacher / Admin |
| **Learning Material Ingestion (RAG Chunks)** | `POST /api/ai/ingest` | Student / Teacher / Admin |

---

## 6. Testing AI Features

1. **Build & Static Verification**:
   ```bash
   npm run typecheck
   npm run lint
   npm run build
   ```
2. **Clean Quiz Generation**:
   - Sign in as a Teacher → open **Courses** or **AI Assistant** → upload a course PDF/TXT material → open **Quizzes → AI Quiz Generator** → generate a quiz and click **Preview Quiz**.
   - Verify the generated output displays **only** sequential questions (`Question 1:`, `Question 2:`, ...) and labeled options (`A.`, `B.`, `C.`, `D.`) with no course codes, subject names, internal IDs, or AI introductions.
3. **Educational & Learnix Platform Q&A**:
   - Sign in as a Student → open **AI Study Assistant** (`/student/ai-assistant`) → ask a course/SQL/programming question and a Learnix platform question (e.g., *"How do I enroll in a course on Learnix?"*).
4. **Polite Off-Topic Redirection**:
   - Ask an unrelated question in Arabic or English (e.g., cooking recipes or sports scores) and verify the assistant politely declines and explains that it specializes in Learnix and educational topics without answering the off-topic query.
