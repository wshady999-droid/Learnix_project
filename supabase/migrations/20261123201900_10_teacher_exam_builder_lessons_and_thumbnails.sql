-- =============================================================================
-- Learnix (BrainUp) — Migration 10: Teacher Dashboard Schema Extensions
-- Adds lesson scheduling & external resources, course completion requirements,
-- question difficulty/bank/image fields, exam version & assignment targeting,
-- AI essay grading suggestion columns, and course-thumbnails storage policy.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'question_difficulty') then
    create type public.question_difficulty as enum ('easy', 'medium', 'hard');
  end if;
end $$;

-- 1. Extend courses with completion requirements
alter table public.courses
  add column if not exists completion_requirements text;

-- 2. Extend lessons with external resources and scheduled publication timestamp
alter table public.lessons
  add column if not exists external_resource_url text,
  add column if not exists scheduled_publish_at timestamptz;

-- 3. Extend exams with class_id, assigned_student_ids, random_question_count, version_count
alter table public.exams
  add column if not exists class_id uuid references public.classes(id) on delete set null,
  add column if not exists assigned_student_ids uuid[] not null default '{}'::uuid[],
  add column if not exists random_question_count integer check (random_question_count is null or random_question_count >= 1),
  add column if not exists version_count integer not null default 1 check (version_count between 1 and 10);

create index if not exists exams_class_id_idx on public.exams(class_id);

-- 4. Extend questions with difficulty, media_url (images/diagrams), is_in_bank, course_id
alter table public.questions
  add column if not exists course_id uuid references public.courses(id) on delete cascade,
  add column if not exists difficulty public.question_difficulty not null default 'medium',
  add column if not exists media_url text,
  add column if not exists is_in_bank boolean not null default true;

create index if not exists questions_course_id_idx on public.questions(course_id);
create index if not exists questions_difficulty_idx on public.questions(difficulty);

-- 5. Extend student_answers with AI essay grading suggestion fields for teacher review
alter table public.student_answers
  add column if not exists ai_suggested_points numeric(6,2) check (ai_suggested_points is null or ai_suggested_points >= 0),
  add column if not exists ai_suggested_feedback text;

-- 6. Public bucket for course thumbnails & exam question diagrams (`course-thumbnails`, 10 MB, images)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-thumbnails',
  'course-thumbnails',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "storage_course_thumbnails_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'course-thumbnails');

create policy "storage_course_thumbnails_write_teacher_or_admin" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'course-thumbnails'
    and (
      (select private.is_admin())
      or (
        (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and (select private.is_course_teacher(((storage.foldername(name))[1])::uuid))
      )
    )
  )
  with check (
    bucket_id = 'course-thumbnails'
    and (
      (select private.is_admin())
      or (
        (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and (select private.is_course_teacher(((storage.foldername(name))[1])::uuid))
      )
    )
  );

-- 7. Ensure teachers CANNOT modify or delete student course_reviews or teacher_reviews
-- (Verify that course_reviews and teacher_reviews write policies remain strictly student-own or admin)
