-- Migration 16: Instant Teacher Registration (Remove Teacher Approval Requirement)
-- Assigns `role = 'teacher'` and `status = 'active'` immediately when `requested_account_type = 'teacher'`.
-- Public registration as `admin` remains strictly prohibited (any value other than 'teacher' defaults to 'student').
-- Does NOT modify any existing users or existing `teacher_requests` records.

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
  v_requested_type text := lower(trim(coalesce(new.raw_user_meta_data ->> 'requested_account_type', 'student')));
  v_specialization text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'specialization', '')), '');
  v_qualifications text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'qualifications', '')), '');
  v_role public.user_role := 'student'::public.user_role;
  v_bio text := null;
begin
  if v_locale not in ('en', 'ar', 'de', 'it', 'fr') then
    v_locale := 'en';
  end if;

  -- Strictly allow only 'student' or 'teacher' on public signup; never allow 'admin'.
  if v_requested_type = 'teacher' then
    v_role := 'teacher'::public.user_role;
    if v_specialization is not null and v_qualifications is not null then
      v_bio := v_specialization || ' — ' || v_qualifications;
    elsif v_specialization is not null then
      v_bio := v_specialization;
    elsif v_qualifications is not null then
      v_bio := v_qualifications;
    end if;
  else
    v_role := 'student'::public.user_role;
  end if;

  insert into public.profiles (
    id,
    email,
    full_name,
    phone,
    country_code,
    avatar_url,
    bio,
    role,
    status,
    preferred_locale
  )
  values (
    new.id,
    lower(trim(coalesce(new.email, new.id::text || '@users.learnix.local'))),
    coalesce(v_full_name, split_part(coalesce(new.email, ''), '@', 1)),
    v_phone,
    v_country_code,
    v_avatar_url,
    v_bio,
    v_role,
    'active'::public.account_status,
    v_locale
  )
  on conflict (id) do update
  set full_name = coalesce(excluded.full_name, public.profiles.full_name),
      phone = coalesce(excluded.phone, public.profiles.phone),
      country_code = coalesce(excluded.country_code, public.profiles.country_code),
      avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
      bio = coalesce(excluded.bio, public.profiles.bio),
      updated_at = timezone('utc', now());

  insert into public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    new_values
  )
  values (
    new.id,
    case when v_role = 'teacher'::public.user_role then 'auth.signup_teacher' else 'auth.signup_student' end,
    'profiles',
    new.id::text,
    jsonb_build_object(
      'email', lower(trim(coalesce(new.email, ''))),
      'role', v_role::text
    )
  );

  return new;
end;
$$;
