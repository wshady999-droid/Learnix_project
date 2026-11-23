-- =============================================================================
-- Migration 14: Part 9 Learnix AI Ecosystem
-- Tables: ai_conversations, ai_messages, ai_document_chunks, ai_usage_logs, essay_grade_history
-- =============================================================================

-- 1. Enable pgvector in extensions schema (keeps public clean)
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 2. AI Conversations (isolated strictly to owner user_id)
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_context text NOT NULL DEFAULT 'student' CHECK (role_context IN ('student', 'teacher', 'admin')),
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  lesson_id uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
  mode text NOT NULL DEFAULT 'chat',
  title text NOT NULL DEFAULT 'New AI Session',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_updated
  ON public.ai_conversations (user_id, updated_at DESC);

-- 3. AI Messages (with source citations & thumbs up/down feedback)
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  structured_payload jsonb,
  feedback_rating smallint CHECK (feedback_rating IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conv_created
  ON public.ai_messages (conversation_id, created_at ASC);

-- 4. AI Document Chunks (RAG knowledge store for enrolled courses, lessons & uploaded PDFs)
CREATE TABLE IF NOT EXISTS public.ai_document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES public.lessons(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_title text NOT NULL,
  source_type text NOT NULL DEFAULT 'lesson' CHECK (source_type IN ('lesson', 'pdf', 'presentation', 'resource')),
  chunk_index integer NOT NULL DEFAULT 0,
  content text NOT NULL,
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce(source_title, '') || ' ' || coalesce(content, ''))) STORED,
  embedding extensions.vector(768),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_ai_document_chunks_course
  ON public.ai_document_chunks (course_id, lesson_id);

CREATE INDEX IF NOT EXISTS idx_ai_document_chunks_tsv
  ON public.ai_document_chunks USING GIN (tsv);

-- 5. AI Usage Logs (rate limiting, throttling, quota & audit metadata)
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_context text NOT NULL DEFAULT 'student',
  feature text NOT NULL,
  provider text NOT NULL DEFAULT 'learnix-grounded',
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  prompt_chars integer NOT NULL DEFAULT 0,
  response_chars integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'blocked_exam', 'rate_limited', 'error')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_created
  ON public.ai_usage_logs (user_id, created_at DESC);

-- 6. Essay Grade History (tracks AI suggestions & teacher modifications)
CREATE TABLE IF NOT EXISTS public.essay_grade_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id uuid NOT NULL REFERENCES public.student_answers(id) ON DELETE CASCADE,
  attempt_id uuid NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
  graded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  source text NOT NULL CHECK (source IN ('ai_suggestion', 'teacher_approval', 'teacher_override')),
  points_awarded numeric(6,2) NOT NULL,
  feedback text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_essay_grade_history_answer
  ON public.essay_grade_history (answer_id, created_at DESC);

-- 7. Enable RLS on all Part 9 tables
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.essay_grade_history ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies (strict privacy: users can NEVER read other users' AI conversations)
CREATE POLICY ai_conversations_own_all ON public.ai_conversations
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY ai_messages_own_all ON public.ai_messages
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY ai_document_chunks_select_authorized ON public.ai_document_chunks
  FOR SELECT TO authenticated
  USING (
    uploaded_by = (SELECT auth.uid())
    OR (SELECT private.is_enrolled_in_course(course_id))
    OR (SELECT private.is_course_teacher(course_id))
    OR (SELECT private.is_admin())
  );

CREATE POLICY ai_document_chunks_insert_authorized ON public.ai_document_chunks
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = (SELECT auth.uid())
    AND (
      (SELECT private.is_enrolled_in_course(course_id))
      OR (SELECT private.is_course_teacher(course_id))
      OR (SELECT private.is_admin())
    )
  );

CREATE POLICY ai_document_chunks_delete_owner_or_teacher ON public.ai_document_chunks
  FOR DELETE TO authenticated
  USING (
    uploaded_by = (SELECT auth.uid())
    OR (SELECT private.is_course_teacher(course_id))
    OR (SELECT private.is_admin())
  );

CREATE POLICY ai_usage_logs_own_insert ON public.ai_usage_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY ai_usage_logs_select_own_or_admin ON public.ai_usage_logs
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT private.is_admin())
  );

CREATE POLICY essay_grade_history_select_authorized ON public.essay_grade_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.exam_attempts ea
      JOIN public.exams e ON e.id = ea.exam_id
      WHERE ea.id = essay_grade_history.attempt_id
        AND (
          ea.student_id = (SELECT auth.uid())
          OR (SELECT private.is_course_teacher(e.course_id))
          OR (SELECT private.is_admin())
        )
    )
  );

CREATE POLICY essay_grade_history_insert_teacher_or_admin ON public.essay_grade_history
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.exam_attempts ea
      JOIN public.exams e ON e.id = ea.exam_id
      WHERE ea.id = essay_grade_history.attempt_id
        AND (
          (SELECT private.is_course_teacher(e.course_id))
          OR (SELECT private.is_admin())
        )
    )
  );

-- 9. Grants for authenticated and service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_conversations TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_messages TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_document_chunks TO authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.ai_usage_logs TO authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.essay_grade_history TO authenticated, service_role;
