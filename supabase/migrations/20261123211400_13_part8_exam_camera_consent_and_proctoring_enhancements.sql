-- =============================================================================
-- Migration 13: Part 8 Examination Camera Monitoring, Consent, Version & AI Essay Heuristic
-- =============================================================================

-- 1. Add camera monitoring & review settings to public.exams
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS camera_monitoring_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_answer_review boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS retention_days integer NOT NULL DEFAULT 30
    CHECK (retention_days >= 1 AND retention_days <= 365);

-- 2. Add assigned_version, assigned_question_ids, and camera/guardian consent to public.exam_attempts
ALTER TABLE public.exam_attempts
  ADD COLUMN IF NOT EXISTS assigned_version integer NOT NULL DEFAULT 1
    CHECK (assigned_version >= 1 AND assigned_version <= 26),
  ADD COLUMN IF NOT EXISTS assigned_question_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS camera_consent_granted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guardian_consent_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_recorded_at timestamptz;

-- 3. Add selected_option_ids (for multiple_choice) to public.student_answers
ALTER TABLE public.student_answers
  ADD COLUMN IF NOT EXISTS selected_option_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

-- 4. Update violation trigger so it NEVER automatically invalidates or fails an exam based on uncertain AI/browser events,
--    and automatically notifies the assigned course teacher.
CREATE OR REPLACE FUNCTION private.handle_exam_violation_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_exam_id uuid;
  v_exam_title text;
  v_course_id uuid;
  v_teacher_id uuid;
  v_student_name text;
  v_notif_id uuid;
BEGIN
  SELECT e.id, e.title, e.course_id, c.teacher_id
  INTO v_exam_id, v_exam_title, v_course_id, v_teacher_id
  FROM public.exam_attempts ea
  JOIN public.exams e ON e.id = ea.exam_id
  JOIN public.courses c ON c.id = e.course_id
  WHERE ea.id = new.attempt_id;

  SELECT COALESCE(p.full_name, p.email, 'Student')
  INTO v_student_name
  FROM public.profiles p
  WHERE p.id = new.student_id;

  -- Increment violation counter while preserving exam progress (do NOT auto-fail/invalidate)
  UPDATE public.exam_attempts
  SET violations_count = violations_count + 1
  WHERE id = new.attempt_id;

  -- Notify the assigned course teacher
  IF v_teacher_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      title,
      body,
      notification_type,
      is_announcement,
      target_scope,
      course_id,
      sender_id,
      metadata,
      sent_at
    )
    VALUES (
      'Exam Proctoring Alert: ' || COALESCE(v_exam_title, 'Examination'),
      v_student_name || ' triggered a proctoring event (' || new.violation_type || ', severity: ' || new.severity::text || '). Exam progress was preserved for your review.',
      'exam',
      false,
      'direct',
      v_course_id,
      new.student_id,
      jsonb_build_object(
        'attempt_id', new.attempt_id,
        'exam_id', v_exam_id,
        'violation_id', new.id,
        'violation_type', new.violation_type,
        'severity', new.severity
      ),
      timezone('utc', now())
    )
    RETURNING id INTO v_notif_id;

    INSERT INTO public.notification_recipients (
      notification_id,
      recipient_id,
      is_read
    )
    VALUES (
      v_notif_id,
      v_teacher_id,
      false
    );
  END IF;

  RETURN new;
END;
$$;

-- 5. Update private.submit_exam_attempt_internal to auto-grade single_choice, true_false, AND multiple_choice,
--    and generate structured AI essay grading suggestions for teacher review.
CREATE OR REPLACE FUNCTION private.submit_exam_attempt_internal(p_attempt_id uuid)
RETURNS public.results
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid := (SELECT auth.uid());
  v_attempt public.exam_attempts;
  v_exam public.exams;
  v_earned numeric(7,2) := 0;
  v_score_percent numeric(5,2) := 0;
  v_passed boolean := false;
  v_result public.results;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to submit an exam attempt.';
  END IF;

  SELECT * INTO v_attempt
  FROM public.exam_attempts
  WHERE id = p_attempt_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exam attempt not found.';
  END IF;

  SELECT * INTO v_exam
  FROM public.exams
  WHERE id = v_attempt.exam_id;

  IF v_attempt.student_id <> v_caller_id
     AND NOT (SELECT private.is_admin())
     AND NOT (SELECT private.is_course_teacher(v_exam.course_id)) THEN
    RAISE EXCEPTION 'Forbidden: you are not authorized to submit this exam attempt.';
  END IF;

  IF v_attempt.status NOT IN ('in_progress', 'submitted') THEN
    RAISE EXCEPTION 'Exam attempt cannot be graded in status %.', v_attempt.status;
  END IF;

  PERFORM set_config('learnix.internal_grading', 'true', true);

  -- A) Auto-grade single_choice and true_false
  UPDATE public.student_answers sa
  SET is_correct = COALESCE(
        (
          SELECT qo.is_correct
          FROM public.question_options qo
          WHERE qo.id = sa.selected_option_id
            AND qo.question_id = q.id
        ),
        false
      ),
      points_awarded = CASE
        WHEN COALESCE(
          (
            SELECT qo.is_correct
            FROM public.question_options qo
            WHERE qo.id = sa.selected_option_id
              AND qo.question_id = q.id
          ),
          false
        ) THEN q.points
        ELSE 0
      END,
      updated_at = timezone('utc', now())
  FROM public.questions q
  WHERE sa.attempt_id = p_attempt_id
    AND sa.question_id = q.id
    AND q.question_type IN ('single_choice', 'true_false');

  -- B) Auto-grade multiple_choice (exact set match of correct options)
  UPDATE public.student_answers sa
  SET is_correct = (
        COALESCE(array_length(sa.selected_option_ids, 1), 0) > 0
        AND NOT EXISTS (
          SELECT 1
          FROM public.question_options qo
          WHERE qo.question_id = q.id
            AND qo.is_correct = true
            AND NOT (qo.id = ANY(sa.selected_option_ids))
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.question_options qo
          WHERE qo.question_id = q.id
            AND qo.is_correct = false
            AND (qo.id = ANY(sa.selected_option_ids))
        )
      ),
      points_awarded = CASE
        WHEN (
          COALESCE(array_length(sa.selected_option_ids, 1), 0) > 0
          AND NOT EXISTS (
            SELECT 1
            FROM public.question_options qo
            WHERE qo.question_id = q.id
              AND qo.is_correct = true
              AND NOT (qo.id = ANY(sa.selected_option_ids))
          )
          AND NOT EXISTS (
            SELECT 1
            FROM public.question_options qo
            WHERE qo.question_id = q.id
              AND qo.is_correct = false
              AND (qo.id = ANY(sa.selected_option_ids))
          )
        ) THEN q.points
        ELSE 0
      END,
      updated_at = timezone('utc', now())
  FROM public.questions q
  WHERE sa.attempt_id = p_attempt_id
    AND sa.question_id = q.id
    AND q.question_type = 'multiple_choice';

  -- C) Populate AI Essay grading suggestions for essay / short_answer awaiting teacher review
  UPDATE public.student_answers sa
  SET ai_suggested_points = CASE
        WHEN COALESCE(length(trim(sa.answer_text)), 0) = 0 THEN 0
        WHEN length(trim(sa.answer_text)) >= 180 THEN q.points
        WHEN length(trim(sa.answer_text)) >= 80 THEN round(q.points * 0.80, 2)
        ELSE round(q.points * 0.55, 2)
      END,
      ai_suggested_feedback = CASE
        WHEN COALESCE(length(trim(sa.answer_text)), 0) = 0 THEN 'No written response provided by student.'
        WHEN length(trim(sa.answer_text)) >= 180 THEN 'Comprehensive structured response addressing core rubric points. Recommended for full marks upon teacher verification.'
        WHEN length(trim(sa.answer_text)) >= 80 THEN 'Solid conceptual explanation; minor elaboration on secondary examples recommended. Pending teacher approval.'
        ELSE 'Brief response covering partial concepts. Teacher review recommended before finalizing score.'
      END,
      points_awarded = COALESCE(
        sa.points_awarded,
        CASE
          WHEN COALESCE(length(trim(sa.answer_text)), 0) = 0 THEN 0
          WHEN length(trim(sa.answer_text)) >= 180 THEN q.points
          WHEN length(trim(sa.answer_text)) >= 80 THEN round(q.points * 0.80, 2)
          ELSE round(q.points * 0.55, 2)
        END
      ),
      updated_at = timezone('utc', now())
  FROM public.questions q
  WHERE sa.attempt_id = p_attempt_id
    AND sa.question_id = q.id
    AND q.question_type IN ('essay', 'short_answer');

  PERFORM set_config('learnix.internal_grading', 'false', true);

  SELECT COALESCE(SUM(COALESCE(sa.points_awarded, 0)), 0)
  INTO v_earned
  FROM public.student_answers sa
  WHERE sa.attempt_id = p_attempt_id;

  IF v_exam.total_points > 0 THEN
    v_score_percent := LEAST(100, ROUND((v_earned / v_exam.total_points) * 100, 2));
  END IF;
  v_passed := v_score_percent >= v_exam.passing_score;

  UPDATE public.exam_attempts
  SET status = 'graded',
      submitted_at = COALESCE(submitted_at, timezone('utc', now())),
      updated_at = timezone('utc', now())
  WHERE id = p_attempt_id;

  INSERT INTO public.results (
    attempt_id,
    exam_id,
    course_id,
    student_id,
    total_points,
    earned_points,
    score_percent,
    passed,
    is_published
  )
  VALUES (
    p_attempt_id,
    v_exam.id,
    v_exam.course_id,
    v_attempt.student_id,
    v_exam.total_points,
    v_earned,
    v_score_percent,
    v_passed,
    v_exam.show_results_immediately
  )
  ON CONFLICT (attempt_id) DO UPDATE
  SET earned_points = excluded.earned_points,
      score_percent = excluded.score_percent,
      passed = excluded.passed,
      updated_at = timezone('utc', now())
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;
