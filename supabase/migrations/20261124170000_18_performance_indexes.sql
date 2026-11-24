-- Migration 18: Performance Optimization Composite Indexes
-- Speeds up frequent dashboard, notification bell, exam attempt, and profile status queries.

create index if not exists profiles_role_status_idx
  on public.profiles(role, status);

create index if not exists courses_teacher_status_idx
  on public.courses(teacher_id, status);

create index if not exists course_enrollments_student_status_idx
  on public.course_enrollments(student_id, status);

create index if not exists notification_recipients_recipient_read_created_idx
  on public.notification_recipients(recipient_id, is_read, created_at desc);

create index if not exists results_student_published_graded_idx
  on public.results(student_id, is_published, graded_at desc);

create index if not exists exam_attempts_exam_started_idx
  on public.exam_attempts(exam_id, started_at desc);

create index if not exists audit_logs_created_at_idx
  on public.audit_logs(created_at desc);
