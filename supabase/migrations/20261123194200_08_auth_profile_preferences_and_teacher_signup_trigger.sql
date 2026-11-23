-- =============================================================================
-- Learnix (BrainUp) — Migration 8: Auth Profile Preferences, Teacher Signup
-- Trigger, and Admin Teacher Approval Workflow
-- =============================================================================

alter table public.profiles
  add column if not exists country_code text,
  add column if not exists preferred_theme text not null default 'system'
    check (preferred_theme in ('light', 'dark', 'system')),
  add column if not exists notification_preferences jsonb not null default
    '{"email_updates":true,"course_alerts":true,"exam_reminders":true,"grade_notifications":true,"security_alerts":true}'::jsonb;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locale text := coalesce(new.raw_user_meta_data ->> 'preferred_locale', 'en');
  v_full_name text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  v_phone text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '');
  v_country_code text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'country_code', '')), '');
  v_avatar_url text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'avatar_url', '')), '');
  v_requested_type text := coalesce(new.raw_user_meta_data ->> 'requested_account_type', 'student');
  v_specialization text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'specialization', '')), '');
  v_qualifications text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'qualifications', '')), '');
begin
  if v_locale not in ('en', 'ar', 'de', 'it', 'fr') then
    v_locale := 'en';
  end if;

  -- Never trust client metadata for role assignment; every public signup starts as 'student'.
  insert into public.profiles (
    id,
    email,
    full_name,
    phone,
    country_code,
    avatar_url,
    role,
    status,
    preferred_locale
  )
  values (
    new.id,
    coalesce(new.email, new.id::text || '@users.learnix.local'),
    coalesce(v_full_name, split_part(coalesce(new.email, ''), '@', 1)),
    v_phone,
    v_country_code,
    v_avatar_url,
    'student',
    'active',
    v_locale
  )
  on conflict (id) do update
  set full_name = coalesce(excluded.full_name, public.profiles.full_name),
      phone = coalesce(excluded.phone, public.profiles.phone),
      country_code = coalesce(excluded.country_code, public.profiles.country_code),
      avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
      updated_at = timezone('utc', now());

  -- If the user registered via the Teacher Signup form, create a pending approval request.
  if v_requested_type = 'teacher' and v_specialization is not null and v_qualifications is not null then
    insert into public.teacher_requests (
      user_id,
      specialization,
      qualifications,
      status
    )
    values (
      new.id,
      v_specialization,
      v_qualifications,
      'pending'
    );
  end if;

  insert into public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    new_values
  )
  values (
    new.id,
    case when v_requested_type = 'teacher' then 'auth.signup_teacher_requested' else 'auth.signup_student' end,
    'profiles',
    new.id::text,
    jsonb_build_object(
      'email', new.email,
      'requested_account_type', v_requested_type
    )
  );

  return new;
end;
$$;

-- Transactional Admin approval/rejection of teacher requests
create or replace function private.admin_review_teacher_request_internal(
  p_request_id uuid,
  p_approve boolean,
  p_review_notes text default null
)
returns public.teacher_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid := (select auth.uid());
  v_req public.teacher_requests;
begin
  if not (select private.is_admin()) then
    raise exception 'Forbidden: only administrators can review teacher requests.';
  end if;

  select * into v_req
  from public.teacher_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Teacher request not found.';
  end if;

  update public.teacher_requests
  set status = case when p_approve then 'approved'::public.request_status else 'rejected'::public.request_status end,
      reviewed_by = v_admin_id,
      review_notes = p_review_notes,
      reviewed_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where id = p_request_id
  returning * into v_req;

  if p_approve then
    update public.profiles
    set role = 'teacher',
        department_id = coalesce(v_req.department_id, department_id),
        updated_at = timezone('utc', now())
    where id = v_req.user_id
      and role = 'student';
  end if;

  insert into public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    new_values
  )
  values (
    v_admin_id,
    case when p_approve then 'teacher_request.approved' else 'teacher_request.rejected' end,
    'teacher_requests',
    p_request_id::text,
    jsonb_build_object('user_id', v_req.user_id, 'status', v_req.status)
  );

  return v_req;
end;
$$;

revoke all on function private.admin_review_teacher_request_internal(uuid, boolean, text) from public, anon;
grant execute on function private.admin_review_teacher_request_internal(uuid, boolean, text) to authenticated, service_role;

create or replace function public.admin_review_teacher_request(
  p_request_id uuid,
  p_approve boolean,
  p_review_notes text default null
)
returns public.teacher_requests
language sql
security invoker
set search_path = ''
as $$
  select * from private.admin_review_teacher_request_internal(p_request_id, p_approve, p_review_notes);
$$;

revoke all on function public.admin_review_teacher_request(uuid, boolean, text) from public, anon;
grant execute on function public.admin_review_teacher_request(uuid, boolean, text) to authenticated, service_role;
