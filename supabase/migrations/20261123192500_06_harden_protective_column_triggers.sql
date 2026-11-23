-- =============================================================================
-- Learnix (BrainUp) — Migration 6: Harden Protective Column Triggers
-- Ensures SECURITY DEFINER trigger functions evaluate the caller's session role
-- (`current_setting('role', true)`) and `auth.uid()` rather than `current_user`
-- (which resolves to the definer inside SECURITY DEFINER functions).
-- =============================================================================

create or replace function private.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('role', true), '') not in ('authenticated', 'anon')
     and (select auth.uid()) is null then
    return new;
  end if;

  if not (select private.is_admin()) then
    if new.role is distinct from old.role then
      raise exception 'Forbidden: users cannot modify their own role.';
    end if;
    if new.status is distinct from old.status then
      raise exception 'Forbidden: users cannot modify their own account status.';
    end if;
    if new.email is distinct from old.email then
      raise exception 'Forbidden: email address changes must go through auth verification.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.protect_submission_grading_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course_id uuid;
begin
  if coalesce(current_setting('role', true), '') not in ('authenticated', 'anon')
     and (select auth.uid()) is null then
    return new;
  end if;

  select a.course_id into v_course_id
  from public.assignments a
  where a.id = new.assignment_id;

  if not ((select private.is_admin()) or (select private.is_course_teacher(v_course_id))) then
    if new.grade_points is distinct from old.grade_points
       or new.graded_by is distinct from old.graded_by
       or new.graded_at is distinct from old.graded_at
       or new.feedback is distinct from old.feedback
       or (new.status is distinct from old.status and new.status = 'graded') then
      raise exception 'Forbidden: students cannot modify assignment grades or teacher feedback.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.protect_student_answer_grading_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course_id uuid;
begin
  -- Allow internal auto-grading inside private.submit_exam_attempt_internal
  if coalesce(current_setting('learnix.internal_grading', true), '') = 'true' then
    return new;
  end if;

  if coalesce(current_setting('role', true), '') not in ('authenticated', 'anon')
     and (select auth.uid()) is null then
    return new;
  end if;

  select e.course_id into v_course_id
  from public.exam_attempts ea
  join public.exams e on e.id = ea.exam_id
  where ea.id = new.attempt_id;

  if not ((select private.is_admin()) or (select private.is_course_teacher(v_course_id))) then
    if (tg_op = 'INSERT' and (new.points_awarded is not null or new.is_correct is not null or new.teacher_feedback is not null))
       or (tg_op = 'UPDATE' and (
         new.points_awarded is distinct from old.points_awarded
         or new.is_correct is distinct from old.is_correct
         or new.teacher_feedback is distinct from old.teacher_feedback
       )) then
      raise exception 'Forbidden: students cannot set or modify answer grading fields.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.submit_exam_attempt_internal(p_attempt_id uuid)
returns public.results
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := (select auth.uid());
  v_attempt public.exam_attempts;
  v_exam public.exams;
  v_earned numeric(7,2) := 0;
  v_score_percent numeric(5,2) := 0;
  v_passed boolean := false;
  v_result public.results;
begin
  if v_caller_id is null then
    raise exception 'Authentication required to submit an exam attempt.';
  end if;

  select * into v_attempt
  from public.exam_attempts
  where id = p_attempt_id
  for update;

  if not found then
    raise exception 'Exam attempt not found.';
  end if;

  select * into v_exam
  from public.exams
  where id = v_attempt.exam_id;

  if v_attempt.student_id <> v_caller_id
     and not (select private.is_admin())
     and not (select private.is_course_teacher(v_exam.course_id)) then
    raise exception 'Forbidden: you are not authorized to submit this exam attempt.';
  end if;

  if v_attempt.status not in ('in_progress', 'submitted') then
    raise exception 'Exam attempt cannot be graded in status %.', v_attempt.status;
  end if;

  perform set_config('learnix.internal_grading', 'true', true);

  update public.student_answers sa
  set is_correct = coalesce(qo.is_correct, false),
      points_awarded = case when coalesce(qo.is_correct, false) then q.points else 0 end,
      updated_at = timezone('utc', now())
  from public.questions q
  left join public.question_options qo on qo.id = sa.selected_option_id and qo.question_id = q.id
  where sa.attempt_id = p_attempt_id
    and sa.question_id = q.id
    and q.question_type in ('single_choice', 'true_false');

  perform set_config('learnix.internal_grading', 'false', true);

  select coalesce(sum(coalesce(sa.points_awarded, 0)), 0)
  into v_earned
  from public.student_answers sa
  where sa.attempt_id = p_attempt_id;

  if v_exam.total_points > 0 then
    v_score_percent := least(100, round((v_earned / v_exam.total_points) * 100, 2));
  end if;
  v_passed := v_score_percent >= v_exam.passing_score;

  update public.exam_attempts
  set status = 'graded',
      submitted_at = coalesce(submitted_at, timezone('utc', now())),
      updated_at = timezone('utc', now())
  where id = p_attempt_id;

  insert into public.results (
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
  values (
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
  on conflict (attempt_id) do update
  set earned_points = excluded.earned_points,
      score_percent = excluded.score_percent,
      passed = excluded.passed,
      updated_at = timezone('utc', now())
  returning * into v_result;

  return v_result;
end;
$$;
