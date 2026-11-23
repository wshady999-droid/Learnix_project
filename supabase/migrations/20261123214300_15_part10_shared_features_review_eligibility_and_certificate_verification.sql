-- =============================================================================
-- Migration 15: Part 10 Shared Features Hardening
-- 1. Enforce completed-course eligibility on course_reviews INSERT
-- 2. Add public certificate verification RPC (safe non-PII lookup by certificate_number or hash)
-- =============================================================================

-- 1. Tighten course_reviews INSERT policy so ONLY students who completed the course (progress_percent >= 100 or status = 'completed') can rate it
DROP POLICY IF EXISTS course_reviews_insert_enrolled_student ON public.course_reviews;

CREATE POLICY course_reviews_insert_completed_student ON public.course_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.course_enrollments ce
      WHERE ce.course_id = course_reviews.course_id
        AND ce.student_id = (SELECT auth.uid())
        AND (ce.status = 'completed' OR ce.progress_percent >= 100)
    )
  );

-- 2. Public Certificate Verification Function (SECURITY DEFINER in private + SECURITY INVOKER wrapper in public)
CREATE OR REPLACE FUNCTION private.verify_certificate_internal(p_code_or_hash text)
RETURNS TABLE (
  certificate_number text,
  verification_hash text,
  student_name text,
  course_code text,
  course_title text,
  final_score numeric,
  issued_at timestamptz,
  is_revoked boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    c.certificate_number,
    c.verification_hash,
    COALESCE(p.full_name, 'Learnix Graduate') AS student_name,
    co.code AS course_code,
    co.title AS course_title,
    c.final_score,
    c.issued_at,
    (c.revoked_at IS NOT NULL) AS is_revoked
  FROM public.certificates c
  JOIN public.courses co ON co.id = c.course_id
  JOIN public.profiles p ON p.id = c.student_id
  WHERE c.certificate_number = trim(p_code_or_hash)
     OR c.verification_hash = trim(p_code_or_hash)
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.verify_certificate(p_code_or_hash text)
RETURNS TABLE (
  certificate_number text,
  verification_hash text,
  student_name text,
  course_code text,
  course_title text,
  final_score numeric,
  issued_at timestamptz,
  is_revoked boolean
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT * FROM private.verify_certificate_internal(p_code_or_hash);
$$;

GRANT EXECUTE ON FUNCTION private.verify_certificate_internal(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_certificate(text) TO anon, authenticated, service_role;
