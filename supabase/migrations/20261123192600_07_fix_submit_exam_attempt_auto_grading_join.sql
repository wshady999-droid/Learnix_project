-- =============================================================================
-- Learnix (BrainUp) — Migration 7: Subquery Auto-Grading Join in submit_exam_attempt
-- =============================================================================

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
  set is_correct = coalesce(
        (
          select qo.is_correct
          from public.question_options qo
          where qo.id = sa.selected_option_id
            and qo.question_id = q.id
        ),
        false
      ),
      points_awarded = case
        when coalesce(
          (
            select qo.is_correct
            from public.question_options qo
            where qo.id = sa.selected_option_id
              and qo.question_id = q.id
          ),
          false
        ) then q.points
        else 0
      end,
      updated_at = timezone('utc', now())
  from public.questions q
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
