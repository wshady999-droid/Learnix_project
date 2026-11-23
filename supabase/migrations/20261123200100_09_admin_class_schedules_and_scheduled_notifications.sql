-- =============================================================================
-- Learnix (BrainUp) — Migration 9: Class Schedules & Scheduled Announcements
-- Supports Part 5 Admin Schedule & Attendance and Scheduled Notifications.
-- =============================================================================

create table if not exists public.class_schedules (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete restrict,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  room text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint class_schedules_time_order_check check (end_time > start_time)
);

comment on table public.class_schedules is 'Weekly recurring timetable slots linking classes, courses, and teachers.';
create index if not exists class_schedules_class_id_idx on public.class_schedules(class_id);
create index if not exists class_schedules_course_id_idx on public.class_schedules(course_id);
create index if not exists class_schedules_teacher_id_idx on public.class_schedules(teacher_id);

create or replace trigger set_class_schedules_updated_at
  before update on public.class_schedules
  for each row execute function private.set_updated_at();

alter table public.class_schedules enable row level security;

create policy "class_schedules_select_authenticated" on public.class_schedules
  for select to authenticated using (true);

create policy "class_schedules_admin_write" on public.class_schedules
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

grant select, insert, update, delete on table public.class_schedules to authenticated;
grant all privileges on table public.class_schedules to service_role;

-- Extend notifications to support scheduled announcements and audience targeting
alter table public.notifications
  add column if not exists target_scope text not null default 'individual'
    check (target_scope in ('all_students', 'all_teachers', 'all_users', 'department', 'class', 'individual')),
  add column if not exists scheduled_for timestamptz,
  add column if not exists sent_at timestamptz default timezone('utc', now()),
  add column if not exists is_announcement boolean not null default false;

create index if not exists notifications_scheduled_for_idx on public.notifications(scheduled_for);
