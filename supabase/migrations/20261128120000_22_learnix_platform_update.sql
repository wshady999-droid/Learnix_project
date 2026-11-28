-- =============================================================================
-- Learnix — Migration 22: Platform Update (Assignment Materials, File Versions,
-- Voice & Group Messaging, Persistent Notification Deletion, Exam Pause/Resume,
-- Public Teacher Profiles, AI Exam Grounding, and Governance Restrictions)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. PRIVATE HELPER FOR GROUP CONVERSATION PARTICIPANT PROFILE VISIBILITY
-- -----------------------------------------------------------------------------
create or replace function private.shares_conversation_with(p_other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_participants cp_me
    join public.conversation_participants cp_other
      on cp_other.conversation_id = cp_me.conversation_id
    where cp_me.user_id = (select auth.uid())
      and cp_other.user_id = p_other_user_id
  );
$$;

revoke all on function private.shares_conversation_with(uuid) from public;
grant execute on function private.shares_conversation_with(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. ASSIGNMENT MATERIALS (teacher-uploaded files per assignment)
-- -----------------------------------------------------------------------------
create table if not exists public.assignment_materials (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  storage_bucket text not null default 'assignment-attachments',
  storage_path text not null,
  file_name text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  mime_type text not null,
  version_number integer not null default 1 check (version_number >= 1),
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
comment on table public.assignment_materials is 'Files uploaded by teachers for an assignment (PDF, Word, PowerPoint, Excel, video, image).';
create index if not exists assignment_materials_assignment_id_idx on public.assignment_materials(assignment_id);
create index if not exists assignment_materials_course_id_idx on public.assignment_materials(course_id);
create index if not exists assignment_materials_uploaded_by_idx on public.assignment_materials(uploaded_by);

-- -----------------------------------------------------------------------------
-- 3. FILE VERSION HISTORY (for replaced course/lesson/assignment materials & submissions)
-- -----------------------------------------------------------------------------
create table if not exists public.material_file_versions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('lesson_video', 'lesson_attachment', 'assignment_material', 'learning_resource')),
  entity_id uuid not null,
  course_id uuid not null references public.courses(id) on delete cascade,
  storage_bucket text not null,
  storage_path text not null,
  file_name text not null,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes > 0),
  mime_type text,
  version_number integer not null default 1 check (version_number >= 1),
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now())
);
comment on table public.material_file_versions is 'Preserved historical file versions when teachers replace uploaded course or assignment materials.';
create index if not exists material_file_versions_entity_idx on public.material_file_versions(entity_type, entity_id);
create index if not exists material_file_versions_course_id_idx on public.material_file_versions(course_id);
create index if not exists material_file_versions_uploaded_by_idx on public.material_file_versions(uploaded_by);

create table if not exists public.assignment_submission_versions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.assignment_submissions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  storage_bucket text not null default 'assignment-attachments',
  storage_path text not null,
  file_name text not null,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes > 0),
  mime_type text not null default 'application/octet-stream',
  version_number integer not null default 1 check (version_number >= 1),
  submitted_at timestamptz not null default timezone('utc', now())
);
comment on table public.assignment_submission_versions is 'Preserved versions of student assignment file submissions when replaced before grading.';
create index if not exists assignment_submission_versions_submission_id_idx on public.assignment_submission_versions(submission_id);
create index if not exists assignment_submission_versions_student_id_idx on public.assignment_submission_versions(student_id);

-- -----------------------------------------------------------------------------
-- 4. VOICE & GROUP MESSAGING EXTENSIONS ON public.messages
-- -----------------------------------------------------------------------------
alter table public.messages
  add column if not exists message_type text not null default 'text'
    check (message_type in ('text', 'voice', 'file', 'system'));
alter table public.messages
  add column if not exists voice_duration_seconds integer
    check (voice_duration_seconds is null or voice_duration_seconds >= 0);
create index if not exists messages_message_type_idx on public.messages(message_type);

-- -----------------------------------------------------------------------------
-- 5. EXAM PAUSE & TEACHER RESUME APPROVAL COLUMNS
-- -----------------------------------------------------------------------------
alter table public.exam_attempts
  add column if not exists is_paused boolean not null default false;
alter table public.exam_attempts
  add column if not exists paused_at timestamptz;
alter table public.exam_attempts
  add column if not exists remaining_seconds integer
    check (remaining_seconds is null or remaining_seconds >= 0);
alter table public.exam_attempts
  add column if not exists paused_reason text;
alter table public.exam_attempts
  add column if not exists resume_status text not null default 'none'
    check (resume_status in ('none', 'pending', 'approved', 'rejected'));
alter table public.exam_attempts
  add column if not exists resume_reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.exam_attempts
  add column if not exists resume_reviewed_at timestamptz;
alter table public.exam_attempts
  add column if not exists resume_review_notes text;

create index if not exists exam_attempts_is_paused_idx on public.exam_attempts(is_paused) where is_paused = true;
create index if not exists exam_attempts_resume_reviewed_by_idx on public.exam_attempts(resume_reviewed_by);

alter table public.exam_violations
  add column if not exists triggered_pause boolean not null default false;

create or replace function private.handle_exam_violation_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exam_id uuid;
  v_exam_title text;
  v_course_id uuid;
  v_teacher_id uuid;
  v_student_name text;
  v_student_email text;
begin
  select e.id, e.title, e.course_id, c.teacher_id
  into v_exam_id, v_exam_title, v_course_id, v_teacher_id
  from public.exam_attempts ea
  join public.exams e on e.id = ea.exam_id
  join public.courses c on c.id = e.course_id
  where ea.id = new.attempt_id;

  select coalesce(p.full_name, p.email, 'Student'), p.email
  into v_student_name, v_student_email
  from public.profiles p
  where p.id = new.student_id;

  update public.exam_attempts
  set violations_count = violations_count + 1
  where id = new.attempt_id;

  insert into public.security_events (
    user_id,
    email,
    event_type,
    severity,
    description,
    metadata
  )
  values (
    new.student_id,
    v_student_email,
    'exam_violation',
    case new.severity::text
      when 'critical' then 'critical'
      when 'high' then 'high'
      when 'medium' then 'medium'
      else 'info'
    end,
    v_student_name || ' triggered exam monitoring event: ' || new.violation_type,
    jsonb_build_object(
      'attempt_id', new.attempt_id,
      'exam_id', v_exam_id,
      'violation_type', new.violation_type,
      'triggered_pause', new.triggered_pause,
      'details', new.details
    )
  );

  if v_teacher_id is not null then
    perform private.dispatch_event_notification_internal(
      array[v_teacher_id],
      'security'::public.notification_type,
      case
        when new.triggered_pause then 'Exam Paused (Approval Required): ' || coalesce(v_exam_title, 'Exam')
        else 'Exam Monitoring Alert: ' || coalesce(v_exam_title, 'Exam')
      end,
      v_student_name || ' triggered ' || replace(new.violation_type, '_', ' ') ||
      case when new.triggered_pause then '. Exam is paused awaiting your approval to resume.' else '.' end,
      v_course_id,
      '/teacher/assignments',
      jsonb_build_object(
        'attempt_id', new.attempt_id,
        'exam_id', v_exam_id,
        'violation_id', new.id,
        'violation_type', new.violation_type,
        'triggered_pause', new.triggered_pause
      ),
      false,
      'individual'
    );
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. TEACHER PUBLIC PROFILES
-- -----------------------------------------------------------------------------
create table if not exists public.teacher_public_profiles (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade unique,
  display_name text,
  headline text,
  biography text,
  experience_years integer check (experience_years is null or (experience_years >= 0 and experience_years <= 80)),
  education text,
  certifications text,
  website_url text,
  linkedin_url text,
  is_public_visible boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
comment on table public.teacher_public_profiles is 'Public-facing teacher profile information visible to students and visitors.';
create index if not exists teacher_public_profiles_teacher_id_idx on public.teacher_public_profiles(teacher_id);
create index if not exists teacher_public_profiles_is_public_idx on public.teacher_public_profiles(is_public_visible);

-- -----------------------------------------------------------------------------
-- 7. EXAM QUESTION MATERIAL REFERENCES (AI Grounding Sources)
-- -----------------------------------------------------------------------------
create table if not exists public.exam_question_materials (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  exam_id uuid not null references public.exams(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  material_source_type text not null,
  material_source_id text not null,
  material_name text not null,
  page_number integer,
  excerpt text,
  created_at timestamptz not null default timezone('utc', now())
);
comment on table public.exam_question_materials is 'Source material references for AI-generated exam questions.';
create index if not exists exam_question_materials_question_id_idx on public.exam_question_materials(question_id);
create index if not exists exam_question_materials_exam_id_idx on public.exam_question_materials(exam_id);
create index if not exists exam_question_materials_course_id_idx on public.exam_question_materials(course_id);

-- -----------------------------------------------------------------------------
-- 8. TRIGGERS: UPDATED_AT, COURSE TEACHER IMMUTABILITY & ROLE PROTECTION
-- -----------------------------------------------------------------------------
create or replace trigger set_assignment_materials_updated_at
  before update on public.assignment_materials
  for each row execute function private.set_updated_at();

create or replace trigger set_teacher_public_profiles_updated_at
  before update on public.teacher_public_profiles
  for each row execute function private.set_updated_at();

create or replace function private.prevent_course_teacher_reassignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.teacher_id is distinct from old.teacher_id then
    raise exception 'Forbidden: a course''s assigned teacher cannot be changed after creation.';
  end if;
  return new;
end;
$$;

create or replace trigger prevent_course_teacher_reassignment_trigger
  before update on public.courses
  for each row execute function private.prevent_course_teacher_reassignment();

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
    if new.suspension_reason is distinct from old.suspension_reason
       or new.suspended_at is distinct from old.suspended_at
       or new.suspended_by is distinct from old.suspended_by then
      raise exception 'Forbidden: users cannot modify suspension metadata.';
    end if;
  else
    if new.role is distinct from old.role then
      if new.id = (select auth.uid()) then
        raise exception 'Forbidden: you cannot change your own role.';
      end if;
      if old.role = 'admin' then
        raise exception 'Forbidden: administrator roles are protected and cannot be modified.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. DATA API GRANTS & ROW-LEVEL SECURITY POLICIES
-- -----------------------------------------------------------------------------
grant select, insert, update, delete on public.assignment_materials to authenticated;
grant select, insert on public.material_file_versions to authenticated;
grant select, insert on public.assignment_submission_versions to authenticated;
grant select on public.teacher_public_profiles to anon, authenticated;
grant insert, update, delete on public.teacher_public_profiles to authenticated;
grant select, insert, update, delete on public.exam_question_materials to authenticated;
grant delete on public.notification_recipients to authenticated;
grant select on public.profiles to anon;
grant select on public.teacher_reviews to anon;

alter table public.assignment_materials enable row level security;
alter table public.material_file_versions enable row level security;
alter table public.assignment_submission_versions enable row level security;
alter table public.teacher_public_profiles enable row level security;
alter table public.exam_question_materials enable row level security;

create policy "assignment_materials_select_authorized" on public.assignment_materials
  for select to authenticated
  using (
    (select private.is_admin())
    or (select private.is_course_teacher(course_id))
    or (select private.is_enrolled_in_course(course_id))
  );

create policy "assignment_materials_insert_teacher" on public.assignment_materials
  for insert to authenticated
  with check ((select private.is_course_teacher(course_id)) or (select private.is_admin()));

create policy "assignment_materials_update_teacher" on public.assignment_materials
  for update to authenticated
  using ((select private.is_course_teacher(course_id)) or (select private.is_admin()))
  with check ((select private.is_course_teacher(course_id)) or (select private.is_admin()));

create policy "assignment_materials_delete_teacher" on public.assignment_materials
  for delete to authenticated
  using ((select private.is_course_teacher(course_id)) or (select private.is_admin()));

create policy "material_file_versions_select_authorized" on public.material_file_versions
  for select to authenticated
  using ((select private.is_course_teacher(course_id)) or (select private.is_admin()));

create policy "material_file_versions_insert_teacher" on public.material_file_versions
  for insert to authenticated
  with check ((select private.is_course_teacher(course_id)) or (select private.is_admin()));

create policy "assignment_submission_versions_select_authorized" on public.assignment_submission_versions
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or (select private.is_admin())
    or exists (
      select 1
      from public.assignment_submissions s
      join public.assignments a on a.id = s.assignment_id
      where s.id = assignment_submission_versions.submission_id
        and (select private.is_course_teacher(a.course_id))
    )
  );

create policy "assignment_submission_versions_insert_student" on public.assignment_submission_versions
  for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and exists (
      select 1
      from public.assignment_submissions s
      join public.assignments a on a.id = s.assignment_id
      where s.id = assignment_submission_versions.submission_id
        and a.is_published = true
        and (select private.is_enrolled_in_course(a.course_id))
    )
  );

create policy "teacher_public_profiles_select_public" on public.teacher_public_profiles
  for select to anon, authenticated
  using (
    is_public_visible = true
    or teacher_id = (select auth.uid())
    or (select private.is_admin())
  );

create policy "teacher_public_profiles_insert_own" on public.teacher_public_profiles
  for insert to authenticated
  with check (
    (teacher_id = (select auth.uid()) and (select private.is_teacher()))
    or (select private.is_admin())
  );

create policy "teacher_public_profiles_update_own" on public.teacher_public_profiles
  for update to authenticated
  using (teacher_id = (select auth.uid()) or (select private.is_admin()))
  with check (teacher_id = (select auth.uid()) or (select private.is_admin()));

create policy "teacher_public_profiles_delete_own" on public.teacher_public_profiles
  for delete to authenticated
  using (teacher_id = (select auth.uid()) or (select private.is_admin()));

create policy "exam_question_materials_select_authorized" on public.exam_question_materials
  for select to authenticated
  using (
    (select private.is_admin())
    or (select private.is_course_teacher(course_id))
    or (select private.is_enrolled_in_course(course_id))
  );

create policy "exam_question_materials_insert_teacher" on public.exam_question_materials
  for insert to authenticated
  with check ((select private.is_course_teacher(course_id)) or (select private.is_admin()));

create policy "exam_question_materials_delete_teacher" on public.exam_question_materials
  for delete to authenticated
  using ((select private.is_course_teacher(course_id)) or (select private.is_admin()));

create policy "notification_recipients_delete_own" on public.notification_recipients
  for delete to authenticated
  using (recipient_id = (select auth.uid()) or (select private.is_admin()));

create policy "conversations_update_creator_or_admin" on public.conversations
  for update to authenticated
  using (created_by = (select auth.uid()) or (select private.is_admin()))
  with check (created_by = (select auth.uid()) or (select private.is_admin()));

alter policy "profiles_select_policy" on public.profiles
  to anon, authenticated
  using (
    (role = 'teacher'::public.user_role and status = 'active'::public.account_status)
    or id = (select auth.uid())
    or (select private.is_admin())
    or (select private.is_teacher_of_student(profiles.id))
    or (select private.shares_conversation_with(profiles.id))
  );

alter policy "teacher_reviews_select_published" on public.teacher_reviews
  to anon, authenticated
  using (
    (is_published = true and moderation_status = 'approved')
    or student_id = (select auth.uid())
    or teacher_id = (select auth.uid())
    or (select private.is_admin())
  );

-- -----------------------------------------------------------------------------
-- 10. STORAGE BUCKETS & POLICIES FOR FULL OFFICE/VIDEO/IMAGE/VOICE SUPPORT
-- -----------------------------------------------------------------------------
update storage.buckets
set file_size_limit = 104857600,
    allowed_mime_types = array[
      'application/pdf',
      'application/zip',
      'application/x-zip-compressed',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
      'text/markdown',
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'video/mp4',
      'video/webm',
      'video/quicktime'
    ]
where id in ('assignment-attachments', 'course-materials');

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
  'application/zip',
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/aac',
  'video/webm'
]
where id = 'message-attachments';

alter policy "storage_assignments_read" on storage.objects
  to authenticated
  using (
    bucket_id = 'assignment-attachments'
    and (
      (select private.is_admin())
      or (storage.foldername(name))[2] = ((select auth.uid()))::text
      or (
        (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and (
          (select private.is_course_teacher(((storage.foldername(objects.name))[1])::uuid))
          or (
            (storage.foldername(name))[2] = 'materials'
            and (select private.is_enrolled_in_course(((storage.foldername(objects.name))[1])::uuid))
          )
        )
      )
    )
  );

-- -----------------------------------------------------------------------------
-- 11. REALTIME PUBLICATION UPDATES
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'exam_attempts'
  ) then
    alter publication supabase_realtime add table public.exam_attempts;
  end if;
end $$;
