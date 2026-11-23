-- =============================================================================
-- Learnix (BrainUp) — Migration 2: Examinations, Assignments, Notifications,
-- Messaging, Attendance, Reviews, Certificates, Study Sessions, Audit Logs,
-- Devices, Platform Settings, Contact Messages, and Transactional Functions
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. EXAMINATIONS
--    exams, questions, question_options, exam_sessions, exam_attempts,
--    student_answers, results, exam_violations
-- -----------------------------------------------------------------------------
create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  chapter_id uuid references public.chapters(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  description text,
  instructions text,
  status public.exam_status not null default 'draft',
  duration_minutes integer not null default 60 check (duration_minutes > 0),
  total_points numeric(7,2) not null default 100 check (total_points > 0),
  passing_score numeric(5,2) not null default 60 check (passing_score >= 0 and passing_score <= 100),
  max_attempts integer not null default 1 check (max_attempts >= 1),
  shuffle_questions boolean not null default true,
  shuffle_options boolean not null default true,
  show_results_immediately boolean not null default false,
  strict_proctoring boolean not null default true,
  max_violations_allowed integer not null default 3 check (max_violations_allowed >= 0),
  available_from timestamptz,
  available_until timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint exams_availability_window_check check (
    available_from is null or available_until is null or available_until > available_from
  )
);
comment on table public.exams is 'Examinations attached to a course (and optionally a chapter).';
create index if not exists exams_course_id_idx on public.exams(course_id);
create index if not exists exams_chapter_id_idx on public.exams(chapter_id);
create index if not exists exams_created_by_idx on public.exams(created_by);
create index if not exists exams_status_idx on public.exams(status);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  question_type public.question_type not null default 'single_choice',
  prompt text not null,
  explanation text,
  points numeric(6,2) not null default 1 check (points > 0),
  position integer not null default 1 check (position >= 1),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (exam_id, position)
);
comment on table public.questions is 'Questions belonging to an examination.';
create index if not exists questions_exam_id_idx on public.questions(exam_id);

create table if not exists public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  option_text text not null,
  is_correct boolean not null default false,
  position integer not null default 1 check (position >= 1),
  created_at timestamptz not null default timezone('utc', now()),
  unique (question_id, position)
);
comment on table public.question_options is 'Selectable answer choices for choice/true-false questions.';
create index if not exists question_options_question_id_idx on public.question_options(question_id);

create table if not exists public.exam_sessions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  access_code text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint exam_sessions_window_check check (ends_at > starts_at)
);
comment on table public.exam_sessions is 'Scheduled live examination windows for a cohort or class.';
create index if not exists exam_sessions_exam_id_idx on public.exam_sessions(exam_id);
create index if not exists exam_sessions_class_id_idx on public.exam_sessions(class_id);
create index if not exists exam_sessions_created_by_idx on public.exam_sessions(created_by);

create table if not exists public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  exam_session_id uuid references public.exam_sessions(id) on delete set null,
  student_id uuid not null references public.profiles(id) on delete cascade,
  attempt_number integer not null default 1 check (attempt_number >= 1),
  status public.attempt_status not null default 'in_progress',
  started_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  violations_count integer not null default 0 check (violations_count >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (exam_id, student_id, attempt_number)
);
comment on table public.exam_attempts is 'Individual student attempts on an exam with timer and violation counter.';
create index if not exists exam_attempts_exam_id_idx on public.exam_attempts(exam_id);
create index if not exists exam_attempts_exam_session_id_idx on public.exam_attempts(exam_session_id);
create index if not exists exam_attempts_student_id_idx on public.exam_attempts(student_id);
create index if not exists exam_attempts_status_idx on public.exam_attempts(status);

create table if not exists public.student_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  selected_option_id uuid references public.question_options(id) on delete set null,
  answer_text text,
  is_correct boolean,
  points_awarded numeric(6,2) check (points_awarded is null or points_awarded >= 0),
  teacher_feedback text,
  answered_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (attempt_id, question_id)
);
comment on table public.student_answers is 'Per-question responses recorded during an exam attempt.';
create index if not exists student_answers_attempt_id_idx on public.student_answers(attempt_id);
create index if not exists student_answers_question_id_idx on public.student_answers(question_id);
create index if not exists student_answers_selected_option_id_idx on public.student_answers(selected_option_id);

create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references public.exam_attempts(id) on delete cascade,
  exam_id uuid not null references public.exams(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  total_points numeric(7,2) not null check (total_points > 0),
  earned_points numeric(7,2) not null check (earned_points >= 0),
  score_percent numeric(5,2) not null check (score_percent >= 0 and score_percent <= 100),
  passed boolean not null,
  graded_by uuid references public.profiles(id) on delete set null,
  feedback text,
  is_published boolean not null default true,
  graded_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
comment on table public.results is 'Official graded results for exam attempts. Protected against student modification.';
create index if not exists results_exam_id_idx on public.results(exam_id);
create index if not exists results_course_id_idx on public.results(course_id);
create index if not exists results_student_id_idx on public.results(student_id);
create index if not exists results_graded_by_idx on public.results(graded_by);

create table if not exists public.exam_violations (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  violation_type text not null,
  severity public.violation_severity not null default 'medium',
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default timezone('utc', now())
);
comment on table public.exam_violations is 'Integrity events (tab switch, fullscreen exit, copy attempt) logged during exams.';
create index if not exists exam_violations_attempt_id_idx on public.exam_violations(attempt_id);
create index if not exists exam_violations_student_id_idx on public.exam_violations(student_id);

-- -----------------------------------------------------------------------------
-- 2. ASSIGNMENTS
--    assignments, assignment_submissions
-- -----------------------------------------------------------------------------
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  description text not null,
  attachment_storage_path text,
  max_points numeric(6,2) not null default 100 check (max_points > 0),
  due_at timestamptz,
  allow_late_submissions boolean not null default true,
  is_published boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
comment on table public.assignments is 'Course or lesson assignments requiring student file/text submission.';
create index if not exists assignments_course_id_idx on public.assignments(course_id);
create index if not exists assignments_lesson_id_idx on public.assignments(lesson_id);
create index if not exists assignments_created_by_idx on public.assignments(created_by);

create table if not exists public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  submission_text text,
  attachment_storage_path text,
  status public.submission_status not null default 'submitted',
  grade_points numeric(6,2) check (grade_points is null or grade_points >= 0),
  graded_by uuid references public.profiles(id) on delete set null,
  feedback text,
  submitted_at timestamptz not null default timezone('utc', now()),
  graded_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  unique (assignment_id, student_id)
);
comment on table public.assignment_submissions is 'Student submissions and teacher grades for assignments.';
create index if not exists assignment_submissions_assignment_id_idx on public.assignment_submissions(assignment_id);
create index if not exists assignment_submissions_student_id_idx on public.assignment_submissions(student_id);
create index if not exists assignment_submissions_graded_by_idx on public.assignment_submissions(graded_by);

-- -----------------------------------------------------------------------------
-- 3. NOTIFICATIONS & COMMUNICATION
--    notifications, notification_recipients, conversations,
--    conversation_participants, messages, message_attachments
-- -----------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references public.profiles(id) on delete set null,
  course_id uuid references public.courses(id) on delete cascade,
  notification_type public.notification_type not null default 'system',
  title text not null,
  body text not null,
  action_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);
comment on table public.notifications is 'Notification payloads broadcast to one or more recipients.';
create index if not exists notifications_sender_id_idx on public.notifications(sender_id);
create index if not exists notifications_course_id_idx on public.notifications(course_id);

create table if not exists public.notification_recipients (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  is_read boolean not null default false,
  read_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (notification_id, recipient_id)
);
comment on table public.notification_recipients is 'Per-recipient delivery and read-state tracking for notifications.';
create index if not exists notification_recipients_notification_id_idx on public.notification_recipients(notification_id);
create index if not exists notification_recipients_recipient_id_idx on public.notification_recipients(recipient_id);
create index if not exists notification_recipients_unread_idx on public.notification_recipients(recipient_id, is_read) where is_read = false;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  subject text,
  is_group boolean not null default false,
  last_message_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
comment on table public.conversations is 'Direct or course-scoped messaging threads.';
create index if not exists conversations_course_id_idx on public.conversations(course_id);
create index if not exists conversations_created_by_idx on public.conversations(created_by);

create table if not exists public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz,
  joined_at timestamptz not null default timezone('utc', now()),
  unique (conversation_id, user_id)
);
comment on table public.conversation_participants is 'Members participating in a conversation thread.';
create index if not exists conversation_participants_conversation_id_idx on public.conversation_participants(conversation_id);
create index if not exists conversation_participants_user_id_idx on public.conversation_participants(user_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  reply_to_id uuid references public.messages(id) on delete set null,
  body text not null check (char_length(trim(body)) > 0),
  is_edited boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
comment on table public.messages is 'Individual messages posted inside a conversation.';
create index if not exists messages_conversation_id_idx on public.messages(conversation_id);
create index if not exists messages_sender_id_idx on public.messages(sender_id);
create index if not exists messages_reply_to_id_idx on public.messages(reply_to_id);

create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  created_at timestamptz not null default timezone('utc', now())
);
comment on table public.message_attachments is 'Files attached to a conversation message stored in Supabase Storage.';
create index if not exists message_attachments_message_id_idx on public.message_attachments(message_id);

-- -----------------------------------------------------------------------------
-- 4. ATTENDANCE
--    attendance, attendance_records
-- -----------------------------------------------------------------------------
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  session_date date not null default current_date,
  topic text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique nulls not distinct (course_id, class_id, session_date)
);
comment on table public.attendance is 'Attendance sessions conducted for a course/class on a given date.';
create index if not exists attendance_course_id_idx on public.attendance(course_id);
create index if not exists attendance_class_id_idx on public.attendance(class_id);
create index if not exists attendance_recorded_by_idx on public.attendance(recorded_by);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendance(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status public.attendance_status not null default 'present',
  remarks text,
  recorded_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (attendance_id, student_id)
);
comment on table public.attendance_records is 'Individual student attendance status for an attendance session.';
create index if not exists attendance_records_attendance_id_idx on public.attendance_records(attendance_id);
create index if not exists attendance_records_student_id_idx on public.attendance_records(student_id);

-- -----------------------------------------------------------------------------
-- 5. RATINGS
--    course_reviews, teacher_reviews
-- -----------------------------------------------------------------------------
create table if not exists public.course_reviews (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  is_published boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (course_id, student_id)
);
comment on table public.course_reviews is '1–5 star ratings and reviews submitted by enrolled students for courses.';
create index if not exists course_reviews_course_id_idx on public.course_reviews(course_id);
create index if not exists course_reviews_student_id_idx on public.course_reviews(student_id);

create table if not exists public.teacher_reviews (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  is_published boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint teacher_reviews_not_self check (teacher_id <> student_id),
  unique nulls not distinct (teacher_id, student_id, course_id)
);
comment on table public.teacher_reviews is '1–5 star ratings and feedback submitted by students for teachers.';
create index if not exists teacher_reviews_teacher_id_idx on public.teacher_reviews(teacher_id);
create index if not exists teacher_reviews_student_id_idx on public.teacher_reviews(student_id);
create index if not exists teacher_reviews_course_id_idx on public.teacher_reviews(course_id);

-- -----------------------------------------------------------------------------
-- 6. ADDITIONAL PLATFORM FEATURES
--    certificates, study_sessions, audit_logs, user_devices,
--    platform_settings, contact_messages
-- -----------------------------------------------------------------------------
create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_number text not null unique,
  course_id uuid not null references public.courses(id) on delete restrict,
  student_id uuid not null references public.profiles(id) on delete cascade,
  issued_by uuid references public.profiles(id) on delete set null,
  final_score numeric(5,2) check (final_score is null or (final_score >= 0 and final_score <= 100)),
  storage_path text,
  verification_hash text not null unique,
  issued_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz,
  unique (course_id, student_id)
);
comment on table public.certificates is 'Verifiable course completion certificates issued to students.';
create index if not exists certificates_course_id_idx on public.certificates(course_id);
create index if not exists certificates_student_id_idx on public.certificates(student_id);
create index if not exists certificates_issued_by_idx on public.certificates(issued_by);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  lesson_id uuid references public.lessons(id) on delete set null,
  started_at timestamptz not null default timezone('utc', now()),
  ended_at timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  ai_interactions_count integer not null default 0 check (ai_interactions_count >= 0),
  created_at timestamptz not null default timezone('utc', now())
);
comment on table public.study_sessions is 'Student study telemetry sessions used for learning analytics.';
create index if not exists study_sessions_student_id_idx on public.study_sessions(student_id);
create index if not exists study_sessions_course_id_idx on public.study_sessions(course_id);
create index if not exists study_sessions_lesson_id_idx on public.study_sessions(lesson_id);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default timezone('utc', now())
);
comment on table public.audit_logs is 'Immutable security and administrative audit trail.';
create index if not exists audit_logs_actor_id_idx on public.audit_logs(actor_id);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs(created_at desc);

create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_fingerprint text not null,
  device_name text,
  browser text,
  os text,
  is_trusted boolean not null default false,
  last_active_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, device_fingerprint)
);
comment on table public.user_devices is 'Registered client devices per user for session security and exam integrity.';
create index if not exists user_devices_user_id_idx on public.user_devices(user_id);

create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  description text,
  is_public boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default timezone('utc', now())
);
comment on table public.platform_settings is 'Key-value platform configuration settings managed by administrators.';
create index if not exists platform_settings_updated_by_idx on public.platform_settings(updated_by);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  full_name text not null check (char_length(trim(full_name)) between 2 and 80),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  subject text not null check (char_length(trim(subject)) between 4 and 120),
  message text not null check (char_length(trim(message)) between 15 and 1500),
  locale text not null default 'en' check (locale in ('en', 'ar', 'de', 'it', 'fr')),
  status public.request_status not null default 'pending',
  handled_by uuid references public.profiles(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);
comment on table public.contact_messages is 'Inquiries submitted from the public Contact Us form.';
create index if not exists contact_messages_user_id_idx on public.contact_messages(user_id);
create index if not exists contact_messages_handled_by_idx on public.contact_messages(handled_by);
create index if not exists contact_messages_status_idx on public.contact_messages(status);

-- Updated_at triggers for Migration 2 tables
create or replace trigger set_exams_updated_at before update on public.exams
  for each row execute function private.set_updated_at();
create or replace trigger set_questions_updated_at before update on public.questions
  for each row execute function private.set_updated_at();
create or replace trigger set_exam_sessions_updated_at before update on public.exam_sessions
  for each row execute function private.set_updated_at();
create or replace trigger set_exam_attempts_updated_at before update on public.exam_attempts
  for each row execute function private.set_updated_at();
create or replace trigger set_student_answers_updated_at before update on public.student_answers
  for each row execute function private.set_updated_at();
create or replace trigger set_results_updated_at before update on public.results
  for each row execute function private.set_updated_at();
create or replace trigger set_assignments_updated_at before update on public.assignments
  for each row execute function private.set_updated_at();
create or replace trigger set_assignment_submissions_updated_at before update on public.assignment_submissions
  for each row execute function private.set_updated_at();
create or replace trigger set_conversations_updated_at before update on public.conversations
  for each row execute function private.set_updated_at();
create or replace trigger set_messages_updated_at before update on public.messages
  for each row execute function private.set_updated_at();
create or replace trigger set_attendance_updated_at before update on public.attendance
  for each row execute function private.set_updated_at();
create or replace trigger set_attendance_records_updated_at before update on public.attendance_records
  for each row execute function private.set_updated_at();
create or replace trigger set_course_reviews_updated_at before update on public.course_reviews
  for each row execute function private.set_updated_at();
create or replace trigger set_teacher_reviews_updated_at before update on public.teacher_reviews
  for each row execute function private.set_updated_at();
create or replace trigger set_platform_settings_updated_at before update on public.platform_settings
  for each row execute function private.set_updated_at();

-- Seed default public platform setting (brand metadata only)
insert into public.platform_settings (key, value, description, is_public)
values (
  'platform_identity',
  '{"name":"Learnix","tagline":"BrainUp","supported_locales":["en","ar","de","it","fr"]}'::jsonb,
  'Public platform identity and supported locales.',
  true
)
on conflict (key) do nothing;
