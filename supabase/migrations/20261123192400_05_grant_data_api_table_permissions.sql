-- =============================================================================
-- Learnix (BrainUp) — Migration 5: Explicit Data API Role Grants
-- Grants table & sequence access in `public` to `anon`, `authenticated`, and
-- `service_role` so PostgREST / Supabase Data API can query them under RLS.
-- =============================================================================

grant usage on schema public to anon, authenticated, service_role;

-- Read-only public catalog tables for `anon` (strictly filtered by RLS policies)
grant select on table
  public.departments,
  public.educational_levels,
  public.courses,
  public.chapters,
  public.lessons,
  public.course_reviews,
  public.platform_settings
to anon;

-- Public contact form submission for `anon` (RLS enforces status='pending')
grant insert on table public.contact_messages to anon;

-- Authenticated users get table-level privileges governed by RLS policies and protective triggers
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all privileges on all tables in schema public to service_role;

grant usage, select on all sequences in schema public to anon, authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
