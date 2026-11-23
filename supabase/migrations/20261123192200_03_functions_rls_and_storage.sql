-- =============================================================================
-- Learnix (BrainUp) — Migration 3: Security Helper Functions, Transactional
-- Domain Triggers, Strict Row-Level Security (RLS) Policies, and Storage Buckets
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. PRIVATE SECURITY & AUTHORIZATION HELPER FUNCTIONS
--    Placed in non-exposed `private` schema with `set search_path = ''`.
-- -----------------------------------------------------------------------------
create or replace function private.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.status = 'active';
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select private.current_user_role()) = 'admin', false);
$$;

create or replace function private.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select private.current_user_role()) = 'teacher', false);
$$;

create or replace function private.has_permission(p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles pr
    where pr.id = (select auth.uid())
      and pr.status = 'active'
      and (
        pr.role = 'admin'
        or exists (
          select 1
          from public.user_permissions up
          join public.permissions perm on perm.id = up.permission_id
          where up.user_id = pr.id
            and perm.code = p_code
            and up.is_granted = true
            and (up.expires_at is null or up.expires_at > timezone('utc', now()))
        )
        or exists (
          select 1
          from public.roles r
          join public.role_permissions rp on rp.role_id = r.id
          join public.permissions perm on perm.id = rp.permission_id
          where r.code = pr.role
            and perm.code = p_code
        )
      )
  );
$$;

create or replace function private.is_course_teacher(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.courses c
    where c.id = p_course_id
      and c.teacher_id = (select auth.uid())
  );
$$;

create or replace function private.is_enrolled_in_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.course_enrollments ce
    where ce.course_id = p_course_id
      and ce.student_id = (select auth.uid())
      and ce.status in ('active', 'completed')
  );
$$;

create or replace function private.is_teacher_of_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.student_teacher_assignments sta
    where sta.student_id = p_student_id
      and sta.teacher_id = (select auth.uid())
      and sta.is_active = true
  )
  or exists (
    select 1
    from public.course_enrollments ce
    join public.courses c on c.id = ce.course_id
    where ce.student_id = p_student_id
      and c.teacher_id = (select auth.uid())
  );
$$;

create or replace function private.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = p_conversation_id
      and cp.user_id = (select auth.uid())
  );
$$;

-- Restrict helper execution to authenticated/service_role (and anon for public checks)
revoke all on function private.current_user_role() from public;
revoke all on function private.is_admin() from public;
revoke all on function private.is_teacher() from public;
revoke all on function private.has_permission(text) from public;
revoke all on function private.is_course_teacher(uuid) from public;
revoke all on function private.is_enrolled_in_course(uuid) from public;
revoke all on function private.is_teacher_of_student(uuid) from public;
revoke all on function private.is_conversation_participant(uuid) from public;

grant execute on function private.current_user_role() to authenticated, service_role;
grant execute on function private.is_admin() to authenticated, service_role;
grant execute on function private.is_teacher() to authenticated, service_role;
grant execute on function private.has_permission(text) to authenticated, service_role;
grant execute on function private.is_course_teacher(uuid) to authenticated, service_role;
grant execute on function private.is_enrolled_in_course(uuid) to authenticated, service_role;
grant execute on function private.is_teacher_of_student(uuid) to authenticated, service_role;
grant execute on function private.is_conversation_participant(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. TRANSACTIONAL TRIGGERS & CRITICAL DOMAIN FUNCTIONS
-- -----------------------------------------------------------------------------

-- 2a. Auto-create profile row when a new auth.users entry is registered
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role, status)
  values (
    new.id,
    coalesce(new.email, new.id::text || '@users.learnix.local'),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    'student',
    'active'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

-- 2b. Prevent non-admins from escalating their own role, status, or email on profiles
create or replace function private.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Allow service_role or database superuser/postgres during migrations/admin jobs
  if current_user in ('postgres', 'service_role', 'supabase_admin', 'supabase_auth_admin') then
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

drop trigger if exists protect_profiles_privileged_fields on public.profiles;
create trigger protect_profiles_privileged_fields
  before update on public.profiles
  for each row execute function private.protect_profile_privileged_columns();

-- 2c. Prevent students from tampering with graded fields on assignment_submissions
create or replace function private.protect_submission_grading_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course_id uuid;
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
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

drop trigger if exists protect_assignment_submission_grades on public.assignment_submissions;
create trigger protect_assignment_submission_grades
  before update on public.assignment_submissions
  for each row execute function private.protect_submission_grading_columns();

-- 2d. Prevent students from modifying points_awarded / is_correct / teacher_feedback on student_answers
create or replace function private.protect_student_answer_grading_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course_id uuid;
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
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

drop trigger if exists protect_student_answers_grading on public.student_answers;
create trigger protect_student_answers_grading
  before insert or update on public.student_answers
  for each row execute function private.protect_student_answer_grading_columns();

-- 2e. Automatically recompute course_enrollments.progress_percent when lesson_progress changes
create or replace function private.sync_course_enrollment_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total_lessons integer;
  v_completed_lessons integer;
  v_percent numeric(5,2);
begin
  select count(*) into v_total_lessons
  from public.lessons l
  where l.course_id = new.course_id
    and l.is_published = true;

  if v_total_lessons = 0 then
    v_percent := 0;
  else
    select count(*) into v_completed_lessons
    from public.lesson_progress lp
    join public.lessons l on l.id = lp.lesson_id
    where lp.course_id = new.course_id
      and lp.student_id = new.student_id
      and lp.is_completed = true
      and l.is_published = true;

    v_percent := least(100, round((v_completed_lessons::numeric / v_total_lessons::numeric) * 100, 2));
  end if;

  update public.course_enrollments
  set progress_percent = v_percent,
      status = case when v_percent >= 100 then 'completed'::public.enrollment_status else status end,
      completed_at = case when v_percent >= 100 and completed_at is null then timezone('utc', now()) else completed_at end,
      last_accessed_at = timezone('utc', now())
  where course_id = new.course_id
    and student_id = new.student_id;

  return new;
end;
$$;

drop trigger if exists sync_enrollment_progress_on_lesson_progress on public.lesson_progress;
create trigger sync_enrollment_progress_on_lesson_progress
  after insert or update of is_completed on public.lesson_progress
  for each row execute function private.sync_course_enrollment_progress();

-- 2f. Update conversation.last_message_at when a new message is inserted
create or replace function private.touch_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
  set last_message_at = new.created_at,
      updated_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists touch_conversation_after_message on public.messages;
create trigger touch_conversation_after_message
  after insert on public.messages
  for each row execute function private.touch_conversation_on_message();

-- 2g. Increment exam_attempts.violations_count and auto-invalidate on threshold breach
create or replace function private.handle_exam_violation_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max_allowed integer;
  v_strict boolean;
  v_new_count integer;
begin
  select e.max_violations_allowed, e.strict_proctoring
  into v_max_allowed, v_strict
  from public.exam_attempts ea
  join public.exams e on e.id = ea.exam_id
  where ea.id = new.attempt_id;

  update public.exam_attempts
  set violations_count = violations_count + 1,
      status = case
        when v_strict and (violations_count + 1) > v_max_allowed then 'invalidated'::public.attempt_status
        else status
      end,
      submitted_at = case
        when v_strict and (violations_count + 1) > v_max_allowed and submitted_at is null then timezone('utc', now())
        else submitted_at
      end
  where id = new.attempt_id
  returning violations_count into v_new_count;

  return new;
end;
$$;

drop trigger if exists on_exam_violation_logged on public.exam_violations;
create trigger on_exam_violation_logged
  after insert on public.exam_violations
  for each row execute function private.handle_exam_violation_insert();

-- 2h. Transactional RPC: submit_exam_attempt (SECURITY INVOKER wrapper with verified auth.uid())
create or replace function public.submit_exam_attempt(p_attempt_id uuid)
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

  -- Auto-grade objective questions (single_choice, true_false)
  update public.student_answers sa
  set is_correct = coalesce(qo.is_correct, false),
      points_awarded = case when coalesce(qo.is_correct, false) then q.points else 0 end,
      updated_at = timezone('utc', now())
  from public.questions q
  left join public.question_options qo on qo.id = sa.selected_option_id and qo.question_id = q.id
  where sa.attempt_id = p_attempt_id
    and sa.question_id = q.id
    and q.question_type in ('single_choice', 'true_false');

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

revoke all on function public.submit_exam_attempt(uuid) from public, anon;
grant execute on function public.submit_exam_attempt(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. ENABLE ROW LEVEL SECURITY ON EVERY PUBLIC TABLE
-- -----------------------------------------------------------------------------
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_permissions enable row level security;
alter table public.profiles enable row level security;
alter table public.teacher_requests enable row level security;
alter table public.departments enable row level security;
alter table public.educational_levels enable row level security;
alter table public.classes enable row level security;
alter table public.student_teacher_assignments enable row level security;
alter table public.courses enable row level security;
alter table public.course_enrollments enable row level security;
alter table public.chapters enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.favorites enable row level security;
alter table public.lesson_notes enable row level security;
alter table public.exams enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.exam_sessions enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.student_answers enable row level security;
alter table public.results enable row level security;
alter table public.exam_violations enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_recipients enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.message_attachments enable row level security;
alter table public.attendance enable row level security;
alter table public.attendance_records enable row level security;
alter table public.course_reviews enable row level security;
alter table public.teacher_reviews enable row level security;
alter table public.certificates enable row level security;
alter table public.study_sessions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.user_devices enable row level security;
alter table public.platform_settings enable row level security;
alter table public.contact_messages enable row level security;

-- -----------------------------------------------------------------------------
-- 4. RLS POLICIES
--    Using `(select auth.uid())` and `(select private.*())` for cached initPlans.
-- -----------------------------------------------------------------------------

-- roles, permissions, role_permissions: readable by authenticated, managed by admin
create policy "roles_select_authenticated" on public.roles
  for select to authenticated using (true);
create policy "roles_admin_all" on public.roles
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "permissions_select_authenticated" on public.permissions
  for select to authenticated using (true);
create policy "permissions_admin_all" on public.permissions
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "role_permissions_select_authenticated" on public.role_permissions
  for select to authenticated using (true);
create policy "role_permissions_admin_all" on public.role_permissions
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- user_permissions: user can view own permissions; admin manages all
create policy "user_permissions_select_own_or_admin" on public.user_permissions
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "user_permissions_admin_write" on public.user_permissions
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- profiles:
-- - Users can read their own profile
-- - Users can read active teacher profiles (public instructor directory)
-- - Teachers can read profiles of their assigned/enrolled students
-- - Admins can read/write all profiles
-- - Users can update only their own non-privileged profile columns (enforced by trigger)
create policy "profiles_select_policy" on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or role = 'teacher'
    or (select private.is_admin())
    or (select private.is_teacher_of_student(id))
  );

create policy "profiles_insert_self_or_admin" on public.profiles
  for insert to authenticated
  with check (
    (id = (select auth.uid()) and role = 'student')
    or (select private.is_admin())
  );

create policy "profiles_update_self_or_admin" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()))
  with check (id = (select auth.uid()) or (select private.is_admin()));

create policy "profiles_delete_admin" on public.profiles
  for delete to authenticated
  using ((select private.is_admin()));

-- teacher_requests: applicant can view/create own pending requests; admin manages all
create policy "teacher_requests_select_own_or_admin" on public.teacher_requests
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy "teacher_requests_insert_own" on public.teacher_requests
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');

create policy "teacher_requests_admin_update_delete" on public.teacher_requests
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- departments, educational_levels, classes: readable by all (including anon for public catalog); writable by admin
create policy "departments_select_all" on public.departments
  for select to anon, authenticated using (is_active = true);
create policy "departments_admin_all" on public.departments
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "educational_levels_select_all" on public.educational_levels
  for select to anon, authenticated using (true);
create policy "educational_levels_admin_all" on public.educational_levels
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "classes_select_authenticated" on public.classes
  for select to authenticated using (true);
create policy "classes_admin_all" on public.classes
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- student_teacher_assignments: student sees own, teacher sees own, admin manages all
create policy "sta_select_involved_or_admin" on public.student_teacher_assignments
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or teacher_id = (select auth.uid())
    or (select private.is_admin())
  );
create policy "sta_admin_write" on public.student_teacher_assignments
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- courses:
-- - Published courses are visible to anon & authenticated (public catalog)
-- - Draft/archived courses visible only to course teacher or admin
-- - Teachers can insert/update their own courses; admins can manage all
create policy "courses_select_published_or_owner" on public.courses
  for select to anon, authenticated
  using (
    status = 'published'
    or teacher_id = (select auth.uid())
    or (select private.is_admin())
  );

create policy "courses_insert_teacher_or_admin" on public.courses
  for insert to authenticated
  with check (
    ((select private.is_teacher()) and teacher_id = (select auth.uid()))
    or (select private.is_admin())
  );

create policy "courses_update_teacher_or_admin" on public.courses
  for update to authenticated
  using (teacher_id = (select auth.uid()) or (select private.is_admin()))
  with check (teacher_id = (select auth.uid()) or (select private.is_admin()));

create policy "courses_delete_admin" on public.courses
  for delete to authenticated
  using ((select private.is_admin()));

-- course_enrollments:
-- - Student sees/creates own enrollment in published courses
-- - Course teacher and admin can view/manage enrollments for their courses
create policy "course_enrollments_select_policy" on public.course_enrollments
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or (select private.is_course_teacher(course_id))
    or (select private.is_admin())
  );

create policy "course_enrollments_insert_student_or_admin" on public.course_enrollments
  for insert to authenticated
  with check (
    (
      student_id = (select auth.uid())
      and exists (
        select 1 from public.courses c
        where c.id = course_id and c.status = 'published'
      )
    )
    or (select private.is_course_teacher(course_id))
    or (select private.is_admin())
  );

create policy "course_enrollments_update_policy" on public.course_enrollments
  for update to authenticated
  using (
    student_id = (select auth.uid())
    or (select private.is_course_teacher(course_id))
    or (select private.is_admin())
  )
  with check (
    student_id = (select auth.uid())
    or (select private.is_course_teacher(course_id))
    or (select private.is_admin())
  );

create policy "course_enrollments_delete_admin" on public.course_enrollments
  for delete to authenticated
  using ((select private.is_admin()));

-- chapters:
-- - Published chapters of published courses visible to enrolled students (or public syllabus)
-- - Course teacher and admin can manage all chapters of the course
create policy "chapters_select_policy" on public.chapters
  for select to anon, authenticated
  using (
    (
      is_published = true
      and exists (
        select 1 from public.courses c
        where c.id = course_id and c.status = 'published'
      )
    )
    or (select private.is_course_teacher(course_id))
    or (select private.is_admin())
  );

create policy "chapters_write_teacher_or_admin" on public.chapters
  for all to authenticated
  using ((select private.is_course_teacher(course_id)) or (select private.is_admin()))
  with check ((select private.is_course_teacher(course_id)) or (select private.is_admin()));

-- lessons:
-- - Preview lessons of published courses are visible to everyone
-- - Published lessons are visible ONLY to enrolled students, the course teacher, or admin
-- - Prevents unauthorized students from reading un-enrolled course lessons
create policy "lessons_select_authorized" on public.lessons
  for select to anon, authenticated
  using (
    (
      is_published = true
      and is_preview = true
      and exists (
        select 1 from public.courses c
        where c.id = course_id and c.status = 'published'
      )
    )
    or (is_published = true and (select private.is_enrolled_in_course(course_id)))
    or (select private.is_course_teacher(course_id))
    or (select private.is_admin())
  );

create policy "lessons_write_teacher_or_admin" on public.lessons
  for all to authenticated
  using ((select private.is_course_teacher(course_id)) or (select private.is_admin()))
  with check ((select private.is_course_teacher(course_id)) or (select private.is_admin()));

-- lesson_progress: student manages own progress in enrolled courses; teacher/admin can view
create policy "lesson_progress_select_policy" on public.lesson_progress
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or (select private.is_course_teacher(course_id))
    or (select private.is_admin())
  );

create policy "lesson_progress_insert_student" on public.lesson_progress
  for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and (select private.is_enrolled_in_course(course_id))
  );

create policy "lesson_progress_update_student" on public.lesson_progress
  for update to authenticated
  using (student_id = (select auth.uid()) or (select private.is_admin()))
  with check (student_id = (select auth.uid()) or (select private.is_admin()));

-- favorites & lesson_notes: strictly personal to the student
create policy "favorites_own_all" on public.favorites
  for all to authenticated
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));

create policy "lesson_notes_own_all" on public.lesson_notes
  for all to authenticated
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));

-- exams: enrolled students can view published exams; course teacher & admin manage
create policy "exams_select_authorized" on public.exams
  for select to authenticated
  using (
    (status = 'published' and (select private.is_enrolled_in_course(course_id)))
    or (select private.is_course_teacher(course_id))
    or (select private.is_admin())
  );

create policy "exams_write_teacher_or_admin" on public.exams
  for all to authenticated
  using ((select private.is_course_teacher(course_id)) or (select private.is_admin()))
  with check ((select private.is_course_teacher(course_id)) or (select private.is_admin()));

-- questions & question_options
create policy "questions_select_authorized" on public.questions
  for select to authenticated
  using (
    exists (
      select 1 from public.exams e
      where e.id = exam_id
        and (
          (e.status = 'published' and (select private.is_enrolled_in_course(e.course_id)))
          or (select private.is_course_teacher(e.course_id))
          or (select private.is_admin())
        )
    )
  );

create policy "questions_write_teacher_or_admin" on public.questions
  for all to authenticated
  using (
    exists (
      select 1 from public.exams e
      where e.id = exam_id
        and ((select private.is_course_teacher(e.course_id)) or (select private.is_admin()))
    )
  )
  with check (
    exists (
      select 1 from public.exams e
      where e.id = exam_id
        and ((select private.is_course_teacher(e.course_id)) or (select private.is_admin()))
    )
  );

create policy "question_options_select_authorized" on public.question_options
  for select to authenticated
  using (
    exists (
      select 1
      from public.questions q
      join public.exams e on e.id = q.exam_id
      where q.id = question_id
        and (
          (e.status = 'published' and (select private.is_enrolled_in_course(e.course_id)))
          or (select private.is_course_teacher(e.course_id))
          or (select private.is_admin())
        )
    )
  );

create policy "question_options_write_teacher_or_admin" on public.question_options
  for all to authenticated
  using (
    exists (
      select 1
      from public.questions q
      join public.exams e on e.id = q.exam_id
      where q.id = question_id
        and ((select private.is_course_teacher(e.course_id)) or (select private.is_admin()))
    )
  )
  with check (
    exists (
      select 1
      from public.questions q
      join public.exams e on e.id = q.exam_id
      where q.id = question_id
        and ((select private.is_course_teacher(e.course_id)) or (select private.is_admin()))
    )
  );

-- exam_sessions
create policy "exam_sessions_select_authorized" on public.exam_sessions
  for select to authenticated
  using (
    exists (
      select 1 from public.exams e
      where e.id = exam_id
        and (
          (select private.is_enrolled_in_course(e.course_id))
          or (select private.is_course_teacher(e.course_id))
          or (select private.is_admin())
        )
    )
  );

create policy "exam_sessions_write_teacher_or_admin" on public.exam_sessions
  for all to authenticated
  using (
    exists (
      select 1 from public.exams e
      where e.id = exam_id
        and ((select private.is_course_teacher(e.course_id)) or (select private.is_admin()))
    )
  )
  with check (
    exists (
      select 1 from public.exams e
      where e.id = exam_id
        and ((select private.is_course_teacher(e.course_id)) or (select private.is_admin()))
    )
  );

-- exam_attempts
create policy "exam_attempts_select_policy" on public.exam_attempts
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or exists (
      select 1 from public.exams e
      where e.id = exam_id
        and ((select private.is_course_teacher(e.course_id)) or (select private.is_admin()))
    )
  );

create policy "exam_attempts_insert_student" on public.exam_attempts
  for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and status = 'in_progress'
    and exists (
      select 1 from public.exams e
      where e.id = exam_id
        and e.status = 'published'
        and (select private.is_enrolled_in_course(e.course_id))
    )
  );

create policy "exam_attempts_update_policy" on public.exam_attempts
  for update to authenticated
  using (
    (student_id = (select auth.uid()) and status = 'in_progress')
    or exists (
      select 1 from public.exams e
      where e.id = exam_id
        and ((select private.is_course_teacher(e.course_id)) or (select private.is_admin()))
    )
  )
  with check (
    student_id = (select auth.uid())
    or exists (
      select 1 from public.exams e
      where e.id = exam_id
        and ((select private.is_course_teacher(e.course_id)) or (select private.is_admin()))
    )
  );

-- student_answers (trigger blocks students from setting points_awarded / is_correct)
create policy "student_answers_select_policy" on public.student_answers
  for select to authenticated
  using (
    exists (
      select 1
      from public.exam_attempts ea
      join public.exams e on e.id = ea.exam_id
      where ea.id = attempt_id
        and (
          ea.student_id = (select auth.uid())
          or (select private.is_course_teacher(e.course_id))
          or (select private.is_admin())
        )
    )
  );

create policy "student_answers_insert_student" on public.student_answers
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.exam_attempts ea
      where ea.id = attempt_id
        and ea.student_id = (select auth.uid())
        and ea.status = 'in_progress'
    )
  );

create policy "student_answers_update_policy" on public.student_answers
  for update to authenticated
  using (
    exists (
      select 1
      from public.exam_attempts ea
      join public.exams e on e.id = ea.exam_id
      where ea.id = attempt_id
        and (
          (ea.student_id = (select auth.uid()) and ea.status = 'in_progress')
          or (select private.is_course_teacher(e.course_id))
          or (select private.is_admin())
        )
    )
  )
  with check (
    exists (
      select 1
      from public.exam_attempts ea
      join public.exams e on e.id = ea.exam_id
      where ea.id = attempt_id
        and (
          (ea.student_id = (select auth.uid()) and ea.status = 'in_progress')
          or (select private.is_course_teacher(e.course_id))
          or (select private.is_admin())
        )
    )
  );

-- results: students can ONLY SELECT their own published results; NEVER insert/update/delete
create policy "results_select_policy" on public.results
  for select to authenticated
  using (
    (student_id = (select auth.uid()) and is_published = true)
    or (select private.is_course_teacher(course_id))
    or (select private.is_admin())
  );

create policy "results_write_teacher_or_admin" on public.results
  for all to authenticated
  using ((select private.is_course_teacher(course_id)) or (select private.is_admin()))
  with check ((select private.is_course_teacher(course_id)) or (select private.is_admin()));

-- exam_violations
create policy "exam_violations_select_policy" on public.exam_violations
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or exists (
      select 1
      from public.exam_attempts ea
      join public.exams e on e.id = ea.exam_id
      where ea.id = attempt_id
        and ((select private.is_course_teacher(e.course_id)) or (select private.is_admin()))
    )
  );

create policy "exam_violations_insert_student_or_teacher" on public.exam_violations
  for insert to authenticated
  with check (
    student_id = (select auth.uid())
    or (select private.is_admin())
  );

-- assignments & assignment_submissions
create policy "assignments_select_authorized" on public.assignments
  for select to authenticated
  using (
    (is_published = true and (select private.is_enrolled_in_course(course_id)))
    or (select private.is_course_teacher(course_id))
    or (select private.is_admin())
  );

create policy "assignments_write_teacher_or_admin" on public.assignments
  for all to authenticated
  using ((select private.is_course_teacher(course_id)) or (select private.is_admin()))
  with check ((select private.is_course_teacher(course_id)) or (select private.is_admin()));

create policy "assignment_submissions_select_policy" on public.assignment_submissions
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or exists (
      select 1 from public.assignments a
      where a.id = assignment_id
        and ((select private.is_course_teacher(a.course_id)) or (select private.is_admin()))
    )
  );

create policy "assignment_submissions_insert_student" on public.assignment_submissions
  for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and grade_points is null
    and graded_by is null
    and exists (
      select 1 from public.assignments a
      where a.id = assignment_id
        and a.is_published = true
        and (select private.is_enrolled_in_course(a.course_id))
    )
  );

create policy "assignment_submissions_update_policy" on public.assignment_submissions
  for update to authenticated
  using (
    (student_id = (select auth.uid()) and status <> 'graded')
    or exists (
      select 1 from public.assignments a
      where a.id = assignment_id
        and ((select private.is_course_teacher(a.course_id)) or (select private.is_admin()))
    )
  )
  with check (
    student_id = (select auth.uid())
    or exists (
      select 1 from public.assignments a
      where a.id = assignment_id
        and ((select private.is_course_teacher(a.course_id)) or (select private.is_admin()))
    )
  );

-- notifications & notification_recipients
create policy "notifications_select_recipient_or_sender" on public.notifications
  for select to authenticated
  using (
    sender_id = (select auth.uid())
    or (select private.is_admin())
    or exists (
      select 1 from public.notification_recipients nr
      where nr.notification_id = id and nr.recipient_id = (select auth.uid())
    )
  );

create policy "notifications_insert_teacher_or_admin" on public.notifications
  for insert to authenticated
  with check (
    (select private.is_admin())
    or ((select private.is_teacher()) and sender_id = (select auth.uid()))
  );

create policy "notification_recipients_select_own_or_admin" on public.notification_recipients
  for select to authenticated
  using (recipient_id = (select auth.uid()) or (select private.is_admin()));

create policy "notification_recipients_update_own" on public.notification_recipients
  for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

create policy "notification_recipients_insert_teacher_or_admin" on public.notification_recipients
  for insert to authenticated
  with check ((select private.is_teacher()) or (select private.is_admin()));

-- conversations, conversation_participants, messages, message_attachments
create policy "conversations_select_participant_or_admin" on public.conversations
  for select to authenticated
  using (
    created_by = (select auth.uid())
    or (select private.is_conversation_participant(id))
    or (select private.is_admin())
  );

create policy "conversations_insert_authenticated" on public.conversations
  for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "conversation_participants_select_policy" on public.conversation_participants
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_conversation_participant(conversation_id))
    or (select private.is_admin())
  );

create policy "conversation_participants_insert_creator_or_admin" on public.conversation_participants
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.conversations c
      where c.id = conversation_id and c.created_by = (select auth.uid())
    )
    or (select private.is_admin())
  );

create policy "messages_select_participant_or_admin" on public.messages
  for select to authenticated
  using (
    (select private.is_conversation_participant(conversation_id))
    or (select private.is_admin())
  );

create policy "messages_insert_participant" on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and (select private.is_conversation_participant(conversation_id))
  );

create policy "messages_update_sender" on public.messages
  for update to authenticated
  using (sender_id = (select auth.uid()))
  with check (sender_id = (select auth.uid()));

create policy "message_attachments_select_participant" on public.message_attachments
  for select to authenticated
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_id
        and ((select private.is_conversation_participant(m.conversation_id)) or (select private.is_admin()))
    )
  );

create policy "message_attachments_insert_sender" on public.message_attachments
  for insert to authenticated
  with check (
    exists (
      select 1 from public.messages m
      where m.id = message_id and m.sender_id = (select auth.uid())
    )
  );

-- attendance & attendance_records
create policy "attendance_select_authorized" on public.attendance
  for select to authenticated
  using (
    (select private.is_enrolled_in_course(course_id))
    or (select private.is_course_teacher(course_id))
    or (select private.is_admin())
  );

create policy "attendance_write_teacher_or_admin" on public.attendance
  for all to authenticated
  using ((select private.is_course_teacher(course_id)) or (select private.is_admin()))
  with check ((select private.is_course_teacher(course_id)) or (select private.is_admin()));

create policy "attendance_records_select_policy" on public.attendance_records
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or exists (
      select 1 from public.attendance att
      where att.id = attendance_id
        and ((select private.is_course_teacher(att.course_id)) or (select private.is_admin()))
    )
  );

create policy "attendance_records_write_teacher_or_admin" on public.attendance_records
  for all to authenticated
  using (
    exists (
      select 1 from public.attendance att
      where att.id = attendance_id
        and ((select private.is_course_teacher(att.course_id)) or (select private.is_admin()))
    )
  )
  with check (
    exists (
      select 1 from public.attendance att
      where att.id = attendance_id
        and ((select private.is_course_teacher(att.course_id)) or (select private.is_admin()))
    )
  );

-- course_reviews & teacher_reviews
create policy "course_reviews_select_published" on public.course_reviews
  for select to anon, authenticated
  using (is_published = true or student_id = (select auth.uid()) or (select private.is_admin()));

create policy "course_reviews_insert_enrolled_student" on public.course_reviews
  for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and (select private.is_enrolled_in_course(course_id))
  );

create policy "course_reviews_update_delete_own_or_admin" on public.course_reviews
  for update to authenticated
  using (student_id = (select auth.uid()) or (select private.is_admin()))
  with check (student_id = (select auth.uid()) or (select private.is_admin()));

create policy "course_reviews_delete_own_or_admin" on public.course_reviews
  for delete to authenticated
  using (student_id = (select auth.uid()) or (select private.is_admin()));

create policy "teacher_reviews_select_published" on public.teacher_reviews
  for select to authenticated
  using (
    is_published = true
    or student_id = (select auth.uid())
    or teacher_id = (select auth.uid())
    or (select private.is_admin())
  );

create policy "teacher_reviews_insert_student" on public.teacher_reviews
  for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and teacher_id <> (select auth.uid())
  );

create policy "teacher_reviews_update_own_or_admin" on public.teacher_reviews
  for update to authenticated
  using (student_id = (select auth.uid()) or (select private.is_admin()))
  with check (student_id = (select auth.uid()) or (select private.is_admin()));

-- certificates, study_sessions, audit_logs, user_devices, platform_settings, contact_messages
create policy "certificates_select_policy" on public.certificates
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or (select private.is_course_teacher(course_id))
    or (select private.is_admin())
  );

create policy "certificates_write_teacher_or_admin" on public.certificates
  for all to authenticated
  using ((select private.is_course_teacher(course_id)) or (select private.is_admin()))
  with check ((select private.is_course_teacher(course_id)) or (select private.is_admin()));

create policy "study_sessions_select_policy" on public.study_sessions
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or (course_id is not null and (select private.is_course_teacher(course_id)))
    or (select private.is_admin())
  );

create policy "study_sessions_write_own" on public.study_sessions
  for all to authenticated
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));

create policy "audit_logs_select_admin" on public.audit_logs
  for select to authenticated
  using ((select private.is_admin()));

create policy "audit_logs_insert_authenticated" on public.audit_logs
  for insert to authenticated
  with check (actor_id = (select auth.uid()) or (select private.is_admin()));

create policy "user_devices_own_or_admin" on public.user_devices
  for all to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()))
  with check (user_id = (select auth.uid()) or (select private.is_admin()));

create policy "platform_settings_select_public_or_admin" on public.platform_settings
  for select to anon, authenticated
  using (is_public = true or (select private.is_admin()));

create policy "platform_settings_write_admin" on public.platform_settings
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "contact_messages_insert_public" on public.contact_messages
  for insert to anon, authenticated
  with check (
    status = 'pending'
    and handled_by is null
    and handled_at is null
  );

create policy "contact_messages_admin_manage" on public.contact_messages
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- -----------------------------------------------------------------------------
-- 5. SUPABASE STORAGE BUCKETS & ACCESS POLICIES
--    Buckets:
--      1. profile-pictures        (public read, owner write, 5 MB, images)
--      2. course-videos           (private, teacher/admin write, enrolled read, 500 MB)
--      3. course-materials        (private, teacher/admin write, enrolled read, 50 MB)
--      4. course-pdfs             (private, teacher/admin write, enrolled read, 50 MB)
--      5. course-presentations    (private, teacher/admin write, enrolled read, 100 MB)
--      6. assignment-attachments  (private, student/teacher folder isolation, 25 MB)
--      7. message-attachments     (private, conversation participant isolation, 25 MB)
--      8. certificates            (private, teacher/admin issue, student read, 15 MB)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'profile-pictures',
    'profile-pictures',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  ),
  (
    'course-videos',
    'course-videos',
    false,
    524288000,
    array['video/mp4', 'video/webm', 'video/quicktime']
  ),
  (
    'course-materials',
    'course-materials',
    false,
    52428800,
    array['application/pdf', 'application/zip', 'text/plain', 'text/markdown', 'image/png', 'image/jpeg', 'image/webp']
  ),
  (
    'course-pdfs',
    'course-pdfs',
    false,
    52428800,
    array['application/pdf']
  ),
  (
    'course-presentations',
    'course-presentations',
    false,
    104857600,
    array[
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/pdf'
    ]
  ),
  (
    'assignment-attachments',
    'assignment-attachments',
    false,
    26214400,
    array[
      'application/pdf',
      'application/zip',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/png',
      'image/jpeg'
    ]
  ),
  (
    'message-attachments',
    'message-attachments',
    false,
    26214400,
    array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain', 'application/zip']
  ),
  (
    'certificates',
    'certificates',
    false,
    15728640,
    array['application/pdf', 'image/png']
  )
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Storage RLS Policies on storage.objects
-- 1. Profile pictures: anyone can view; authenticated users manage their own folder `{user_id}/*`
drop policy if exists "storage_profile_pictures_read" on storage.objects;
create policy "storage_profile_pictures_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'profile-pictures');

drop policy if exists "storage_profile_pictures_write_own" on storage.objects;
create policy "storage_profile_pictures_write_own" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'profile-pictures'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select private.is_admin())
    )
  )
  with check (
    bucket_id = 'profile-pictures'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select private.is_admin())
    )
  );

-- 2. Course media buckets (`course-videos`, `course-materials`, `course-pdfs`, `course-presentations`)
--    Path convention: `{course_id}/{filename}`.
--    Read: enrolled students, course teacher, or admin.
--    Write (INSERT/UPDATE/DELETE): course teacher or admin.
drop policy if exists "storage_course_assets_read" on storage.objects;
create policy "storage_course_assets_read" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('course-videos', 'course-materials', 'course-pdfs', 'course-presentations')
    and (
      (select private.is_admin())
      or (
        (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and (
          (select private.is_course_teacher(((storage.foldername(name))[1])::uuid))
          or (select private.is_enrolled_in_course(((storage.foldername(name))[1])::uuid))
        )
      )
    )
  );

drop policy if exists "storage_course_assets_write" on storage.objects;
create policy "storage_course_assets_write" on storage.objects
  for all to authenticated
  using (
    bucket_id in ('course-videos', 'course-materials', 'course-pdfs', 'course-presentations')
    and (
      (select private.is_admin())
      or (
        (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and (select private.is_course_teacher(((storage.foldername(name))[1])::uuid))
      )
    )
  )
  with check (
    bucket_id in ('course-videos', 'course-materials', 'course-pdfs', 'course-presentations')
    and (
      (select private.is_admin())
      or (
        (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and (select private.is_course_teacher(((storage.foldername(name))[1])::uuid))
      )
    )
  );

-- 3. Assignment attachments (`assignment-attachments`)
--    Path convention: `{course_id}/{student_id}/{filename}`
drop policy if exists "storage_assignments_read" on storage.objects;
create policy "storage_assignments_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'assignment-attachments'
    and (
      (select private.is_admin())
      or (storage.foldername(name))[2] = (select auth.uid())::text
      or (
        (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and (select private.is_course_teacher(((storage.foldername(name))[1])::uuid))
      )
    )
  );

drop policy if exists "storage_assignments_write" on storage.objects;
create policy "storage_assignments_write" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'assignment-attachments'
    and (
      (select private.is_admin())
      or (
        (storage.foldername(name))[2] = (select auth.uid())::text
        and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and (select private.is_enrolled_in_course(((storage.foldername(name))[1])::uuid))
      )
      or (
        (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and (select private.is_course_teacher(((storage.foldername(name))[1])::uuid))
      )
    )
  )
  with check (
    bucket_id = 'assignment-attachments'
    and (
      (select private.is_admin())
      or (
        (storage.foldername(name))[2] = (select auth.uid())::text
        and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and (select private.is_enrolled_in_course(((storage.foldername(name))[1])::uuid))
      )
      or (
        (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and (select private.is_course_teacher(((storage.foldername(name))[1])::uuid))
      )
    )
  );

-- 4. Message attachments (`message-attachments`)
--    Path convention: `{conversation_id}/{user_id}/{filename}`
drop policy if exists "storage_messages_read" on storage.objects;
create policy "storage_messages_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'message-attachments'
    and (
      (select private.is_admin())
      or (
        (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and (select private.is_conversation_participant(((storage.foldername(name))[1])::uuid))
      )
    )
  );

drop policy if exists "storage_messages_insert" on storage.objects;
create policy "storage_messages_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'message-attachments'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (select private.is_conversation_participant(((storage.foldername(name))[1])::uuid))
  );

-- 5. Certificates (`certificates`)
--    Path convention: `{student_id}/{certificate_id}.pdf`
drop policy if exists "storage_certificates_read" on storage.objects;
create policy "storage_certificates_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'certificates'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select private.is_teacher())
      or (select private.is_admin())
    )
  );

drop policy if exists "storage_certificates_write" on storage.objects;
create policy "storage_certificates_write" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'certificates'
    and ((select private.is_teacher()) or (select private.is_admin()))
  )
  with check (
    bucket_id = 'certificates'
    and ((select private.is_teacher()) or (select private.is_admin()))
  );
