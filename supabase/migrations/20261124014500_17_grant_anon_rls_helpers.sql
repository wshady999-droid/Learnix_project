-- =============================================================================
-- Migration 17: Grant Execute on Private RLS Helper Functions to `anon`
-- Ensures public catalog queries on `public.courses`, `public.chapters`, and
-- `public.lessons` can evaluate RLS policies when queried by unauthenticated
-- (`anon`) visitors without raising `permission denied for function is_admin`.
-- =============================================================================

grant usage on schema private to anon, authenticated, service_role;

grant execute on function private.current_user_role() to anon, authenticated, service_role;
grant execute on function private.is_admin() to anon, authenticated, service_role;
grant execute on function private.is_teacher() to anon, authenticated, service_role;
grant execute on function private.has_permission(text) to anon, authenticated, service_role;
grant execute on function private.is_course_teacher(uuid) to anon, authenticated, service_role;
grant execute on function private.is_enrolled_in_course(uuid) to anon, authenticated, service_role;
grant execute on function private.is_teacher_of_student(uuid) to anon, authenticated, service_role;
grant execute on function private.is_conversation_participant(uuid) to anon, authenticated, service_role;
