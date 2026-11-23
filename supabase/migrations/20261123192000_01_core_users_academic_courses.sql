-- =============================================================================
-- Learnix (BrainUp) — Migration 1: Core Schema, Users, RBAC, Academic Structure,
-- Courses, Chapters, Lessons, Enrollments, Progress, Favorites, and Notes
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 1. ENUM TYPES
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('admin', 'teacher', 'student');
  end if;
  if not exists (select 1 from pg_type where typname = 'account_status') then
    create type public.account_status as enum ('active', 'suspended', 'pending');
  end if;
  if not exists (select 1 from pg_type where typname = 'request_status') then
    create type public.request_status as enum ('pending', 'approved', 'rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'course_status') then
    create type public.course_status as enum ('draft', 'published', 'archived');
  end if;
  if not exists (select 1 from pg_type where typname = 'enrollment_status') then
    create type public.enrollment_status as enum ('active', 'completed', 'dropped');
  end if;
  if not exists (select 1 from pg_type where typname = 'lesson_content_type') then
    create type public.lesson_content_type as enum ('video', 'article', 'pdf', 'presentation', 'quiz');
  end if;
  if not exists (select 1 from pg_type where typname = 'exam_status') then
    create type public.exam_status as enum ('draft', 'published', 'closed', 'archived');
  end if;
  if not exists (select 1 from pg_type where typname = 'question_type') then
    create type public.question_type as enum ('single_choice', 'multiple_choice', 'true_false', 'short_answer', 'essay');
  end if;
  if not exists (select 1 from pg_type where typname = 'attempt_status') then
    create type public.attempt_status as enum ('in_progress', 'submitted', 'graded', 'invalidated');
  end if;
  if not exists (select 1 from pg_type where typname = 'submission_status') then
    create type public.submission_status as enum ('submitted', 'graded', 'returned', 'late');
  end if;
  if not exists (select 1 from pg_type where typname = 'attendance_status') then
    create type public.attendance_status as enum ('present', 'absent', 'late', 'excused');
  end if;
  if not exists (select 1 from pg_type where typname = 'notification_type') then
    create type public.notification_type as enum ('system', 'course', 'exam', 'assignment', 'grade', 'message', 'attendance');
  end if;
  if not exists (select 1 from pg_type where typname = 'violation_severity') then
    create type public.violation_severity as enum ('low', 'medium', 'high', 'critical');
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2. SHARED TIMESTAMP TRIGGER FUNCTION
-- -----------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. USERS & RBAC TABLES
--    profiles, roles, permissions, role_permissions, user_permissions, teacher_requests
-- -----------------------------------------------------------------------------

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code public.user_role not null unique,
  name text not null,
  description text,
  is_system boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
comment on table public.roles is 'Canonical platform roles (admin, teacher, student).';

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]+:[a-z0-9_]+$'),
  module text not null,
  description text,
  created_at timestamptz not null default timezone('utc', now())
);
comment on table public.permissions is 'Fine-grained capability codes (e.g. courses:write, exams:grade).';

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (role_id, permission_id)
);
comment on table public.role_permissions is 'Default permissions attached to each canonical role.';
create index if not exists role_permissions_role_id_idx on public.role_permissions(role_id);
create index if not exists role_permissions_permission_id_idx on public.role_permissions(permission_id);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
comment on table public.departments is 'Academic departments (e.g. Computer Science, Mathematics).';

create table if not exists public.educational_levels (
  id uuid primary key default gen_random_uuid(),
  department_id uuid references public.departments(id) on delete set null,
  code text not null unique,
  name text not null,
  rank_order integer not null default 1 check (rank_order >= 1),
  description text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
comment on table public.educational_levels is 'Educational levels or academic years within departments.';
create index if not exists educational_levels_department_id_idx on public.educational_levels(department_id);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  avatar_url text,
  phone text,
  bio text,
  role public.user_role not null default 'student',
  status public.account_status not null default 'active',
  preferred_locale text not null default 'en' check (preferred_locale in ('en', 'ar', 'de', 'it', 'fr')),
  department_id uuid references public.departments(id) on delete set null,
  educational_level_id uuid references public.educational_levels(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
comment on table public.profiles is 'Extended user profile linked 1:1 with auth.users.';
create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_department_id_idx on public.profiles(department_id);
create index if not exists profiles_educational_level_id_idx on public.profiles(educational_level_id);

-- Add head_teacher_id FK to departments after profiles exists
alter table public.departments
  add column if not exists head_teacher_id uuid references public.profiles(id) on delete set null;
create index if not exists departments_head_teacher_id_idx on public.departments(head_teacher_id);

create table if not exists public.user_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  granted_by uuid references public.profiles(id) on delete set null,
  is_granted boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, permission_id)
);
comment on table public.user_permissions is 'Explicit per-user permission grants or overrides.';
create index if not exists user_permissions_user_id_idx on public.user_permissions(user_id);
create index if not exists user_permissions_permission_id_idx on public.user_permissions(permission_id);
create index if not exists user_permissions_granted_by_idx on public.user_permissions(granted_by);

create table if not exists public.teacher_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  specialization text not null,
  qualifications text not null,
  credentials_url text,
  status public.request_status not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  review_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
comment on table public.teacher_requests is 'Applications submitted by users requesting teacher privileges.';
create index if not exists teacher_requests_user_id_idx on public.teacher_requests(user_id);
create index if not exists teacher_requests_department_id_idx on public.teacher_requests(department_id);
create index if not exists teacher_requests_reviewed_by_idx on public.teacher_requests(reviewed_by);
create index if not exists teacher_requests_status_idx on public.teacher_requests(status);

-- -----------------------------------------------------------------------------
-- 4. EDUCATIONAL STRUCTURE: classes & student_teacher_assignments
-- -----------------------------------------------------------------------------
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  educational_level_id uuid not null references public.educational_levels(id) on delete restrict,
  advisor_teacher_id uuid references public.profiles(id) on delete set null,
  code text not null unique,
  name text not null,
  academic_year text not null,
  max_capacity integer not null default 40 check (max_capacity > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
comment on table public.classes is 'Academic cohorts/classes grouping students under a department and level.';
create index if not exists classes_department_id_idx on public.classes(department_id);
create index if not exists classes_educational_level_id_idx on public.classes(educational_level_id);
create index if not exists classes_advisor_teacher_id_idx on public.classes(advisor_teacher_id);

create table if not exists public.student_teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  constraint student_teacher_not_same check (student_id <> teacher_id),
  unique nulls not distinct (student_id, teacher_id, class_id)
);
comment on table public.student_teacher_assignments is 'Explicit assignment linking students, teachers, and classes.';
create index if not exists sta_student_id_idx on public.student_teacher_assignments(student_id);
create index if not exists sta_teacher_id_idx on public.student_teacher_assignments(teacher_id);
create index if not exists sta_class_id_idx on public.student_teacher_assignments(class_id);
create index if not exists sta_assigned_by_idx on public.student_teacher_assignments(assigned_by);

-- -----------------------------------------------------------------------------
-- 5. COURSES, ENROLLMENTS, CHAPTERS, LESSONS, PROGRESS, FAVORITES, NOTES
-- -----------------------------------------------------------------------------
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  code text not null unique,
  title text not null,
  subtitle text,
  description text,
  category text not null,
  language text not null default 'en' check (language in ('en', 'ar', 'de', 'it', 'fr')),
  thumbnail_url text,
  trailer_video_url text,
  teacher_id uuid not null references public.profiles(id) on delete restrict,
  department_id uuid references public.departments(id) on delete set null,
  educational_level_id uuid references public.educational_levels(id) on delete set null,
  class_id uuid references public.classes(id) on delete set null,
  status public.course_status not null default 'draft',
  estimated_hours numeric(6,2) not null default 0 check (estimated_hours >= 0),
  passing_score numeric(5,2) not null default 60 check (passing_score >= 0 and passing_score <= 100),
  is_featured boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
comment on table public.courses is 'Courses authored by teachers and organized by department/level/class.';
create index if not exists courses_teacher_id_idx on public.courses(teacher_id);
create index if not exists courses_department_id_idx on public.courses(department_id);
create index if not exists courses_educational_level_id_idx on public.courses(educational_level_id);
create index if not exists courses_class_id_idx on public.courses(class_id);
create index if not exists courses_status_idx on public.courses(status);
create index if not exists courses_category_idx on public.courses(category);

create table if not exists public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status public.enrollment_status not null default 'active',
  progress_percent numeric(5,2) not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  enrolled_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  last_accessed_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  unique (course_id, student_id)
);
comment on table public.course_enrollments is 'Student enrollments in courses with completion percentage.';
create index if not exists course_enrollments_course_id_idx on public.course_enrollments(course_id);
create index if not exists course_enrollments_student_id_idx on public.course_enrollments(student_id);
create index if not exists course_enrollments_status_idx on public.course_enrollments(status);

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  position integer not null default 1 check (position >= 1),
  is_published boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (course_id, position)
);
comment on table public.chapters is 'Ordered chapters/modules belonging to a course.';
create index if not exists chapters_course_id_idx on public.chapters(course_id);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  summary text,
  content_type public.lesson_content_type not null default 'video',
  content_markdown text,
  video_storage_path text,
  attachment_storage_path text,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  position integer not null default 1 check (position >= 1),
  is_preview boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (chapter_id, position)
);
comment on table public.lessons is 'Individual lessons inside a chapter with video, markdown, PDF, or presentation content.';
create index if not exists lessons_chapter_id_idx on public.lessons(chapter_id);
create index if not exists lessons_course_id_idx on public.lessons(course_id);

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  is_completed boolean not null default false,
  watched_seconds integer not null default 0 check (watched_seconds >= 0),
  last_position_seconds integer not null default 0 check (last_position_seconds >= 0),
  completed_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  unique (lesson_id, student_id)
);
comment on table public.lesson_progress is 'Per-student progress and playback state for each lesson.';
create index if not exists lesson_progress_lesson_id_idx on public.lesson_progress(lesson_id);
create index if not exists lesson_progress_course_id_idx on public.lesson_progress(course_id);
create index if not exists lesson_progress_student_id_idx on public.lesson_progress(student_id);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint favorites_target_check check (
    (course_id is not null and lesson_id is null) or
    (course_id is null and lesson_id is not null)
  ),
  unique nulls not distinct (student_id, course_id, lesson_id)
);
comment on table public.favorites is 'Student bookmarked courses or lessons.';
create index if not exists favorites_student_id_idx on public.favorites(student_id);
create index if not exists favorites_course_id_idx on public.favorites(course_id);
create index if not exists favorites_lesson_id_idx on public.favorites(lesson_id);

create table if not exists public.lesson_notes (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  video_timestamp_seconds integer check (video_timestamp_seconds is null or video_timestamp_seconds >= 0),
  content text not null check (char_length(trim(content)) > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
comment on table public.lesson_notes is 'Private timestamped study notes taken by a student on a lesson.';
create index if not exists lesson_notes_lesson_id_idx on public.lesson_notes(lesson_id);
create index if not exists lesson_notes_student_id_idx on public.lesson_notes(student_id);

-- Updated_at triggers for Migration 1 tables
create or replace trigger set_roles_updated_at before update on public.roles
  for each row execute function private.set_updated_at();
create or replace trigger set_departments_updated_at before update on public.departments
  for each row execute function private.set_updated_at();
create or replace trigger set_educational_levels_updated_at before update on public.educational_levels
  for each row execute function private.set_updated_at();
create or replace trigger set_profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create or replace trigger set_teacher_requests_updated_at before update on public.teacher_requests
  for each row execute function private.set_updated_at();
create or replace trigger set_classes_updated_at before update on public.classes
  for each row execute function private.set_updated_at();
create or replace trigger set_courses_updated_at before update on public.courses
  for each row execute function private.set_updated_at();
create or replace trigger set_course_enrollments_updated_at before update on public.course_enrollments
  for each row execute function private.set_updated_at();
create or replace trigger set_chapters_updated_at before update on public.chapters
  for each row execute function private.set_updated_at();
create or replace trigger set_lessons_updated_at before update on public.lessons
  for each row execute function private.set_updated_at();
create or replace trigger set_lesson_progress_updated_at before update on public.lesson_progress
  for each row execute function private.set_updated_at();
create or replace trigger set_lesson_notes_updated_at before update on public.lesson_notes
  for each row execute function private.set_updated_at();

-- Seed canonical system roles & permissions (configuration metadata, not fake users/courses)
insert into public.roles (code, name, description, is_system)
values
  ('admin', 'Administrator', 'Full platform governance and configuration authority.', true),
  ('teacher', 'Teacher', 'Course authoring, examination management, grading, and student mentoring.', true),
  ('student', 'Student', 'Course enrollment, lesson study, examinations, and progress tracking.', true)
on conflict (code) do nothing;

insert into public.permissions (code, module, description)
values
  ('users:manage', 'users', 'Manage user profiles, roles, and teacher requests'),
  ('courses:create', 'courses', 'Create and manage assigned courses, chapters, and lessons'),
  ('courses:publish', 'courses', 'Approve and publish courses to the catalog'),
  ('exams:manage', 'exams', 'Create, schedule, and grade examinations'),
  ('assignments:manage', 'assignments', 'Create and grade course assignments'),
  ('attendance:manage', 'attendance', 'Record and update student attendance'),
  ('analytics:view', 'analytics', 'View cohort and platform analytics'),
  ('settings:manage', 'settings', 'Modify global platform settings')
on conflict (code) do nothing;
