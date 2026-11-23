-- =============================================================================
-- Migration 11: Student Auto-Certificate Issuance RPC on Course Completion
-- =============================================================================

CREATE OR REPLACE FUNCTION public.issue_my_course_certificate(p_course_id uuid)
RETURNS public.certificates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_enrollment public.course_enrollments%ROWTYPE;
  v_course public.courses%ROWTYPE;
  v_existing public.certificates%ROWTYPE;
  v_created public.certificates%ROWTYPE;
  v_best_score numeric(5,2);
  v_cert_number text;
  v_hash text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required to claim a course certificate.';
  END IF;

  SELECT * INTO v_existing
  FROM public.certificates
  WHERE course_id = p_course_id
    AND student_id = v_uid
  LIMIT 1;

  IF FOUND THEN
    RETURN v_existing;
  END IF;

  SELECT * INTO v_enrollment
  FROM public.course_enrollments
  WHERE course_id = p_course_id
    AND student_id = v_uid
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You are not enrolled in this course.';
  END IF;

  IF v_enrollment.progress_percent < 100 AND v_enrollment.status <> 'completed' THEN
    RAISE EXCEPTION 'Complete 100%% of the course lessons before claiming your certificate.';
  END IF;

  SELECT * INTO v_course
  FROM public.courses
  WHERE id = p_course_id
  LIMIT 1;

  SELECT MAX(r.score_percent) INTO v_best_score
  FROM public.results r
  WHERE r.course_id = p_course_id
    AND r.student_id = v_uid;

  v_cert_number := 'LRX-' || UPPER(SUBSTRING(REPLACE(p_course_id::text, '-', ''), 1, 6))
                   || '-' || UPPER(SUBSTRING(REPLACE(v_uid::text, '-', ''), 1, 6));
  v_hash := MD5(v_cert_number || '-' || NOW()::text || '-' || v_uid::text);

  INSERT INTO public.certificates (
    course_id,
    student_id,
    certificate_number,
    verification_hash,
    final_score,
    issued_by,
    issued_at
  )
  VALUES (
    p_course_id,
    v_uid,
    v_cert_number,
    v_hash,
    COALESCE(v_best_score, 100),
    v_course.teacher_id,
    NOW()
  )
  RETURNING * INTO v_created;

  RETURN v_created;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_my_course_certificate(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_my_course_certificate(uuid) TO authenticated, service_role;
